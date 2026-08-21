/**
 * 제보·수정 요청 승인 — 사진을 place-images 버킷으로 옮기고 승인 함수를 부른다.
 *
 *   node --env-file=.env.local scripts/approve-submission.mjs report <report-id> <place-id>
 *   node --env-file=.env.local scripts/approve-submission.mjs edit   <request-id>
 *
 * ─ 왜 SQL 함수가 아니라 스크립트인가 ────────────────────────────────────────
 * 사진 파일을 옮기는 일은 Postgres가 못 한다. storage.objects는 메타데이터 테이블일
 * 뿐이라, 그 행의 name을 UPDATE해도 실제 오브젝트는 제자리에 남아 둘이 어긋난다.
 * 파일 이동은 Storage API를 거쳐야 하고, 그래서 승인 절차가 둘로 나뉜다.
 *
 *   1. 여기(스크립트): 파일을 submissions/<uid>/ → <slug>/ 로 옮기고
 *      places.photos에 경로를 붙인다. 버킷은 그대로 place-images이고, 제보의
 *      공개 URL에서 경로를 되짚어 쓴다.
 *   2. DB 함수: 상태를 approved로 바꾸고 이력을 남긴다.
 *
 * 순서가 중요하다. 파일을 먼저 옮기고 마지막에 승인한다 — 중간에 실패하면 제보는
 * pending으로 남아 다시 시도할 수 있다. 반대로 하면 "승인됐는데 사진이 없는" 상태가
 * 되고, 그건 사람이 눈치채기 어렵다.
 *
 * **그래서 각 단계가 다시 돌아도 괜찮아야 한다.** 파일은 옮겼는데 승인에서 실패한
 * 경우, 다시 돌리면 원본이 이미 없어 move가 깨진다. 그것을 막으려고 옮기기 전에
 * 목적지를 먼저 보고, 이미 있으면 건너뛴다. places.photos도 중복으로 붙이지 않는다.
 *
 * ─ service_role 키가 필요하다 ───────────────────────────────────────────────
 * 사용자는 submissions/<본인 uid>/ 아래에만 쓸 수 있다. 카페 사진이 놓이는 <slug>/는
 * 정책이 열어 주지 않으므로, 그쪽으로 옮기는 이 스크립트만 RLS를 우회하는
 * service_role 키를 쓴다.
 *
 * service_role 키의 JWT에는 sub 클레임이 없어 DB에서 auth.uid()가 NULL이다. 그래서
 * **누구의 이름으로 승인하는지를 인자로 넘긴다**(승인 함수의 p_reviewer). 세션이 있는
 * 호출에서는 그 인자가 무시되므로, 로그인한 사람이 남을 사칭하는 경로는 열리지 않는다.
 *
 *   .env.local에 SUPABASE_SERVICE_ROLE_KEY=... 를 넣는다 (NEXT_PUBLIC_ 접두사를
 *   붙이지 않는다. 붙이면 브라우저 번들에 그대로 실려 나간다).
 */
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'place-images';
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;

/**
 * 제보 테이블의 photos는 **공개 URL**이고 places.photos는 **경로**다. 담는 목적이
 * 달라서 그렇다(검수자가 클릭해서 열어야 한다 vs 프로젝트를 옮겨도 살아야 한다).
 * 파일을 옮기려면 경로가 필요하므로 여기서 되짚는다.
 */
function toPath(value) {
  const at = value.indexOf(PUBLIC_MARKER);
  return at === -1 ? value : value.slice(at + PUBLIC_MARKER.length);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.\n' +
      '  node --env-file=.env.local scripts/approve-submission.mjs ...',
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const [kind, id, placeId] = args.filter((a) => !a.startsWith('--'));

if (kind !== 'report' && kind !== 'edit') {
  console.error(
    '사용법:\n' +
      '  approve-submission.mjs report <report-id> <place-id> [--reviewer=<uuid>]\n' +
      '  approve-submission.mjs edit   <request-id> [--reviewer=<uuid>]',
  );
  process.exit(1);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/**
 * 제보 사진을 카페 사진 자리로 옮긴다 (같은 버킷 안에서 경로만 바뀐다).
 *
 * 새 경로에서 업로더 uid를 떼고 카페 slug 아래로 넣는다. 공개 URL에 남의 uid가
 * 드러날 이유가 없고, 나중에 사람이 파일을 찾을 때도 slug가 낫다.
 */
async function movePhotos(photos, place) {
  const prefix = place.slug ?? place.id;

  // 목적지를 먼저 본다. 앞선 실행이 파일만 옮기고 승인에서 멈췄다면 여기 이미 있다.
  const { data: existing, error: listError } = await db.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000 });

  if (listError) fail(`카페 사진 폴더를 훑지 못했습니다: ${listError.message}`);
  const already = new Set((existing ?? []).map((entry) => entry.name));

  const moved = [];
  for (const photo of photos) {
    const path = toPath(photo);
    const file = path.split('/').pop();
    const target = `${prefix}/${file}`;

    if (already.has(file)) {
      console.log(`  · ${file} — 이미 옮겨져 있다 (건너뜀)`);
      moved.push(target);
      continue;
    }

    const { error } = await db.storage.from(BUCKET).move(path, target);

    if (error) fail(`사진을 옮기지 못했습니다 (${path}): ${error.message}`);
    moved.push(target);
    console.log(`  · ${path} → ${target}`);
  }

  return moved;
}

/**
 * 옮긴 **경로**를 카페 사진 뒤에 붙인다(places.photos는 URL이 아니다).
 * 기존 사진은 그대로 두고, 이미 붙어 있는 경로는 다시 넣지 않는다 — 다시 돌려도
 * 같은 결과여야 한다.
 */
async function appendPhotos(place, paths) {
  const next = [...place.photos];
  for (const path of paths) {
    if (!next.includes(path)) next.push(path);
  }

  if (next.length === place.photos.length) {
    if (paths.length > 0) console.log('  · places.photos 그대로 (이미 붙어 있다)');
    return;
  }

  const { error } = await db
    .from('places')
    .update({ photos: next })
    .eq('id', place.id);

  if (error) fail(`places.photos를 갱신하지 못했습니다: ${error.message}`);
  console.log(`  · places.photos += ${next.length - place.photos.length}장`);
}

/**
 * 누구의 이름으로 승인할지. service_role에는 세션이 없으므로 DB가 이것을 인자로 받는다.
 *
 * 큐레이터가 한 명이면 그 사람으로 하고, 여럿이면 --reviewer=<uuid>로 고르게 한다.
 * 임의로 아무나 고르면 검수 이력이 엉뚱한 사람 앞으로 남는다.
 */
async function resolveReviewer() {
  const flag = args.find((a) => a.startsWith('--reviewer='))?.split('=')[1];
  if (flag) return flag;

  const { data, error } = await db
    .from('profiles')
    .select('id, nickname, role')
    .in('role', ['curator', 'admin']);

  if (error) fail(`큐레이터를 찾지 못했습니다: ${error.message}`);
  if (data.length === 0) {
    fail('큐레이터가 없습니다. profiles.role을 curator로 올린 뒤 다시 실행하세요');
  }
  if (data.length > 1) {
    const list = data.map((r) => `    ${r.id}  ${r.nickname ?? ''}`).join('\n');
    fail(`큐레이터가 여럿입니다. --reviewer=<uuid>로 고르세요:\n${list}`);
  }

  return data[0].id;
}

async function loadPlace(id) {
  const { data, error } = await db
    .from('places')
    .select('id, slug, photos')
    .eq('id', id)
    .maybeSingle();

  if (error) fail(`카페를 불러오지 못했습니다: ${error.message}`);
  if (!data) fail(`카페를 찾을 수 없습니다: ${id}`);
  return data;
}

if (kind === 'report') {
  if (!id || !placeId) fail('report는 <report-id>와 <place-id> 둘 다 필요합니다');

  const { data: report, error } = await db
    .from('place_reports')
    .select('id, status, photos, naver_place_url')
    .eq('id', id)
    .maybeSingle();

  if (error) fail(`제보를 불러오지 못했습니다: ${error.message}`);
  if (!report) fail(`제보를 찾을 수 없습니다: ${id}`);
  if (report.status !== 'pending') fail(`이미 처리된 제보입니다 (status=${report.status})`);

  const place = await loadPlace(placeId);
  console.log(`제보 ${report.naver_place_url} → 카페 ${place.slug ?? place.id}`);

  await appendPhotos(place, await movePhotos(report.photos, place));

  // 상태 전환은 마지막이다. 위에서 실패하면 pending으로 남아 다시 시도할 수 있다.
  const { error: rpcError } = await db.rpc('approve_place_report', {
    p_report_id: id,
    p_place_id: placeId,
    p_reviewer: await resolveReviewer(),
  });
  if (rpcError) fail(`승인하지 못했습니다: ${rpcError.message}`);

  console.log('✅ 승인 완료');
} else {
  if (!id) fail('edit는 <request-id>가 필요합니다');

  const { data: request, error } = await db
    .from('place_edit_requests')
    .select('id, status, photos, place_id, note')
    .eq('id', id)
    .maybeSingle();

  if (error) fail(`수정 요청을 불러오지 못했습니다: ${error.message}`);
  if (!request) fail(`수정 요청을 찾을 수 없습니다: ${id}`);
  if (request.status !== 'pending') fail(`이미 처리된 요청입니다 (status=${request.status})`);

  const place = await loadPlace(request.place_id);
  console.log(`수정 요청 → 카페 ${place.slug ?? place.id}`);
  if (request.note) console.log(`  메모: ${request.note}`);

  await appendPhotos(place, await movePhotos(request.photos, place));

  // 카페 정보 자체(영업시간·가격 등)는 사람이 고친다. 이 함수는 확인일을 오늘로
  // 옮기고 요청을 approved로 표시할 뿐이다.
  const { error: rpcError } = await db.rpc('approve_edit_request', {
    p_request_id: id,
    p_reviewer: await resolveReviewer(),
  });
  if (rpcError) fail(`승인하지 못했습니다: ${rpcError.message}`);

  console.log('✅ 승인 완료 — 카페 정보 자체를 고쳤는지 다시 확인하세요');
}

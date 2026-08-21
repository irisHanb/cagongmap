/**
 * 버려진 제보 사진 정리 — 아무 제보도 가리키지 않는 submissions/ 파일을 지운다.
 *
 *   node --env-file=.env.local scripts/prune-orphan-photos.mjs            # 목록만 (기본)
 *   node --env-file=.env.local scripts/prune-orphan-photos.mjs --yes      # 실제로 지운다
 *   node --env-file=.env.local scripts/prune-orphan-photos.mjs --min-age-minutes=0 --yes
 *
 * ─ 왜 고아가 생기나 ─────────────────────────────────────────────────────────
 * 사진은 **제출 버튼을 누를 때** 올라가고, 그 다음 insert가 실패하면 파일만 남는다.
 * 중복 제보(같은 대상에 대기 중 요청 하나)나 폼을 닫아 버린 경우가 그렇다.
 * 올리기를 insert 뒤로 미루면 고아는 사라지지만, 실패할 때마다 사용자가 사진을
 * 다시 골라야 한다 — 실패는 드물고 고아는 청소할 수 있으므로 지금 순서를 택했다.
 *
 * ─ 안전장치 셋 ──────────────────────────────────────────────────────────────
 *  1. **기본은 목록만 보여준다.** 지우려면 --yes를 붙여야 한다.
 *  2. **참조되는 파일은 절대 건드리지 않는다.** 세 곳을 다 본다 —
 *     place_reports·place_edit_requests의 photos(공개 URL)와 **places.photos(경로)**.
 *     승인해도 파일을 옮기지 않으므로, 카페가 쓰는 사진이 검수 폴더에 그대로 남는다.
 *     places를 빠뜨리면 이미 지도에 뜨는 사진을 지우게 된다.
 *  3. **갓 올라온 파일은 남긴다**(기본 60분). 폼을 열어 둔 채 사진만 고른 사람의
 *     파일을 지우지 않으려는 것이다. --min-age-minutes로 바꾼다.
 *
 * ─ service_role 키가 필요하다 ───────────────────────────────────────────────
 * storage 테이블은 SQL로 지울 수 없고(storage.protect_delete), 삭제 정책은 본인
 * 파일에만 열려 있다. 남의 고아까지 치우려면 RLS를 우회해야 한다.
 *
 *   .env.local에 SUPABASE_SERVICE_ROLE_KEY=... (NEXT_PUBLIC_을 붙이지 않는다)
 */
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'place-images';
const PREFIX = 'submissions';
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.\n' +
      '  node --env-file=.env.local scripts/prune-orphan-photos.mjs',
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const apply = args.includes('--yes');
const minAgeMinutes = Number(
  args.find((a) => a.startsWith('--min-age-minutes='))?.split('=')[1] ?? 60,
);

if (Number.isNaN(minAgeMinutes) || minAgeMinutes < 0) {
  console.error('--min-age-minutes는 0 이상의 숫자여야 합니다');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

function toPath(value) {
  const at = value.indexOf(PUBLIC_MARKER);
  return at === -1 ? value : value.slice(at + PUBLIC_MARKER.length);
}

const PAGE = 500;

/**
 * 제보가 가리키는 경로 전부. 이 목록에 있으면 절대 지우지 않는다.
 *
 * **끝까지 읽어야 한다.** PostgREST는 기본적으로 최대 1000행만 돌려주는데, 여기서
 * 잘리면 참조되는 사진이 고아로 보인다 — 이 스크립트의 안전 논리가 통째로 무너진다.
 * 그래서 range로 끝까지 넘긴다.
 */
async function referencedPaths() {
  const referenced = new Set();

  // places.photos는 URL이 아니라 경로다. toPath는 경로를 그대로 돌려준다.
  for (const table of ['place_reports', 'place_edit_requests', 'places']) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from(table)
        .select('photos')
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1);

      if (error) {
        console.error(`✗ ${table}를 읽지 못했습니다: ${error.message}`);
        process.exit(1);
      }

      for (const row of data) {
        for (const photo of row.photos ?? []) referenced.add(toPath(photo));
      }

      if (data.length < PAGE) break;
    }
  }

  return referenced;
}

/** 한 폴더를 끝까지 훑는다. list()도 한 번에 돌려주는 개수가 제한돼 있다. */
async function listAll(prefix) {
  const all = [];

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset });

    if (error) {
      console.error(`✗ ${prefix}를 훑지 못했습니다: ${error.message}`);
      process.exit(1);
    }

    all.push(...data);
    if (data.length < PAGE) break;
  }

  return all;
}

/**
 * submissions/ 아래 파일 전부.
 *
 * list()는 한 폴더씩만 훑으므로 두 겹을 돈다 — submissions/<uid>/<파일>.
 */
async function listSubmissionFiles() {
  const files = [];

  const owners = await listAll(PREFIX);

  for (const owner of owners) {
    // 폴더는 id가 null로 온다. 파일이 바로 놓여 있으면 규칙에 어긋나므로 건너뛴다.
    if (owner.id !== null) continue;

    const entries = await listAll(`${PREFIX}/${owner.name}`);

    for (const entry of entries) {
      if (entry.id === null) continue;
      files.push({
        path: `${PREFIX}/${owner.name}/${entry.name}`,
        createdAt: new Date(entry.created_at),
        size: entry.metadata?.size ?? 0,
      });
    }
  }

  return files;
}

const referenced = await referencedPaths();
const files = await listSubmissionFiles();
const cutoff = Date.now() - minAgeMinutes * 60_000;

const orphans = files.filter((f) => !referenced.has(f.path) && f.createdAt.getTime() < cutoff);
const tooYoung = files.filter((f) => !referenced.has(f.path) && f.createdAt.getTime() >= cutoff);

console.log(`제보 사진 ${files.length}장 · 참조됨 ${files.length - orphans.length - tooYoung.length}장`);
if (tooYoung.length > 0) {
  console.log(`대기 ${tooYoung.length}장 (올라온 지 ${minAgeMinutes}분이 안 됐다 — 폼이 열려 있을 수 있다)`);
}

if (orphans.length === 0) {
  console.log('✅ 지울 고아 파일이 없습니다');
  process.exit(0);
}

const total = orphans.reduce((sum, f) => sum + f.size, 0);
console.log(`\n고아 ${orphans.length}장 (${Math.round(total / 1024)} kB):`);
for (const f of orphans) {
  console.log(`  · ${f.path}  ${Math.round(f.size / 1024)} kB  ${f.createdAt.toISOString()}`);
}

if (!apply) {
  console.log('\n(목록만 보여줬습니다. 실제로 지우려면 --yes를 붙이세요)');
  process.exit(0);
}

const { data: removed, error } = await db.storage.from(BUCKET).remove(orphans.map((f) => f.path));
if (error) {
  console.error(`✗ 지우지 못했습니다: ${error.message}`);
  process.exit(1);
}

console.log(`\n✅ ${removed.length}장 지웠습니다`);

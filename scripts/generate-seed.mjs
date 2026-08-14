/**
 * data/cafes.json → supabase/migrations/20260814000003_seed_places.sql
 *
 * 시드의 원본은 여전히 data/cafes.json이다. JSON을 고친 뒤 이 스크립트를 다시 돌린다.
 *   node scripts/generate-seed.mjs
 *
 * 시드를 seed.sql이 아니라 마이그레이션으로 내보내는 이유:
 * 원격 프로젝트에는 db push(= 마이그레이션)만 올라간다. 큐레이션한 카페 9곳은
 * 개발용 더미가 아니라 서비스가 성립하려면 있어야 하는 내용이므로 스키마와 같은
 * 경로로 배포되어야 한다.
 *
 * 이미 적용된 프로젝트에는 이 파일을 다시 생성해도 반영되지 않는다 — 마이그레이션은
 * 한 번만 돈다. 카페 정보를 고쳤다면 새 마이그레이션을 따로 만든다.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const source = new URL('../data/cafes.json', import.meta.url);
const target = new URL('../supabase/migrations/20260814000003_seed_places.sql', import.meta.url);

const cafes = JSON.parse(readFileSync(source, 'utf8'));

const quote = (value) =>
  value === null || value === undefined ? 'null' : `'${String(value).replace(/'/g, "''")}'`;

/** 한글은 두 칸으로 세서 실제 보이는 너비에 맞춘다. */
const width = (text) => [...text].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 0x2000 ? 2 : 1), 0);

/** 태그가 길어지면 줄을 나눈다. 한 줄이 대략 78칸을 넘지 않게. */
function formatTags(tags, indent) {
  const quoted = tags.map(quote);
  const lines = [];
  let line = '';

  for (const tag of quoted) {
    const candidate = line ? `${line} ${tag},` : `${tag},`;
    if (line && width(indent + candidate) > 78) {
      lines.push(line);
      line = `${tag},`;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line.replace(/,$/, ''));

  return lines.length === 1
    ? `array[${lines[0]}]`
    : `array[\n${lines.map((l) => `${indent}  ${l}`).join('\n')}\n${indent}]`;
}

const hours = (cafe) => (cafe.is_24h ? '24시간' : `${cafe.open_time}–${cafe.close_time}`);

const rows = cafes.map((cafe) => {
  const district = cafe.address.match(/(\S+구)\s/)?.[1] ?? null;
  const price = cafe.iced_americano_price.toLocaleString('en-US');

  return [
    `-- ${cafe.name} · ${district ?? '?'} · ${hours(cafe)} · ${price}원`,
    `(`,
    `  ${quote(cafe.id)}, ${quote(cafe.name)},`,
    `  ${quote(cafe.address)}, ${quote(district)},`,
    `  ${cafe.lat}, ${cafe.lng}, ${quote(cafe.naver_place_url)},`,
    `  ${quote(cafe.open_time)}, ${quote(cafe.close_time)}, ${cafe.is_24h}, ${cafe.iced_americano_price},`,
    `  ${quote(cafe.outlet)}, ${cafe.wifi}, ${quote(cafe.noise)}, ${quote(cafe.work_fit)},`,
    `  ${formatTags(cafe.tags, '  ')},`,
    `  'published', ${quote(cafe.last_verified)}`,
    `)`,
  ].join('\n');
});

writeFileSync(
  target,
  `-- ============================================================================
--  카공맵 — 카페 ${cafes.length}곳 시드
-- ----------------------------------------------------------------------------
--  원본은 data/cafes.json이다. 이 파일을 손으로 고치지 않는다.
--  재생성: node scripts/generate-seed.mjs
--
--  slug 충돌 시 아무것도 하지 않는다(do nothing). 이미 들어가 있는 행을 덮어써서
--  큐레이터가 Supabase에서 직접 고친 값을 되돌리는 사고를 막으려는 것이다.
-- ============================================================================

insert into public.places (
  slug, name,
  address, district,
  lat, lng, naver_place_url,
  open_time, close_time, is_24h, iced_americano_price,
  outlet, wifi, noise, work_fit,
  tags,
  status, last_verified
) values

${rows.join(',\n\n')}

on conflict (slug) do nothing;
`,
);

process.stderr.write(`✅ ${cafes.length}곳 → ${target.pathname.split('/').pop()}\n`);

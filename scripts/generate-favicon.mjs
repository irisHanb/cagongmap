/**
 * app/icon.svg → app/favicon.ico
 *
 * 마크 원본은 SVG 하나뿐이다(app/icon.svg). 최신 브라우저는 그걸 그대로 쓰지만,
 * 사파리 구버전과 슬랙 같은 링크 스크래퍼는 아직 /favicon.ico를 찾으므로 래스터가
 * 하나 더 필요하다. 손으로 그리면 두 파일이 어긋나므로 여기서 뽑는다.
 *
 * **마크를 고쳤을 때만 돌리면 된다.** 결과물(app/favicon.ico)은 커밋돼 있다.
 *
 *   node scripts/generate-favicon.mjs
 *
 * playwright가 있어야 한다. 이 저장소는 브라우저 검증에 playwright-cli를 쓰므로
 * (CLAUDE.md 「브라우저 검증」) 전역 설치본을 먼저 찾고, 없으면 로컬 의존성을 본다.
 */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** ico에 담을 크기. 16은 탭, 32는 고DPI 탭과 북마크, 48은 윈도우 바로가기다. */
const SIZES = [16, 32, 48];

/**
 * playwright는 CJS라 전역 설치본을 import하면 chromium이 named export가 아니라
 * default 아래에 붙는다. 두 모양을 다 받아 준다.
 */
async function loadChromium() {
  const candidates = [
    async () => import('playwright'),
    async () => {
      const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
      const entry = path.join(globalRoot, '@playwright/cli/node_modules/playwright/index.js');
      return import(pathToFileURL(entry).href);
    },
  ];

  for (const load of candidates) {
    try {
      const mod = await load();
      const chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) return chromium;
    } catch {
      /* 다음 후보로 */
    }
  }

  throw new Error(
    'playwright를 찾지 못했다. `npm i -g @playwright/cli` 또는 `npm i -D playwright` 뒤에 다시 돌린다.',
  );
}

/**
 * ICONDIR + ICONDIRENTRY[] + PNG 본문.
 *
 * 본문을 BMP가 아니라 PNG로 넣는 형식이다(Vista 이후). 요즘 브라우저와 스크래퍼는
 * 전부 읽고, 손으로 만들 수 있을 만큼 헤더가 단순하다.
 */
function packIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width (0 == 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // 팔레트 없음
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const chromium = await loadChromium();
const svg = await readFile(path.join(ROOT, 'app/icon.svg'), 'utf8');

// 시스템에 설치된 Chrome을 쓴다. playwright가 따로 받아 두는 headless shell은 버전이
// 어긋나 있기 쉽고, 아이콘 하나 뽑자고 수백 MB를 더 받을 이유가 없다.
const browser = await chromium.launch({ channel: 'chrome' });
const images = [];

for (const size of SIZES) {
  // deviceScaleFactor를 1로 두고 뷰포트를 목표 크기에 맞춘다. 브라우저가 그 해상도로
  // 직접 래스터라이즈해야 큰 그림을 줄일 때 생기는 뭉개짐이 없다.
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  images.push({ size, data: await page.screenshot({ omitBackground: true }) });
  await page.close();
}

await browser.close();

const out = path.join(ROOT, 'app/favicon.ico');
await writeFile(out, packIco(images));
console.log(`app/favicon.ico — ${SIZES.join('/')}px, ${(await readFile(out)).length}바이트`);

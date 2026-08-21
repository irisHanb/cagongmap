import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * 공유 카드 이미지. 카카오톡·슬랙·디스코드가 링크를 펼칠 때 이걸 가져간다.
 *
 * 파일 컨벤션이라 Next가 og:image·twitter:image 태그를 알아서 붙인다 — layout.tsx에서
 * images를 따로 적지 않는다.
 *
 * 데이터를 읽지 않으므로 빌드 때 한 번 만들어져 정적 파일로 나간다. 카페 수 같은
 * 바뀌는 값을 넣지 않은 이유가 그것이다 — 스크래퍼는 결과를 오래 캐시하므로 카드에
 * 든 숫자는 어차피 곧 옛 값이 된다.
 */
export const alt = '카공맵 — 노트북 작업하기 좋은 카페 지도';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** app/icon.svg와 같은 모양이다. 저쪽을 고치면 여기도 고친다. */
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7.5" fill="#88484a"/><path d="M16 4.4C11.97 4.4 8.7 7.67 8.7 11.7c0 6.2 7.3 15.9 7.3 15.9s7.3-9.7 7.3-15.9c0-4.03-3.27-7.3-7.3-7.3Z" fill="#fffef9"/><path d="M12.35 8.7h7.3l-.97 5.05q-.18.95-1.13.95h-3.1q-.95 0-1.13-.95Z" fill="#88484a"/></svg>`;

/**
 * satori는 woff2를 못 읽는다. 그래서 layout.tsx가 쓰는 dynamic subset(woff2)이 아니라
 * KS X 1001 subset woff를 쓴다. 카드에 든 글자는 전부 상용 한글이라 이걸로 충분하다.
 */
function pretendard(weight: 'Medium' | 'ExtraBold') {
  return readFile(
    path.join(
      process.cwd(),
      'node_modules/pretendard/dist/web/static/woff-subset',
      `Pretendard-${weight}.subset.woff`,
    ),
  );
}

export default async function Image() {
  const [medium, extraBold] = await Promise.all([pretendard('Medium'), pretendard('ExtraBold')]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '80px',
          background: '#fffaf8',
          fontFamily: 'Pretendard',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
          <img src={`data:image/svg+xml;base64,${Buffer.from(MARK).toString('base64')}`} width={116} height={116} alt="" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '0.12em', color: '#88484a' }}>
              WORK CAFE MAP
            </div>
            <div style={{ fontSize: 108, fontWeight: 800, color: '#211b1a', lineHeight: 1.15 }}>카공맵</div>
          </div>
        </div>

        {/* 줄바꿈을 직접 잡는다. satori는 한글을 글자 단위로 끊어서, 흘려보내면
            "지도에서 찾 / 습니다"처럼 낱말 가운데가 갈린다. */}
        <div
          style={{
            marginTop: 56,
            display: 'flex',
            flexDirection: 'column',
            fontSize: 48,
            fontWeight: 500,
            lineHeight: 1.4,
            color: '#5b504d',
          }}
        >
          <div>콘센트 · 와이파이 · 소음으로</div>
          <div>오래 앉아 작업하기 좋은 카페</div>
        </div>

        <div style={{ display: 'flex', flexGrow: 1 }} />

        <div style={{ display: 'flex', fontSize: 28, fontWeight: 800, letterSpacing: '0.08em', color: '#92817d' }}>
          송파 · 잠실 · 강남
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Pretendard', data: medium, weight: 500, style: 'normal' },
        { name: 'Pretendard', data: extraBold, weight: 800, style: 'normal' },
      ],
    },
  );
}

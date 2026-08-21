import { ImageResponse } from 'next/og';

/**
 * iOS 홈 화면 아이콘. icon.svg와 달리 **모서리를 둥글리지 않는다** — iOS가 자기 마스크를
 * 씌우므로 여기서 미리 깎으면 모서리가 두 번 잘린다.
 *
 * 같은 이유로 핀을 조금 작게 넣었다. iOS 마스크가 가장자리를 먹는다.
 */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#88484a',
        }}
      >
        <svg width="118" height="118" viewBox="0 0 32 32">
          <path
            d="M16 4.4C11.97 4.4 8.7 7.67 8.7 11.7c0 6.2 7.3 15.9 7.3 15.9s7.3-9.7 7.3-15.9c0-4.03-3.27-7.3-7.3-7.3Z"
            fill="#fffef9"
          />
          <path d="M12.35 8.7h7.3l-.97 5.05q-.18.95-1.13.95h-3.1q-.95 0-1.13-.95Z" fill="#88484a" />
        </svg>
      </div>
    ),
    size,
  );
}

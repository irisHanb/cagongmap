import { describe, expect, it } from 'vitest';
import { placeImagePath, placeImageUrl } from '@/lib/place-images';

/**
 * 경로 ↔ 공개 URL.
 *
 * 두 방향이 다 필요하다 — 화면은 URL을, 승인 스크립트는 파일을 옮기려고 경로를 쓴다.
 * 조립과 해체가 어긋나면 승인 때 "파일을 찾을 수 없다"로 나타난다.
 */
describe('placeImageUrl / placeImagePath', () => {
  it('경로를 공개 URL로 만든다', () => {
    expect(placeImageUrl('naruteo.jpeg')).toBe(
      'http://localhost:54321/storage/v1/object/public/place-images/naruteo.jpeg',
    );
  });

  it('URL에서 경로를 되짚는다', () => {
    const path = 'submissions/user-uuid/abc.png';
    expect(placeImagePath(placeImageUrl(path))).toBe(path);
  });

  it('이미 경로인 값은 그대로 둔다', () => {
    // 옛 데이터가 섞여 있어도 승인 스크립트가 멈추지 않게 한다.
    expect(placeImagePath('naruteo.jpeg')).toBe('naruteo.jpeg');
  });
});

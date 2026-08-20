import { describe, expect, it } from 'vitest';
import { toCafe } from '@/lib/cafes';
import { makePlaceRow } from '@/test/fixtures';

/**
 * places row → Cafe 변환. 이 저장소에 이 변환은 하나뿐이고, 카페 목록과 북마크
 * 목록이 같이 이것을 쓴다(CLAUDE.md — 북마크). 두 경로가 어긋나지 않으려면
 * 여기가 고정돼 있어야 한다.
 */
describe('toCafe', () => {
  it('앱 키로 uuid가 아니라 slug를 쓴다', () => {
    const cafe = toCafe(makePlaceRow({ slug: 'naruteo', id: 'a-uuid' }));
    expect(cafe.id).toBe('naruteo');
  });

  it('slug가 없는 카페는 uuid로 버틴다', () => {
    // 제보로 등록돼 아직 slug를 못 받은 행이 여기에 해당한다.
    const row = makePlaceRow({ slug: null, id: '11111111-2222-3333-4444-555555555555' });
    expect(toCafe(row).id).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('영업시간이 null이면 빈 문자열로 내린다', () => {
    // is_24h인 카페는 시간이 비어 있다. Cafe.open_time은 non-null이라 여기서 메운다.
    const row = makePlaceRow({ is_24h: true, open_time: null, close_time: null });
    const cafe = toCafe(row);
    expect(cafe.open_time).toBe('');
    expect(cafe.close_time).toBe('');
    expect(cafe.is_24h).toBe(true);
  });

  it('나머지 필드는 그대로 옮긴다', () => {
    const row = makePlaceRow({
      name: '테라로사',
      address: '서울 송파구 올림픽로 000',
      lat: 37.5,
      lng: 127.1,
      naver_place_url: 'https://map.naver.com/p/entry/place/123',
      iced_americano_price: 6000,
      outlet: 'some',
      wifi: false,
      noise: 'normal',
      work_fit: 'ok',
      photos: ['naruteo.jpeg'],
      tags: ['창가석', '넓은 테이블'],
      last_verified: '2026-08-15',
    });

    expect(toCafe(row)).toMatchObject({
      name: '테라로사',
      address: '서울 송파구 올림픽로 000',
      lat: 37.5,
      lng: 127.1,
      naver_place_url: 'https://map.naver.com/p/entry/place/123',
      iced_americano_price: 6000,
      outlet: 'some',
      wifi: false,
      noise: 'normal',
      work_fit: 'ok',
      // DB의 경로가 그대로 오지 않는다 — 아래 테스트가 그 변환을 본다
      tags: ['창가석', '넓은 테이블'],
      last_verified: '2026-08-15',
    });
  });

  it('사진 경로를 버킷 공개 URL로 바꾼다', () => {
    // DB에는 경로만 담는다. 프로젝트 ref가 데이터에 박히지 않게 하려는 것이고,
    // 그래서 URL 조립은 lib/place-images.ts 한 곳에서만 일어난다.
    const cafe = toCafe(makePlaceRow({ photos: ['naruteo.jpeg', 'submissions/uid/b.jpg'] }));

    expect(cafe.photos).toEqual([
      'http://localhost:54321/storage/v1/object/public/place-images/naruteo.jpeg',
      'http://localhost:54321/storage/v1/object/public/place-images/submissions/uid/b.jpg',
    ]);
  });

  it('사진이 없으면 빈 배열 그대로 둔다', () => {
    expect(toCafe(makePlaceRow({ photos: [] })).photos).toEqual([]);
  });

  it('가격이 확인되지 않은 카페는 null을 유지한다', () => {
    // 0원으로 메우면 화면이 "0원"이라고 말하게 된다. null이 정보다.
    expect(toCafe(makePlaceRow({ iced_americano_price: null })).iced_americano_price).toBeNull();
  });

  it('Cafe에 status 같은 places 전용 컬럼을 흘리지 않는다', () => {
    expect(toCafe(makePlaceRow())).not.toHaveProperty('status');
  });
});

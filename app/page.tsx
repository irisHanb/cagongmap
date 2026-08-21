import MapView from '@/components/map/MapView';
import { getCafes } from '@/lib/cafes';
import { websiteSchema } from '@/lib/schema';

/**
 * 큐레이션 데이터라 분 단위로 바뀌지 않는다. 5분마다 다시 만든다.
 * (cacheComponents를 쓰지 않으므로 이전 캐싱 모델의 세그먼트 설정이 그대로 유효하다)
 */
export const revalidate = 300;

export default async function Home() {
  const cafes = await getCafes();
  return (
    <>
      {/* 여기는 WebSite만 둔다. 카페 목록은 이 화면의 서버 렌더 콘텐츠가 아니라
          지도 위 마커라, ItemList는 실제로 목록이 있는 /cafes에 있다. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema()) }}
      />
      <MapView cafes={cafes} />
    </>
  );
}

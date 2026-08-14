import MapView from '@/components/map/MapView';
import { getCafes } from '@/lib/cafes';

/**
 * 큐레이션 데이터라 분 단위로 바뀌지 않는다. 5분마다 다시 만든다.
 * (cacheComponents를 쓰지 않으므로 이전 캐싱 모델의 세그먼트 설정이 그대로 유효하다)
 */
export const revalidate = 300;

export default async function Home() {
  const cafes = await getCafes();
  return <MapView cafes={cafes} />;
}

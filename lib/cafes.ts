import cafesJson from '@/data/cafes.json';
import type { Cafe } from '@/types/cafe';

/**
 * ★ 데이터 접근 계층 (교체 지점)
 *
 * 컴포넌트는 data/cafes.json을 직접 import하지 않고 반드시 이 파일을 통해서만
 * 카페 데이터를 얻는다. 나중에 로그인·제보(UGC)를 붙일 때 이 파일만 API 호출로
 * 갈아끼우면 컴포넌트를 건드릴 필요가 없다.
 *
 *   나중:  const res = await fetch('/api/cafes'); return res.json();
 *
 * 자세한 배경은 docs/implementation-plan.md 2-1 참고.
 */
export async function getCafes(): Promise<Cafe[]> {
  return cafesJson as Cafe[];
}

export async function getCafeById(id: string): Promise<Cafe | undefined> {
  const cafes = await getCafes();
  return cafes.find((cafe) => cafe.id === id);
}

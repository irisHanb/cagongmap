import MapView from '@/components/map/MapView';
import { getCafes } from '@/lib/cafes';

export default async function Home() {
  const cafes = await getCafes();
  return <MapView cafes={cafes} />;
}

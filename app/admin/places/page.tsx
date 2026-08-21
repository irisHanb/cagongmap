import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { guardAdminPage } from '@/lib/admin/guard';
import PageHeader from '@/components/admin/PageHeader';
import { PLACE_STATUS_LABEL } from '@/lib/admin/place-form';
import { listPlaces } from '@/lib/admin/places';
import { WORK_FIT_LABEL, type WorkFit } from '@/types/cafe';

export const metadata = { title: '장소' };

/**
 * 지도에 뜨는 장소 목록.
 *
 * **status로 거르지 않는다.** 공개 조회(`lib/cafes.ts`)는 published만 보지만, 여기서
 * draft가 안 보이면 만들다 만 카페를 다시 찾을 방법이 없다. 큐레이터 RLS 정책이
 * 이미 전부를 허용한다.
 *
 * 검색·필터를 두지 않는다. 카페가 9곳인 동안 그것은 `scope.md`가 2차로 미뤄둔
 * 공개 화면의 검색과 같은 이유로 이르다.
 */
export default async function PlacesPage() {
  await guardAdminPage();

  const places = await listPlaces();
  const published = places.filter((place) => place.status === 'published').length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="PLACES"
        title="장소"
        description={`카페 ${places.length}곳 · 지도에 뜨는 것은 ${published}곳입니다. 공개되지 않은 것까지 전부 보입니다.`}
        action={
          <Button asChild>
            <Link href="/admin/places/new">장소 추가</Link>
          </Button>
        }
      />

      {places.length === 0 ? (
        <p className="rounded-panel bg-surface-low px-6 py-12 text-center text-body text-on-surface-variant">
          아직 장소가 없어요.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-panel bg-surface-lowest shadow-brew">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16">사진</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>주소</TableHead>
                <TableHead className="w-24">상태</TableHead>
                <TableHead className="w-28">작업 적합도</TableHead>
                <TableHead className="w-28">확인일</TableHead>
                <TableHead className="w-16 text-right">사진</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {places.map((place) => (
                <TableRow key={place.id}>
                  <TableCell>
                    {place.thumbnail ? (
                      <Image
                        src={place.thumbnail}
                        alt=""
                        width={40}
                        height={40}
                        className="size-10 rounded-md border border-outline-variant object-cover"
                      />
                    ) : (
                      // 사진이 없는 카페는 자리만 비워 둔다. 점선 테두리로 "빠졌다"고
                      // 강조하지 않는다 — 빈 상태에 경고를 주지 않는 규칙과 같다.
                      <div className="size-10 rounded-md bg-surface-low" aria-label="사진 없음" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/places/${place.id}/edit`}
                      className="font-bold underline-offset-4 hover:underline"
                    >
                      {place.name}
                    </Link>
                    {place.slug && (
                      <span className="ml-2 text-meta text-on-surface-variant">{place.slug}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-on-surface-variant">{place.address}</TableCell>
                  <TableCell>
                    {PLACE_STATUS_LABEL[place.status]}
                    {/* 상태 이름만으로는 "지도에 뜨는가"가 읽히지 않는다. 운영자가
                        실제로 궁금해하는 것은 그것 하나다 */}
                    {place.status !== 'published' && (
                      <span className="block text-meta text-on-surface-variant">지도에 없음</span>
                    )}
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {place.workFit ? WORK_FIT_LABEL[place.workFit as WorkFit] : '—'}
                  </TableCell>
                  <TableCell className="tabular-nums text-on-surface-variant">
                    {place.lastVerified ?? '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-on-surface-variant">
                    {place.photoCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/admin/PageHeader';
import { guardAdminPage } from '@/lib/admin/guard';
import { getPlaceForEdit } from '@/lib/admin/places';
import { getSubmission } from '@/lib/admin/reports';
import { placeImageUrl } from '@/lib/place-images';
import PlaceForm, { type SubmissionReference } from '../../PlaceForm';

export const metadata = { title: '장소 수정' };

/**
 * 장소 수정.
 *
 * `?request=<id>`로 들어오면 그 수정 요청을 참고 자료로 보여주고, 저장할 때 승인까지 한다.
 * 요청에는 사진과 자유 메모뿐이라 무엇을 고칠지는 사람이 읽고 판단한다 —
 * 자동으로 반영할 구조화된 값이 없는 것이 이 테이블의 성질이다.
 *
 * 사진 경로를 여기서 공개 URL로 바꿔 넘긴다. 그래야 폼이 버킷을 모른다
 * (`lib/place-images.ts`의 규칙).
 */
export default async function EditPlacePage({
  params,
  searchParams,
}: PageProps<'/admin/places/[id]/edit'>) {
  await guardAdminPage();

  const { id } = await params;
  const sp = await searchParams;

  const place = await getPlaceForEdit(id);
  if (!place) notFound();

  const requestId = typeof sp.request === 'string' ? sp.request : undefined;
  const request = requestId ? await getSubmission('edit', requestId) : null;

  const reference: SubmissionReference | undefined = request
    ? {
        kind: 'edit',
        photos: request.photos,
        note: request.note,
        naverPlaceUrl: null,
        // 수정 요청은 대상 카페가 이미 있으므로 이름을 따로 받지 않는다.
        placeName: null,
        approvable: request.status === 'pending',
      }
    : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link
          href="/admin/places"
          className="text-meta text-on-surface-variant underline-offset-4 hover:text-on-surface hover:underline"
        >
          ← 장소 목록
        </Link>
        <PageHeader eyebrow="EDIT PLACE" title={place.name} />
      </div>

      <PlaceForm
        placeId={place.id}
        initialValues={place.values}
        initialPhotos={place.photos.map((path) => ({ path, url: placeImageUrl(path) }))}
        reference={reference}
        requestId={request?.status === 'pending' ? request.id : undefined}
      />
    </div>
  );
}

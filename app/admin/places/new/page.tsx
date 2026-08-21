import Link from 'next/link';
import PageHeader from '@/components/admin/PageHeader';
import { guardAdminPage } from '@/lib/admin/guard';
import { EMPTY_PLACE_FORM } from '@/lib/admin/place-form';
import { getSubmission } from '@/lib/admin/reports';
import PlaceForm, { type SubmissionReference } from '../PlaceForm';

export const metadata = { title: '장소 추가' };

/**
 * 장소 추가.
 *
 * `?report=<id>`로 들어오면 그 제보를 참고 자료로 보여주고, 저장할 때 승인까지 한다.
 *
 * **제보에서 폼으로 옮기는 것은 네이버 링크와 가게 이름 둘뿐이다.** 주소·좌표·
 * Quick Check는 제보에 없고, 사람이 확인해서 채우는 값이다(수기 큐레이션).
 * 옮기는 둘도 **제보자가 말한 값이지 확인된 값이 아니다** — 기본값으로 깔아 줄 뿐
 * 최종 판단은 큐레이터가 한다. 이름은 선택 입력이라 비어 있을 수 있다.
 */
export default async function NewPlacePage({ searchParams }: PageProps<'/admin/places/new'>) {
  await guardAdminPage();

  const sp = await searchParams;
  const reportId = typeof sp.report === 'string' ? sp.report : undefined;
  const report = reportId ? await getSubmission('report', reportId) : null;

  const reference: SubmissionReference | undefined = report
    ? {
        kind: 'report',
        photos: report.photos,
        note: report.note,
        naverPlaceUrl: report.naverPlaceUrl,
        placeName: report.placeName,
        approvable: report.status === 'pending',
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
        <PageHeader
          eyebrow="NEW PLACE"
          title="장소 추가"
          description="제보에는 이름·주소·좌표가 없습니다. 아래 내용을 보면서 직접 채웁니다."
        />
      </div>

      <PlaceForm
        initialValues={{
          ...EMPTY_PLACE_FORM,
          naver_place_url: report?.naverPlaceUrl ?? '',
          // 제보자가 적은 이름. 확인된 상호가 아니므로 큐레이터가 고칠 수 있게 두고,
          // 비어 있으면 그대로 빈 칸이다.
          name: report?.placeName ?? '',
        }}
        initialPhotos={[]}
        reference={reference}
        // 이미 처리된 건이면 승인을 다시 시도하지 않는다. 저장만 한다.
        reportId={report?.status === 'pending' ? report.id : undefined}
      />
    </div>
  );
}

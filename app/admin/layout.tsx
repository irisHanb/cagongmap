import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import { Toaster } from '@/components/ui/sonner';
import { getCurator } from '@/lib/admin/guard';
// ⚠️ Tailwind는 이 한 줄로만 들어온다. app/globals.css에 옮기지 말 것 —
//    preflight(전역 리셋)가 공개 화면의 지도 shell과 dock을 통째로 무너뜨린다.
import './admin.css';

export const metadata: Metadata = {
  title: '운영',
  // 루트 레이아웃이 이미 사이트 전체를 noindex로 두지만, 그 줄은 사진 권리가
  // 정리되면 지워질 줄이다. 관리자 화면은 그 뒤에도 색인되면 안 되므로 여기서 따로 막는다.
  robots: { index: false, follow: false },
};

/**
 * 관리자 셸 + 접근 제어.
 *
 * 큐레이터가 아니면 **404를 낸다.** 403이 아닌 이유는 관리자 화면의 존재 자체를
 * 알리지 않기 위해서다. 로그인하라는 안내도 하지 않는다 — 이 주소를 아는 사람은
 * 이미 큐레이터이거나, 알 이유가 없는 사람이다.
 *
 * ⚠️ 이 가드는 **서버 액션을 보호하지 않는다.** 액션은 레이아웃을 거치지 않는 별도
 *    POST 엔드포인트다. 액션마다 `requireCurator()`를 첫 줄에 둔다 (lib/admin/guard.ts).
 */
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const curator = await getCurator();
  if (!curator) notFound();

  return (
    <div className="min-h-dvh bg-surface font-sans text-on-surface antialiased">
      {/* 상단 바는 지도 dock과 같은 언어를 쓴다 — 밝은 표면, pill, 조용한 색 */}
      <header className="sticky top-0 z-10 border-b border-outline-variant bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:gap-6 sm:px-6 lg:px-8">
          <Link
            href="/admin/reports"
            className="shrink-0 text-label text-on-surface sm:text-section-title"
          >
            카공맵 운영
          </Link>
          <AdminNav />
          <div className="ml-auto flex items-center gap-2 text-body text-on-surface-variant sm:gap-4">
            {/* 좁은 화면에서는 이름을 뺀다. 누구로 로그인했는지는 지도로 돌아가면 dock이 말한다 */}
            <span className="hidden md:inline">{curator.nickname ?? '큐레이터'}</span>
            <Link
              href="/"
              className="flex h-10 shrink-0 items-center rounded-full px-6 transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              지도로
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">{children}</main>

      {/* 레이아웃에 한 번만 둔다. 페이지마다 두면 저장 뒤 목록으로 넘어갈 때
          토스트가 화면과 함께 사라진다 — 결과를 말해야 할 바로 그 순간에 */}
      <Toaster />
    </div>
  );
}

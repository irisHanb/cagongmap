import { redirect } from 'next/navigation';

/**
 * /admin 자체에는 보여줄 것이 없다. 운영은 대기 중 제보를 보는 것에서 시작하므로
 * 거기로 보낸다. 대시보드를 만들지 않는 것은 의도다 — 카페 9곳에 제보가 한 자릿수인
 * 동안 숫자 카드를 늘어놓는 것은 정보가 아니라 장식이다.
 */
export default function AdminIndexPage() {
  redirect('/admin/reports');
}

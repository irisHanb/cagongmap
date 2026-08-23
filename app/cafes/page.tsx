import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getCafes } from '@/lib/cafes';
import { formatBusinessHours } from '@/lib/openState';
import { cafeListSchema, jsonLdText, websiteSchema } from '@/lib/schema';
import { SITE_URL } from '@/lib/site';
import { NOISE_LABEL, OUTLET_LABEL, WORK_POLICY_LABEL } from '@/types/cafe';
import type { Cafe } from '@/types/cafe';

/** 지도와 같은 데이터를 쓰므로 캐시 주기도 같이 간다 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: '카페 목록',
  description: '카공맵이 확인한 카페 전체 목록. 콘센트·와이파이·소음·영업시간을 한자리에서 봅니다.',
  alternates: { canonical: '/cafes' },
};

/**
 * 카페 목록 — 지도가 아닌 유일한 화면이다 (DESIGN.md — Cafe List Page).
 *
 * 지도는 크롤러와 LLM에게 빈 화면이다. `/`가 서버에서 내보내는 본문 텍스트는 46자뿐이고
 * 카페 9곳은 전부 클라이언트에서 그려진다. 2026-08-21 SEO 감사가 지목한 근본 원인이
 * 그것이고(docs/seo-audit-2026-08-21/), 이 페이지가 그 해법이다.
 *
 * 그래서 여기는 **서버 컴포넌트다.** 'use client'를 붙이는 순간 이 페이지를 만든 이유가
 * 사라진다. 상호작용이 필요해지면 그 조각만 클라이언트 컴포넌트로 떼어낸다.
 *
 * ⚠️ 사이트 전체가 아직 noindex다(사진 이용 권리 미확인, layout.tsx). 이 페이지도
 * 예외가 아니므로 지금 당장 검색 노출은 없다. 사진을 교체해 그 줄을 지우는 날 함께 열린다.
 */
export default async function CafesPage() {
  const cafes = await getCafes();
  const url = `${SITE_URL}/cafes`;

  return (
    <main className="cafe-list">
      {/* 목록이 실제로 있는 화면에만 ItemList를 둔다. 페이지에 없는 것을 마크업하지 않는다 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdText([websiteSchema(), cafeListSchema(cafes, url)]),
        }}
      />

      <header className="cafe-list__head">
        <p className="eyebrow">WORK CAFE MAP</p>
        <h1>카페 목록</h1>
        <p className="cafe-list__sub">
          카공맵이 직접 확인한 {cafes.length}곳입니다. 콘센트·와이파이·소음을 기준으로
          오래 앉아 작업하기 좋은지 봅니다.
        </p>
        <Link href="/" className="cafe-list__back">
          지도로 보기
        </Link>
      </header>

      <ol className="cafe-list__items">
        {cafes.map((cafe) => (
          <li key={cafe.id}>
            <CafeEntry cafe={cafe} />
          </li>
        ))}
      </ol>
    </main>
  );
}

/**
 * 카페 한 곳. 이름 → 주소 → 속성 문장 → 확인일 순서다.
 *
 * 상세 패널(사진이 먼저)과 순서가 다른 것은 의도한 것이다. 여기는 읽는 화면이라
 * 이름이 먼저 와야 한다 (DESIGN.md — Cafe List Page).
 */
function CafeEntry({ cafe }: { cafe: Cafe }) {
  // 크롤러가 읽는 것은 chip이 아니라 문장이다. 값을 문장으로 잇는 이유가 그것이다.
  const traits = [
    OUTLET_LABEL[cafe.outlet],
    cafe.wifi ? '와이파이 있음' : '와이파이 없음',
    NOISE_LABEL[cafe.noise],
    ...(cafe.work_policy ? [WORK_POLICY_LABEL[cafe.work_policy]] : []),
  ].join(' · ');

  return (
    <article className="cafe-entry">
      {/* 목록의 주인공은 사진이 아니라 글이다. 카페당 한 장까지만 둔다 */}
      {cafe.photos.length > 0 && (
        <Image
          className="cafe-entry__photo"
          src={cafe.photos[0]}
          alt=""
          width={112}
          height={112}
          sizes="112px"
        />
      )}

      <div className="cafe-entry__body">
        <h2 className="cafe-entry__name">{cafe.name}</h2>
        <p className="cafe-entry__address">{cafe.address}</p>
        <p className="cafe-entry__traits">{traits}</p>
        <p className="cafe-entry__hours">{formatBusinessHours(cafe)}</p>
        {cafe.tags.length > 0 && <p className="cafe-entry__tags">{cafe.tags.join(' · ')}</p>}
        {/* 신선도를 숨기지 않는다 (mvp-decisions.md 2-3) */}
        <p className="cafe-entry__verified">확인일 {cafe.last_verified}</p>
      </div>
    </article>
  );
}

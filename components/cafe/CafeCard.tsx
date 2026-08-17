'use client';

import type { ReactNode } from 'react';
import type { Cafe } from '@/types/cafe';
import { NOISE_LABEL, OUTLET_LABEL } from '@/types/cafe';
import { formatBusinessHours, isOpenNow } from '@/lib/openState';
import BookmarkButton from '@/components/bookmark/BookmarkButton';
import PhotoCarousel from './PhotoCarousel';
import {
  HoursIcon,
  NoiseIcon,
  OutletIcon,
  PriceIcon,
  WifiIcon,
} from './QuickCheckIcons';

interface CafeCardProps {
  cafe: Cafe;
  onClose: () => void;
}

interface Fact {
  label: string;
  value: string;
  icon: ReactNode;
  /** 좋은 조건일 때만 색이 든다 — 민트 배경 + positive-text */
  positive: boolean;
}

/**
 * 카페 상세 — 데스크톱에서는 지도 위 우측 패널, 모바일에서는 하단 시트다.
 * 어느 쪽이든 같은 마크업이고 위치만 CSS가 가른다.
 *
 * 구성 순서는 DESIGN.md를 따른다: 사진 → 주소 → 이름 → 지도 링크 → Quick Check
 * → 힌트. 주소가 이름보다 위에 오는 것은 의도된 순서다.
 *
 * 확인일은 DESIGN.md 순서에 없지만 맨 아래에 남긴다 — 데이터 신선도 노출은
 * mvp-decisions.md 2-3의 구속력 있는 결정이다.
 *
 * work_fit("작업 적합도")은 여기 넣지 않는다. 추상 평가 대신 실제 판단 신호를
 * Quick Check에 모으라는 것이 DESIGN.md의 지시이고, work_fit은 마커 테두리 색으로만 쓴다.
 */
export default function CafeCard({ cafe, onClose }: CafeCardProps) {
  const open = isOpenNow(cafe);

  const facts: Fact[] = [
    {
      label: '콘센트',
      value: OUTLET_LABEL[cafe.outlet],
      icon: <OutletIcon />,
      positive: cafe.outlet === 'many',
    },
    {
      label: '소음',
      value: NOISE_LABEL[cafe.noise],
      icon: <NoiseIcon />,
      positive: cafe.noise === 'quiet',
    },
    {
      label: '와이파이',
      value: cafe.wifi ? '있음' : '없음',
      icon: <WifiIcon />,
      positive: cafe.wifi,
    },
    {
      label: '아메리카노',
      value:
        cafe.iced_americano_price === null
          ? '확인 안 됨'
          : `${cafe.iced_americano_price.toLocaleString()}원`,
      icon: <PriceIcon />,
      // 얼마가 싼지 기준이 없다. 가격은 늘 중립으로 둔다.
      positive: false,
    },
    {
      label: '영업시간',
      value: `${open ? '영업중' : '영업종료'} · ${formatBusinessHours(cafe)}`,
      icon: <HoursIcon />,
      positive: open,
    },
  ];

  return (
    <aside className="cafe-panel" aria-label={`${cafe.name} 상세`}>
      <button type="button" className="cafe-panel__close" onClick={onClose} aria-label="닫기">
        ×
      </button>

      <PhotoCarousel photos={cafe.photos} name={cafe.name} />

      <div className="cafe-panel__body">
        <p className="cafe-panel__address">{cafe.address}</p>
        {/* 하트는 이름과 같은 줄이다. DESIGN.md의 상세 구성 순서에 항목을 새로
            끼워 넣지 않으려고 3번(카페명) 안에 넣었다. */}
        <div className="cafe-panel__name-row">
          <h2 className="cafe-panel__name">{cafe.name}</h2>
          <BookmarkButton cafe={cafe} />
        </div>

        {cafe.naver_place_url && (
          <a
            className="naver-link"
            href={cafe.naver_place_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="naver-link__mark" aria-hidden="true">
              N
            </span>
            지도에서 보기
          </a>
        )}

        <section className="quick-check">
          <h3 className="eyebrow">QUICK CHECK</h3>
          <ul className="fact-grid">
            {facts.map((fact) => (
              <li
                key={fact.label}
                className={`fact${fact.positive ? ' fact--positive' : ''}`}
              >
                <span className="fact__icon">{fact.icon}</span>
                <span className="fact__text">
                  <span className="fact__label">{fact.label}</span>
                  <span className="fact__value">{fact.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {cafe.tags.length > 0 && (
          <ul className="cafe-panel__hints">
            {cafe.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}

        {/* 데이터 신선도를 숨기지 않고 드러낸다 (docs/mvp-decisions.md 2-3) */}
        <p className="cafe-panel__verified">{cafe.last_verified} 확인</p>
      </div>
    </aside>
  );
}

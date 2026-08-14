'use client';

import type { Cafe } from '@/types/cafe';
import { NOISE_LABEL, OUTLET_LABEL, WORK_FIT_LABEL } from '@/types/cafe';
import { formatBusinessHours, isOpenNow } from '@/lib/openState';
import PhotoCarousel from './PhotoCarousel';

interface CafeCardProps {
  cafe: Cafe;
  onClose: () => void;
}

/**
 * 카페 상세 — 데스크톱에서는 지도 오른쪽 패널, 모바일에서는 지도 아래에서 올라오는
 * 시트로 뜬다. 어느 쪽이든 같은 마크업이고 위치만 CSS가 가른다.
 *
 * 사진을 크게 보여주려고 마커 위 말풍선에서 패널로 옮겼다. 320px 말풍선 안에서는
 * 사진이 우표만 해지고, 슬라이드로 넘길 자리도 나오지 않는다.
 *
 * 사진은 패널 위에 고정하고 스펙만 스크롤한다 — 아래를 읽는 동안에도 어느 카페를
 * 보고 있는지 사진이 계속 알려준다.
 */
export default function CafeCard({ cafe, onClose }: CafeCardProps) {
  const open = isOpenNow(cafe);

  return (
    <aside className="cafe-panel" aria-label={`${cafe.name} 상세`}>
      <button type="button" className="cafe-panel__close" onClick={onClose} aria-label="닫기">
        ×
      </button>

      <PhotoCarousel photos={cafe.photos} name={cafe.name} />

      <div className="cafe-panel__body">
        <h2 className="cafe-panel__name">{cafe.name}</h2>
        <p className="cafe-panel__address">{cafe.address}</p>

        <div className="cafe-panel__badges">
          <span className={`badge ${open ? 'badge--open' : 'badge--closed'}`}>
            {open ? '영업중' : '영업종료'}
          </span>
          <span className="badge">{formatBusinessHours(cafe)}</span>
        </div>

        <dl className="cafe-panel__specs">
          <div>
            <dt>콘센트</dt>
            <dd>{OUTLET_LABEL[cafe.outlet]}</dd>
          </div>
          <div>
            <dt>와이파이</dt>
            <dd>{cafe.wifi ? '있음' : '없음'}</dd>
          </div>
          <div>
            <dt>소음</dt>
            <dd>{NOISE_LABEL[cafe.noise]}</dd>
          </div>
          <div>
            <dt>작업 적합도</dt>
            <dd>{WORK_FIT_LABEL[cafe.work_fit]}</dd>
          </div>
          <div>
            <dt>아이스 아메리카노</dt>
            <dd>
              {cafe.iced_americano_price === null
                ? '확인 안 됨'
                : `${cafe.iced_americano_price.toLocaleString()}원`}
            </dd>
          </div>
        </dl>

        {cafe.tags.length > 0 && (
          <ul className="cafe-panel__tags">
            {cafe.tags.map((tag) => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        )}

        {cafe.naver_place_url && (
          <a
            className="cafe-panel__link"
            href={cafe.naver_place_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            네이버 플레이스에서 보기 →
          </a>
        )}

        {/* 데이터 신선도를 숨기지 않고 드러낸다 (docs/mvp-decisions.md 2-3) */}
        <p className="cafe-panel__verified">{cafe.last_verified} 확인</p>
      </div>
    </aside>
  );
}

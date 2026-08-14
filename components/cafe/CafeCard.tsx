'use client';

import type { Cafe } from '@/types/cafe';
import { NOISE_LABEL, OUTLET_LABEL, WORK_FIT_LABEL } from '@/types/cafe';
import { formatBusinessHours, isOpenNow } from '@/lib/openState';

interface CafeCardProps {
  cafe: Cafe;
  onClose: () => void;
}

export default function CafeCard({ cafe, onClose }: CafeCardProps) {
  const open = isOpenNow(cafe);

  return (
    <aside className="cafe-card">
      <button type="button" className="cafe-card__close" onClick={onClose} aria-label="닫기">
        ×
      </button>

      <h2 className="cafe-card__name">{cafe.name}</h2>
      <p className="cafe-card__address">{cafe.address}</p>

      <div className="cafe-card__badges">
        <span className={`badge ${open ? 'badge--open' : 'badge--closed'}`}>
          {open ? '영업중' : '영업종료'}
        </span>
        <span className="badge">{formatBusinessHours(cafe)}</span>
      </div>

      <dl className="cafe-card__specs">
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
        <ul className="cafe-card__tags">
          {cafe.tags.map((tag) => (
            <li key={tag}>#{tag}</li>
          ))}
        </ul>
      )}

      {cafe.naver_place_url && (
        <a
          className="cafe-card__link"
          href={cafe.naver_place_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          네이버 플레이스에서 보기 →
        </a>
      )}

      {/* 데이터 신선도를 숨기지 않고 드러낸다 (docs/mvp-decisions.md 2-3) */}
      <p className="cafe-card__verified">{cafe.last_verified} 확인</p>
    </aside>
  );
}

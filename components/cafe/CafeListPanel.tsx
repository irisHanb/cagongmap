'use client';

import Image from 'next/image';
import type { Cafe } from '@/types/cafe';
import { NOISE_LABEL, OUTLET_LABEL } from '@/types/cafe';
import { formatBusinessHours } from '@/lib/openState';
import BookmarkButton from '@/components/bookmark/BookmarkButton';
import { HoursIcon, NoiseIcon, OutletIcon } from './QuickCheckIcons';

/**
 * dock 하단의 카페 전체 목록 (DESIGN.md — Left Panel 8번).
 *
 * 북마크 패널과 달리 사진과 chip을 단다. 저장 목록은 "내가 고른 것을 다시 찾는" 자리라
 * 이름만으로 충분하지만, 이쪽은 아직 고르지 않은 카페를 고르는 자리라 판단에 쓰는 값이
 * 카드에 있어야 한다.
 *
 * chip은 셋으로 고정한다 — 콘센트 · 운영시간 · 소음. Quick Check의 여섯 값을 그대로
 * 옮기면 상세를 열 이유가 사라지고 dock이 상세 패널의 축소판이 된다.
 *
 * 영업 여부(isOpenNow)는 여기에 넣지 않는다. 시계를 읽는 값이라 서버 렌더와 클라이언트
 * 렌더가 갈리면 하이드레이션이 깨진다. 상세 패널은 클릭한 뒤에만 그려져서 안전하지만
 * 이 목록은 첫 화면에 함께 렌더된다.
 */
/**
 * 카드에 다는 값 셋. 화면의 chip과 버튼의 aria-label이 같은 배열에서 나온다 —
 * 따로 적으면 chip을 고칠 때 읽어 주는 말이 뒤처진다.
 */
function chipsOf(cafe: Cafe) {
  return [
    { icon: <OutletIcon />, value: OUTLET_LABEL[cafe.outlet] },
    { icon: <HoursIcon />, value: formatBusinessHours(cafe) },
    { icon: <NoiseIcon />, value: NOISE_LABEL[cafe.noise] },
  ];
}

export default function CafeListPanel({
  cafes,
  onSelect,
}: {
  cafes: Cafe[];
  onSelect: (cafe: Cafe) => void;
}) {
  return (
    <section className="cafe-list-panel" aria-label="카페 전체 목록">
      <p className="eyebrow">ALL CAFES</p>
      <h2 className="cafe-list-panel__title">
        카페 전체
        <span className="cafe-list-panel__count">{cafes.length}</span>
      </h2>

      <ul className="dock-cafe-list">
        {cafes.map((cafe) => {
          const chips = chipsOf(cafe);
          return (
          <li key={cafe.id} className="dock-cafe">
            {/* 카드 전체가 상세를 여는 버튼이다. 하트는 그 안이 아니라 형제로 둔다 —
                button 안에 button을 넣을 수 없다.

                aria-label을 직접 단다. 안 달면 span 넷이 띄어쓰기 없이 이어 붙어
                "나루터서울 송파구 000콘센트 많음09:00 - 22:00조용함"으로 읽힌다. */}
            <button
              type="button"
              className="dock-cafe__open"
              onClick={() => onSelect(cafe)}
              aria-label={[cafe.name, cafe.address, ...chips.map((chip) => chip.value)].join(', ')}
            >
              {cafe.photos.length > 0 ? (
                <Image
                  className="dock-cafe__photo"
                  src={cafe.photos[0]}
                  alt=""
                  width={64}
                  height={64}
                  sizes="64px"
                />
              ) : (
                // 사진이 없어도 자리를 비우지 않는다. 빠지면 카드마다 글이 다른 자리에서
                // 시작한다.
                <span className="dock-cafe__photo dock-cafe__photo--empty" aria-hidden="true" />
              )}

              <span className="dock-cafe__body">
                <span className="dock-cafe__name">{cafe.name}</span>
                <span className="dock-cafe__address">{cafe.address}</span>
              </span>

              {/* 이름·주소 칸이 아니라 카드 전체 폭을 쓴다. 좁은 칸에 가두면 chip 셋이
                  두 줄로 접힌다 (globals.css .dock-cafe__open) */}
              <span className="dock-cafe__chips">
                {chips.map((chip) => (
                  <span key={chip.value} className="dock-chip">
                    {chip.icon}
                    {chip.value}
                  </span>
                ))}
              </span>
            </button>

            <BookmarkButton cafe={cafe} />
          </li>
          );
        })}
      </ul>
    </section>
  );
}

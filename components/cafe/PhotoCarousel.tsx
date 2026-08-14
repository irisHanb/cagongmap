'use client';

import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';

interface PhotoCarouselProps {
  photos: string[];
  /** alt 텍스트에 쓸 카페 이름 */
  name: string;
}

/**
 * 상세 패널 맨 위의 사진 슬라이드.
 *
 * 좌우 이동을 transform이 아니라 스크롤 컨테이너 + scroll-snap으로 만든다.
 * 그래야 모바일에서 손가락 스와이프가 공짜로 따라오고, 데스크톱에서는 화살표
 * 버튼이 같은 스크롤을 움직인다. 현재 위치도 스크롤 한 곳에서만 읽으므로
 * 버튼으로 넘길 때와 스와이프할 때의 인덱스가 어긋나지 않는다.
 */
export default function PhotoCarousel({ photos, name }: PhotoCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // 스크롤이 멎은 자리에서 인덱스를 다시 계산한다. smooth 스크롤 중에도 계속
  // 불리지만 반올림한 값이라 슬라이드 절반을 넘어야 바뀐다.
  const handleScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  }, []);

  const go = useCallback((to: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: track.clientWidth * to, behavior: 'smooth' });
  }, []);

  // 사진이 없는 카페 — 빈 상태. 자리를 없애지 않고 "없음"을 드러낸다.
  if (photos.length === 0) {
    return (
      <div className="photo-carousel photo-carousel--empty">
        <p>등록된 사진이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="photo-carousel">
      <div className="photo-carousel__track" ref={trackRef} onScroll={handleScroll}>
        {photos.map((url, i) => (
          // 같은 URL이 두 번 들어가도 깨지지 않게 자리로 키를 잡는다.
          // 슬라이드의 정체성은 URL이 아니라 순서다.
          <div className="photo-carousel__slide" key={i}>
            <Image
              src={url}
              alt={`${name} 사진 ${i + 1}`}
              fill
              // 데스크톱 패널 폭(360px)과 모바일 전체 폭 두 갈래뿐이다.
              sizes="(max-width: 899px) 100vw, 360px"
              className="photo-carousel__image"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            className="photo-carousel__nav photo-carousel__nav--prev"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="이전 사진"
          >
            ‹
          </button>
          <button
            type="button"
            className="photo-carousel__nav photo-carousel__nav--next"
            onClick={() => go(index + 1)}
            disabled={index === photos.length - 1}
            aria-label="다음 사진"
          >
            ›
          </button>
        </>
      )}

      <p className="photo-carousel__count" aria-live="polite">
        {index + 1} / {photos.length}
      </p>
    </div>
  );
}

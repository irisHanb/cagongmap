'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HAS_KAKAO_KEY, KAKAO_SDK_URL } from '@/lib/kakao-sdk';

/**
 * 위치 고르기 — **가게 이름으로 검색해서 고른다.**
 *
 * 원래는 주소를 치고 지오코딩하거나 지도를 눌러 좌표를 찍는 방식이었는데, 운영자가
 * 실제로 아는 것은 주소가 아니라 **가게 이름**이다. 제보에도 이름 대신 네이버 링크만
 * 온다. 그래서 `Places.keywordSearch`를 1차 경로로 두고, 지도 클릭은 검색 결과의
 * 좌표가 미세하게 어긋날 때 손으로 고치는 보조 수단으로 남겼다.
 *
 * **`components/map/KakaoMap.tsx`를 재사용하지 않는다.** 그쪽은 100dvh 풀스크린
 * Map Shell 전용이라 폼 안에 들어가지 않는다. 지도 인스턴스만 따로 만들되
 * **스크립트 주소는 공유한다** — `window.kakao`가 문서당 하나뿐이라 URL이 갈리면
 * 먼저 로드된 쪽만 살아남는다 (`lib/kakao-sdk.ts`의 주석에 그때 깨진 경로가 있다).
 *
 * 새 라이브러리를 넣지 않았다. 검색도 지오코딩도 이미 싣고 있는
 * `libraries=services` 안에 들어 있다.
 */

/** 송리단길. 새 카페를 만들 때 지도가 여기서 시작한다 (docs/mvp-decisions.md) */
const DEFAULT_CENTER = { lat: 37.5078, lng: 127.1072 };

/** 한 번에 보여줄 검색 결과. 15가 API 상한이고, 그보다 길면 목록이 지도를 밀어낸다 */
const RESULT_SIZE = 10;

/**
 * 근처 우선 검색 반경(m). 카카오 상한이 20km다.
 *
 * 송리단길에서 20km면 서울 전체와 강남이 들어온다. 이 서비스의 권역이 송파·잠실이고
 * 강남 두 곳이 예외라(docs/mvp-decisions.md) 딱 맞는 크기다. **거르는 것이 아니라
 * 순서를 주는 것이다** — 여기서 못 찾으면 곧바로 전국을 다시 훑는다.
 */
const NEARBY_RADIUS = 20000;

export interface LocationValue {
  lat: string;
  lng: string;
}

/** 검색 결과와 주소 검색 결과를 한 모양으로 눕힌 것 */
interface Candidate {
  key: string;
  name: string;
  address: string;
  lat: string;
  lng: string;
}

/** ⚠️ x가 경도, y가 위도다. 문자열로 오므로 숫자로 만들지 않고 그대로 폼 값으로 쓴다 */
function fromPlace(place: kakao.maps.services.PlacesSearchResult): Candidate {
  return {
    key: place.id,
    name: place.place_name,
    // 도로명이 없는 곳이 있다. 그때는 지번으로 떨어진다.
    address: place.road_address_name || place.address_name,
    lat: place.y,
    lng: place.x,
  };
}

function fromAddress(item: kakao.maps.services.AddressSearchResult, index: number): Candidate {
  return {
    key: `address-${index}`,
    name: item.address_name,
    address: item.address_name,
    lat: item.y,
    lng: item.x,
  };
}

export default function LocationPicker({
  value,
  address,
  onChange,
  onAddressFound,
  disabled,
}: {
  value: LocationValue;
  /** 폼의 현재 주소. 검색창의 처음 값으로만 쓴다 */
  address: string;
  onChange: (next: LocationValue) => void;
  /** 좌표와 함께 주소도 채운다 */
  onAddressFound: (address: string) => void;
  disabled: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const markerRef = useRef<kakao.maps.Marker | null>(null);
  const placesRef = useRef<kakao.maps.services.Places | null>(null);
  const geocoderRef = useRef<kakao.maps.services.Geocoder | null>(null);

  const [ready, setReady] = useState(false);
  /**
   * 검색을 쓸 수 있는가. `libraries=services` 없이 로드된 SDK가 이미 전역에 올라와
   * 있으면 false다 — 그 상황에서 `new services.Places()`를 부르면 화면이 통째로
   * 에러 경계로 떨어진다. **좌표 찍기는 검색 없이도 되므로 검색만 접고 지도는 살린다.**
   */
  const [hasSearch, setHasSearch] = useState(false);

  // 검색창은 주소 칸과 별개다. 운영자가 치는 것은 대개 가게 이름이라 주소 칸에
  // 그것을 넣게 하면 안 된다. 수정 화면에서는 이미 있는 주소로 시작한다.
  const [query, setQuery] = useState(address);
  const [results, setResults] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [searching, setSearching] = useState(false);
  /** 지도를 눌러 찍은 지점의 주소. 버튼을 눌러야 주소 칸에 들어간다 */
  const [clickedAddress, setClickedAddress] = useState<string | null>(null);

  /**
   * 콜백을 ref에 담아 둔다. 지도 초기화 effect가 이것을 의존성으로 들면 부모가
   * 렌더될 때마다 지도를 부수고 다시 만든다 — 폼은 글자 하나 칠 때마다 렌더된다.
   */
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;

    window.kakao.maps.load(() => {
      const container = containerRef.current;
      if (!container || mapRef.current) return;

      const start = new window.kakao.maps.LatLng(
        Number(value.lat) || DEFAULT_CENTER.lat,
        Number(value.lng) || DEFAULT_CENTER.lng,
      );

      const map = new window.kakao.maps.Map(container, { center: start, level: 4 });
      const marker = new window.kakao.maps.Marker({ position: start, map });

      // services는 있다고 가정하지 않는다. 위 주석 참고 — 전역이 하나라 이미 다른
      // URL로 로드돼 있으면 없을 수 있고, 그때 던지면 폼 전체가 사라진다.
      const services = window.kakao.maps.services;
      const geocoder = services ? new services.Geocoder() : null;

      window.kakao.maps.event.addListener<kakao.maps.MapMouseEvent>(map, 'click', (event) => {
        const point = event.latLng;
        marker.setPosition(point);
        // 소수점 여섯 자리면 10cm 남짓이다. 그 아래는 지도 클릭의 정밀도를 넘는다.
        onChangeRef.current({
          lat: point.getLat().toFixed(6),
          lng: point.getLng().toFixed(6),
        });

        if (!geocoder || !services) return;
        geocoder.coord2Address(point.getLng(), point.getLat(), (result, status) => {
          if (status !== services.Status.OK || result.length === 0) {
            setClickedAddress(null);
            return;
          }
          const found = result[0].road_address?.address_name ?? result[0].address?.address_name;
          setClickedAddress(found ?? null);
        });
      });

      mapRef.current = map;
      markerRef.current = marker;
      geocoderRef.current = geocoder;
      placesRef.current = services ? new services.Places() : null;
      setReady(true);
      setHasSearch(services !== undefined);
    });
    // value는 첫 중심을 잡는 데만 쓴다. 의존성에 넣으면 좌표가 바뀔 때마다 지도를
    // 다시 만들어 사용자가 옮겨 둔 화면이 튄다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 스크립트가 이미 로드된 뒤 마운트되는 경우(같은 탭에서 폼을 다시 열 때) 대비.
  useEffect(() => {
    if (!mapRef.current && typeof window !== 'undefined' && window.kakao?.maps) {
      initMap();
    }
  }, [initMap]);

  /** 좌표가 폼 쪽에서 바뀌면(검색 결과 선택·직접 입력) 마커와 중심을 따라가게 한다 */
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    const lat = Number(value.lat);
    const lng = Number(value.lng);
    if (!value.lat || !value.lng || Number.isNaN(lat) || Number.isNaN(lng)) return;

    const point = new window.kakao.maps.LatLng(lat, lng);
    marker.setPosition(point);
    map.setCenter(point);
  }, [value.lat, value.lng]);

  /**
   * 검색. 세 번까지 시도한다.
   *
   *  1. **지도 중심 20km 안에서 키워드로.** 권역이 송파·잠실이라 전국 정확도순으로
   *     받으면 같은 이름의 다른 동네 가게가 먼저 온다(`나루터 카페`의 1순위는
   *     수원이었다). 거르는 것이 아니라 순서를 주는 것이다.
   *  2. **전국에서 키워드로.** 1번이 비면 곧바로 넓힌다. 권역 밖 가게를 등록하는
   *     날에도 막히지 않아야 한다.
   *  3. **주소로.** 운영자가 가게 이름 대신 주소를 붙여넣는 경우가 있다. 검색창을
   *     둘로 나누는 대신 이쪽이 알아서 넘어간다.
   *
   * 콜백을 promise로 감싸 세 단계를 평평하게 썼다. 중첩해서 쓰면 실패 분기가
   * 세 겹이 되고, 어느 단계에서 비었는지 읽을 수 없게 된다.
   */
  const search = () => {
    const keyword = query.trim();
    setPicked(null);

    if (keyword === '') {
      toast('무엇을 찾을까요', { description: '카페 이름이나 주소를 넣어주세요' });
      return;
    }

    const places = placesRef.current;
    const geocoder = geocoderRef.current;
    const services = window.kakao?.maps?.services;
    if (!places || !services) return;

    const byKeyword = (options: kakao.maps.services.KeywordSearchOptions) =>
      new Promise<Candidate[]>((resolve) => {
        places.keywordSearch(
          keyword,
          (data, status) => resolve(status === services.Status.OK ? data.map(fromPlace) : []),
          options,
        );
      });

    const byAddress = () =>
      new Promise<Candidate[]>((resolve) => {
        if (!geocoder) {
          resolve([]);
          return;
        }
        geocoder.addressSearch(keyword, (data, status) =>
          resolve(status === services.Status.OK ? data.map(fromAddress) : []),
        );
      });

    setSearching(true);
    void (async () => {
      const center = mapRef.current?.getCenter();

      let found = center
        ? await byKeyword({ size: RESULT_SIZE, location: center, radius: NEARBY_RADIUS })
        : [];
      if (found.length === 0) found = await byKeyword({ size: RESULT_SIZE });
      if (found.length === 0) found = await byAddress();

      setResults(found);
      if (found.length === 0) {
        toast(`«${keyword}»를 찾지 못했어요`, { description: '지도를 눌러 직접 찍어주세요' });
      }
      setSearching(false);
    })();
  };

  /** 결과를 고르면 좌표와 주소가 폼에 들어간다. 지도는 위 effect가 따라온다 */
  const pick = (candidate: Candidate) => {
    setPicked(candidate);
    setResults([]);
    setClickedAddress(null);
    onChange({ lat: candidate.lat, lng: candidate.lng });
    onAddressFound(candidate.address);
    // 고른 뒤에는 가게가 보이는 배율까지 당긴다. 목록에서 고른 것과 지도에 찍힌 것이
    // 같은 곳인지 확인할 수 있어야 한다.
    mapRef.current?.setLevel(3);
  };

  /**
   * 키가 없으면 숫자 두 칸으로 떨어진다. **의도된 폴백이지 깨진 화면이 아니다** —
   * 공개 지도가 안내 문구로 떨어지는 것과 같은 규칙이고, 여기서는 그 상태로도
   * 장소를 저장할 수 있어야 한다.
   */
  return (
    <div className="space-y-4">
      {HAS_KAKAO_KEY && <Script src={KAKAO_SDK_URL} strategy="afterInteractive" onReady={initMap} />}

      {HAS_KAKAO_KEY && hasSearch && (
        <div className="space-y-2">
          <Label htmlFor="place-search">가게 검색</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="place-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                // 검색창에서 Enter는 검색이지 폼 제출이 아니다. 폼에 submit 핸들러가
                // 없어도 브라우저 기본 동작이 끼어들 수 있어 막아 둔다.
                if (event.key === 'Enter') {
                  event.preventDefault();
                  search();
                }
              }}
              disabled={disabled || !ready || searching}
              placeholder="나루터 카페"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={search}
              disabled={disabled || !ready || searching}
              className="sm:shrink-0"
            >
              {searching ? '찾는 중…' : '검색'}
            </Button>
          </div>

          {results.length > 0 && (
            <ul className="max-h-64 divide-y divide-outline-variant overflow-y-auto rounded-md border border-outline-variant bg-surface-lowest">
              {results.map((candidate) => (
                <li key={candidate.key}>
                  <button
                    type="button"
                    onClick={() => pick(candidate)}
                    disabled={disabled}
                    className="w-full px-4 py-2 text-left transition-colors hover:bg-surface-low focus-visible:bg-surface-low focus-visible:outline-none"
                  >
                    <span className="block text-body font-bold">{candidate.name}</span>
                    <span className="block text-meta text-on-surface-variant">
                      {candidate.address}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {picked && (
            <p className="text-meta text-on-surface-variant">
              <span className="font-bold text-on-surface">{picked.name}</span> · 좌표와 주소를 채웠어요
            </p>
          )}
        </div>
      )}

      {HAS_KAKAO_KEY ? (
        <div
          ref={containerRef}
          className="h-64 w-full overflow-hidden rounded-lg border border-outline-variant bg-surface-low sm:h-72 lg:h-80"
          aria-label="지도에서 위치를 찍으세요"
        />
      ) : (
        <p className="rounded-lg bg-surface-low px-4 py-6 text-center text-body text-on-surface-variant">
          지도 키(<code>NEXT_PUBLIC_KAKAO_MAP_KEY</code>)가 없어 지도를 띄우지 못했어요.
          <br />
          아래 두 칸에 좌표를 직접 넣으면 저장할 수 있어요.
        </p>
      )}

      {/* 지도를 눌러 찍은 지점의 주소. 검색으로 고른 것과 달리 자동으로 넣지 않는다 —
          클릭은 좌표를 미세하게 옮기는 동작이라, 이미 정확한 주소를 덮어쓰면 손해다 */}
      {clickedAddress && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-surface-low py-2 pr-2 pl-4">
          <span className="min-w-0 truncate text-body text-on-surface-variant">
            {clickedAddress}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onAddressFound(clickedAddress)}
            disabled={disabled}
            className="shrink-0"
          >
            주소 채우기
          </Button>
        </div>
      )}

      {/*
        좌표는 **손으로 쓰는 칸이 아니다.** 검색으로 고르거나 지도를 눌러 채운다.

        ⚠️ 그래서 지도가 있을 때는 읽기 전용이다. `disabled`가 아니라 `readOnly`인
           이유는 값이 살아 있어야 하고 복사할 수 있어야 해서다 — disabled는 흐려지고
           포커스도 못 받는데, 좌표는 확인하고 어디에 붙여넣는 일이 실제로 있다.

        지도 키가 없으면 **편집 가능한 채로 둔다.** 그때는 지도도 검색도 없어서
        여기가 좌표를 넣는 유일한 통로다 — 잠그면 장소를 아예 저장할 수 없다.
      */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lat">
            위도
            {HAS_KAKAO_KEY && (
              <span className="text-meta font-medium text-on-surface-variant">자동</span>
            )}
          </Label>
          <Input
            id="lat"
            inputMode="decimal"
            value={value.lat}
            onChange={(event) => onChange({ ...value, lat: event.target.value })}
            disabled={disabled}
            readOnly={HAS_KAKAO_KEY}
            placeholder="37.5078"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lng">
            경도
            {HAS_KAKAO_KEY && (
              <span className="text-meta font-medium text-on-surface-variant">자동</span>
            )}
          </Label>
          <Input
            id="lng"
            inputMode="decimal"
            value={value.lng}
            onChange={(event) => onChange({ ...value, lng: event.target.value })}
            disabled={disabled}
            readOnly={HAS_KAKAO_KEY}
            placeholder="127.1072"
          />
        </div>
      </div>

    </div>
  );
}

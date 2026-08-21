# Checklist: 관리자 운영 화면 (`/admin/reports` · `/admin/places`)

> `prd.md`의 Tasks를 체크 가능한 형태로 옮긴 것이다. 여기에 PRD에 없는 범위를
> 새로 넣지 않는다.
>
> **2026-08-21 구현 완료.** 구현 태스크 17개는 전부 끝났다. 인수 조건은 다섯(AC1 ·
> AC17~AC20)만 체크돼 있는데, **나머지는 큐레이터 세션이 있어야 확인할 수 있고
> 카카오 로그인은 사람이 하는 일이기 때문이다**(`CLAUDE.md` — 브라우저 검증).
> 체크되지 않은 항목은 실패가 아니라 **미확인**이다.
>
> PRD와 달라진 것 둘:
> - **T11에서 `components/map/KakaoMap.tsx`를 건드리지 않았다.** 관리자 폼이 자기 몫의
>   SDK를 따로 싣는다 (PRD의 RK2가 차선책으로 적어 둔 쪽). 공개 지도의 회귀 위험이 사라진다.
> - **가드가 레이아웃 하나가 아니라 셋이다.** 레이아웃 + 페이지마다 `guardAdminPage()`
>   + 조회 함수마다 `requireCurator()`. 레이아웃만으로는 페이지의 RSC 페이로드가
>   404 응답에 실리는 것을 막지 못한다는 것을 실측으로 확인했다.

## Tasks

### 기반

- [x] T1 Tailwind v4 + shadcn/ui 설치. `postcss.config.mjs`·`components.json` 생성,
      스캔 범위를 `app/admin/**`·`components/admin/**`·`components/ui/**`로 제한,
      Tailwind CSS를 `app/globals.css`가 아니라 `app/admin/`에서만 import(preflight가
      공개 화면에 새지 않게), 테마 변수를 `DESIGN.md` 토큰에 매핑, 다크 모드 분기 없음
      (req: R26, R27) (ac: AC20)
- [x] T2 `supabase/migrations/<버전>_curator_storage_policies.sql` — `storage.objects`에
      큐레이터 insert/update/delete 정책 셋. 조건은 `bucket_id = 'place-images'` +
      `public.is_curator((select auth.uid()))`. **`alter table … enable row level security`와
      `grant`를 쓰지 않는다.** `20_rls_checks.sql`에 큐레이터 성공/일반 사용자 실패 케이스 추가
      (req: R23, R24) (ac: AC17)
- [x] T3 `lib/admin/guard.ts` — `requireCurator()`. 세션 유저 → `profiles.role` 조회 →
      `curator`/`admin`이 아니면 throw. 요청 안에서 `React.cache`로 한 번만 조회
      (req: R1, R2) (ac: AC1, AC2, AC3)
- [x] T4 `app/admin/layout.tsx` — 가드(실패 시 `notFound()`) + 공통 셸.
      `app/admin/page.tsx`는 `/admin/reports`로 redirect. 공개 화면에 진입점을 만들지 않는다
      (req: R1, R3) (ac: AC1, AC2) (after: T1, T3)

### 제보 화면

- [x] T5 `lib/admin/reports.ts` — 서버 전용 이음매. 두 테이블 목록 조회(제보자 닉네임
      join, 수정 요청은 대상 카페 이름 join), 상태 필터, 반려 RPC 호출
      (req: R4, R5, R7) (ac: AC4, AC7) (after: T3)
- [x] T6 `app/admin/reports/page.tsx` + `ReportsTable.tsx` — 탭 둘, 컬럼, 상태 필터를
      URL 쿼리 파라미터로 (req: R4, R5) (ac: AC4, AC5) (after: T5)
- [x] T7 `ReportDialog.tsx` + `app/admin/reports/actions.ts` — 사진 썸네일(클릭 시 원본
      새 탭)·메모 전문·URL/대상 카페·제보자·생성 시각. 반려는 사유 입력 후 RPC(사유는
      선택), 승인은 RPC를 부르지 않고 장소 폼으로 이동만. pending이 아니면 두 버튼을
      그리지 않고 처리 결과를 보여준다 (req: R2, R6, R7, R8) (ac: AC6, AC7, AC8) (after: T6)

### 장소 화면

- [x] T8 `lib/admin/place-form.ts` + `place-form.test.ts` — 순수 함수. 폼 값 ↔ DB
      페이로드 변환(빈 문자열 → null, `is_24h`일 때 영업시간, `tags` 파싱),
      `published` 사전 검증(비어 있는 필드 목록), 최종 `photos` 배열 계산(교체가 위치
      유지), 사진 경로 판별(`submissions/` 접두사 여부).
      **`test/fixtures.ts`를 쓰고 `describe`/`it`/`expect`는 vitest에서 명시 import**
      (req: R10, R12, R13, R14) (ac: AC14, AC16, AC18)
- [x] T9 `lib/admin/places.ts` — 서버 전용 이음매. 목록 조회(`status` 무관 전부,
      `updated_at` 내림차순), insert/update, 사진 업로드(`<slug ?? id>/<uuid>.<ext>`,
      **경로**를 저장), 사진 삭제(`<slug>/`는 storage에서도 지우고 `submissions/`는
      `photos`에서만 뺀다, 실패해도 던지지 않는다).
      `toCafe()`를 빌려 쓰고 두 번째 변환 코드를 만들지 않는다
      (req: R9, R12, R13, R15, R16) (ac: AC11, AC15, AC16) (after: T3, T8)
- [x] T10 `app/admin/places/page.tsx` — 목록 표(대표 사진·이름·주소·status·work_fit·
      확인일·사진 수). 검색·필터를 넣지 않는다 (req: R9) (ac: AC11) (after: T9)
- [x] T11 `types/kakao.d.ts`에 `Geocoder`(`addressSearch`, `coord2Address`) 선언 추가 +
      `components/map/KakaoMap.tsx` SDK URL에 `&libraries=services`.
      **직후에 `/`를 띄워 마커·상세 회귀를 확인한다** (req: R11) (ac: AC12, AC20)
- [x] T12 `LocationPicker.tsx` — 지도 클릭으로 좌표, `주소로 찾기`, 역지오코딩 +
      `주소 채우기`. `NEXT_PUBLIC_KAKAO_MAP_KEY`가 없으면 안내 문구 + 숫자 입력 두 칸
      폴백 (req: R11) (ac: AC12, AC13) (after: T11)
- [x] T13 `PhotoManager.tsx` — 추가·교체(위치 유지)·삭제, 미리보기.
      `components/submission/PhotoPicker.tsx`의 `useMemo` + cleanup effect 패턴을 따른다
      (React Compiler가 effect 안 `setState`와 렌더 중 ref 읽기를 막는다)
      (req: R12) (ac: AC15, AC16) (after: T8)
- [x] T14 `PlaceForm.tsx` — 추가·수정 공용. 필드 전체(식별/위치/영업/Quick Check/운영/사진),
      `published` 검증 메시지는 한국어로(제약 이름 노출 금지), `?report=`/`?request=`의
      사진·메모를 읽기 전용 참고 영역으로, 확인일 옆에 "승인 시 오늘로 바뀝니다" 안내.
      **`work_policy`는 비워 둘 수 있어야 한다**
      (req: R10, R14, R17, R20) (ac: AC14) (after: T12, T13)
- [x] T15 `app/admin/places/actions.ts` — `createPlace`/`updatePlace`.
      **첫 줄은 `requireCurator()`다**(Server Action은 레이아웃 가드 뒤에 있지 않다).
      저장 순서를 R19대로 고정하고 **그 이유를 주석으로 남긴다**:
      ① places 쓰기 → ② 새 사진 업로드 → ③ `photos` update → ④ **마지막에** 승인 RPC.
      제보 사진을 폼에서 복사하지 않는다(RPC가 붙인다). 승인 RPC만 실패하면 "장소는
      저장됐고 제보 연결만 실패했다"를 구분해 알리고 되돌리지 않는다.
      대상이 이미 pending이 아니면 안내 후 일반 저장으로 진행.
      성공 시 `revalidatePath('/')`와 `revalidatePath('/cafes')`
      (req: R2, R15, R18, R19, R21, R22) (ac: AC3, AC9, AC10) (after: T9, T14)

### 마무리

- [x] T16 문서 갱신 — `docs/db-schema.md` RLS 요약표에 새 storage 정책,
      `CLAUDE.md`에 관리자 화면 절(라우트·권한 판정·Server Action 규칙·승인 저장 순서),
      `DESIGN.md`에 "관리자 화면은 Tailwind + shadcn 예외" 명시,
      `docs/scope.md`의 "검수 화면 없음" 서술 갱신 (req: R25) (after: T15)
- [x] T17 검증 — `npm run verify`, `npm run build`(`/`·`/cafes`가 동적으로 바뀌지
      않았는지), `./scripts/verify-schema.sh`, playwright-cli로 로그아웃 404 흐름
      (ac: AC1, AC17, AC18, AC19) (after: T16)

## Acceptance Criteria

- [x] AC1 로그아웃 상태로 `/admin`·`/admin/reports`·`/admin/places`·`/admin/places/new`가 넷 다 404
- [ ] AC2 `role='user'` 계정 세션으로도 같은 네 경로가 404
- [ ] AC3 큐레이터가 아닌 상태로 장소 저장 액션을 호출하면 거부되고 `places`가 바뀌지 않는다
- [ ] AC4 `/admin/reports`의 탭별 행 수가 `select count(*) … where status='pending'`과 일치
- [ ] AC5 상태 필터가 URL에 반영되고 새로고침해도 유지된다
- [ ] AC6 제보 dialog에 사진·메모·URL·제보자·생성 시각이 전부 보이고, 썸네일이 원본을 새 탭에서 연다
- [ ] AC7 반려하면 `status='rejected'`·`review_note`·`reviewed_by`·`reviewed_at`이 채워진다
- [ ] AC8 승인 버튼으로 이동한 시점에 제보는 **아직 `pending`이다**
- [ ] AC9 저장 한 번으로 `places` 행 생성 + `place_reports.status='approved'` + `place_id` 연결
      + **제보 사진이 `places.photos`에 중복 없이** 들어간다
- [ ] AC10 수정 요청 승인 후 `place_edit_requests.status='approved'`이고 `places.last_verified = current_date`
- [ ] AC11 `/admin/places` 목록에 `status='draft'`인 카페도 보인다
- [ ] AC12 지도 클릭으로 잡은 좌표가 저장된 `places` 행의 좌표와 같다
- [ ] AC13 지도 키가 없으면 숫자 입력 두 칸으로 떨어지고 그것으로 저장할 수 있다
- [ ] AC14 핵심 다섯 중 하나가 빈 채 `published` 저장을 누르면 막히고, **한국어로** 무엇이 비었는지
      알려준다. 제약 이름(`places_published_requires_core`)이 화면에 나오지 않는다
- [ ] AC15 올린 사진이 `places.photos`에 **경로**로 들어가고, 마커·상세에 보인다
- [ ] AC16 `<slug>/` 사진을 빼면 storage 오브젝트도 없고, `submissions/` 사진을 빼면 **파일은 남는다**
- [x] AC17 `./scripts/verify-schema.sh` 통과
- [x] AC18 `npm run verify` 통과 (lint `--max-warnings=0` 포함)
- [x] AC19 `npm run build` 통과, `/`와 `/cafes`가 동적 렌더로 바뀌지 않았다
- [x] AC20 `/`와 `/cafes`에 시각 회귀가 없다

## Human Checks

카카오 로그인 자격증명은 사람이 넣는다. 에이전트는 로그아웃 흐름까지만 확인한다.

- [ ] 큐레이터 계정으로 `/admin/reports`가 열린다
- [ ] 제보 dialog의 사진 썸네일을 눌러 원본이 새 탭에서 열린다
- [ ] 실제 제보 하나를 승인해 지도에 카페가 뜨는 것까지 눈으로 확인한다
- [ ] 반려한 제보가 제보자 화면에서 어떻게 보이는지 확인한다
- [ ] 사진 교체 후 마커 썸네일과 상세 캐러셀이 새 사진으로 바뀐다
- [ ] `/`와 `/cafes`를 작업 전 스크린샷과 나란히 놓고 비교한다
- [ ] 관리자 화면의 색이 `DESIGN.md` 팔레트 안에 있다


## 에이전트가 확보한 증거

| 항목 | 증거 |
|---|---|
| AC1 | 로그아웃 상태 `curl` — `/admin`·`/admin/reports`·`/admin/places`·`/admin/places/new` 넷 다 404, 본문은 `app/not-found.tsx`의 "없는 페이지예요" |
| AC1 (추가) | 고치기 전 `/admin/places` 404 응답 37KB 안에 카페 이름·주소가 있었다. 가드를 페이지·조회 함수로 넓힌 뒤 19KB로 줄고 관리자 문자열이 사라졌다 |
| AC17 | `./scripts/verify-schema.sh` ✅ 통과. 새 H-2 케이스 넷(큐레이터 insert/update/delete 각 1 row, 다른 버킷 이동은 with check가 차단) |
| AC18 | `npm run verify` 통과 — lint(`--max-warnings=0`) · typecheck · 테스트 113개 |
| AC19 | `npm run build` 통과. `/`와 `/cafes`가 `○ (Static)` 5m revalidate 유지, `/admin/*`만 `ƒ (Dynamic)` |
| AC20 | `/`가 부르는 CSS 번들에 `--tw-` 변수 **0개**. 관리자 번들에만 345개 + tw-animate + `@layer base` preflight. preflight가 공개 화면에 새지 않는다 |
| RK4 | `app/admin/places/actions.test.ts` — 승인 RPC를 `setPlacePhotos()` 앞으로 옮겨 보니 테스트 2개가 실패했고, 되돌리니 통과했다 |

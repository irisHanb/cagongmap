# Checklist: 장소 리뷰 · 수정 요청 · 신규 제보 (UGC 입력 3종)

> **완료 (2026-08-20).** 구현 중 결정이 넷 뒤집혔고 아래 항목은 **최종 결과 기준**으로
> 다시 적었다. 무엇이 왜 뒤집혔는지는 `prd.md`의 「구현 중 뒤집은 결정」에 있다.

## Tasks

### 스키마

- [x] T1 `place_reviews` 마이그레이션 — `place_review_value` enum, 테이블(PK `(user_id, place_id)`), `place_id` 인덱스, RLS 4종(select/insert/update/delete, 전부 본인), `place_review_counts(uuid)` security definer 함수 + grant/revoke (req: R1, R2, R3) (ac: AC2, AC3)
- [x] T2 `place-images` 버킷 제한(5MB, image/jpeg·png·webp) + `storage.objects` 정책 insert/delete. 모든 정책에 `bucket_id = 'place-images'`와 `submissions/<uid>/` 경로 조건을 함께 걸고, SELECT·UPDATE를 만들지 않은 이유를 주석으로 남긴다. **`alter table ... enable row level security`와 `grant`는 쓰지 않는다** — 이미 켜져 있고 이미 grant돼 있으며, `alter table`은 소유자가 아니라 실패한다 (req: R7, R8, R8-1) (ac: AC10, AC11)
- [x] T3 `hanb`(3e339f8f-cee8-45e7-a506-655079dad4dc)를 `curator`로 올리는 마이그레이션. 대상 행이 없어도 실패하지 않아야 한다 (req: R24) (ac: AC12)
- [x] T4 `supabase/tests/00_stub_supabase.sql`에 storage 스텁(`buckets`·`objects`·`storage.foldername`) 추가, `20_rls_checks.sql`에 리뷰·storage 케이스 추가 (req: R25, R26) (ac: AC3, AC11, AC14) (after: T1, T2)
- [x] T4-1 제보를 `place_reports` + `place_edit_requests`로 가르고 payload jsonb를 걷어낸다. 승인 함수 넷을 새로 쓴다 — 카페를 만들지 않고 연결·상태 전환만 (ac: AC6, AC8, AC12) (after: T1)
- [x] T4-2 카페 이미지를 `place-images` 한 버킷으로 모은다. `places.photos`는 경로, 제보 두 테이블의 `photos`는 공개 URL. check 제약이 서로를 막는다 (ac: AC10) (after: T4-1)

### 데이터 접근 이음매

- [x] T5 `lib/place-id.ts`로 `resolvePlaceId()` 추출, `lib/bookmarks.ts`가 그것을 쓰게 리팩터. 브라우저 세션 클라이언트를 그대로 유지한다 (req: R23)
- [x] T6 `lib/reviews.ts` — `getMyReview` / `getReviewCounts` / `setReview` / `clearReview` (req: R22) (ac: AC2, AC3) (after: T1, T5)
- [x] T7 `lib/submissions.ts` — 파일 검증, 업로드(`submissions/<uid>/<uuid>.<ext>`), 실패 시 되돌리기(`removePhotos`), `submitEdit`, `submitNewPlace`, 네이버 URL 검증, 중복 카페 조회, 23505 에러 번역 (req: R9, R10, R10-1, R12, R13, R15, R16, R17, R22) (ac: AC6, AC7, AC8, AC9, AC12-1) (after: T2, T5)
- [x] T7-1 `lib/place-images.ts` — 경로 ↔ 공개 URL. `toCafe()`가 이것을 불러 `Cafe.photos`를 URL로 만든다(컴포넌트는 버킷을 모른다) (after: T4-2)

### 화면

- [x] T8 `AuthProvider`에 `requireLogin(reason)` / `loginPrompt` 추가, `BookmarkProvider`에서 로그인 판정 제거, `LoginRequiredModal` 문구를 이유별(북마크·리뷰·제보)로 (req: R19, R20, R21) (ac: AC4)
- [x] T9 `ReviewSection`을 만들어 `CafeCard`에 넣는다. 버튼 3개 + 집계 한 줄, 재클릭 해제, 낙관적 갱신, 0건 빈 상태 문구. **provider는 두지 않았다** — 소비자가 하나뿐이고 `CafeCard`가 카페마다 새로 마운트된다 (req: R4, R5) (ac: AC1, AC2, AC4) (after: T6, T8)
- [x] T10 `SubmissionModal`(공용 껍데기) + `PhotoPicker` + `EditRequestModal` + 상세 하단 진입점. 사진·메모 둘 다 비면 제출 비활성 (req: R11, R12, R13) (ac: AC6, AC7) (after: T7, T8)
- [x] T11 `NewPlaceModal` + dock 진입점. 네이버 URL 필수, 중복 안내, 승인 절차 한 줄 안내 (req: R14, R15, R16, R17, R18) (ac: AC8, AC9) (after: T7, T8)
- [x] T12 `app/globals.css` 스타일. `:root` 기존 토큰만 쓰고 새 색·스케일 밖 여백을 만들지 않는다. `good` 선택에만 민트 (req: R6) (ac: AC5) (after: T9, T10, T11)
- [x] T12-1 사진 고르기를 브라우저 기본 파일 입력에서 걷어낸다. 입력은 숨기고 나머지 필드와 같은 규격(48px·pill)의 레이블을 누르게 하고, 드롭도 받는다 (ac: AC5) (after: T10)

### 테스트 · 문서 · 검증

- [x] T13 vitest — `lib/reviews.test.ts`, `lib/submissions.test.ts`, `lib/place-images.test.ts`, `components/review/ReviewSection.test.tsx`, `components/submission/PhotoPicker.test.tsx`. 세션이 필요한 컴포넌트는 `@/lib/supabase-browser` 하나만 `vi.mock`한다 (req: R4, R5, R10-1, R15) (ac: AC13) (after: T9)
- [x] T13-1 제보 테이블 분리·이미지 규칙에 맞춰 `supabase/tests/10_schema_checks.sql`·`20_rls_checks.sql`을 다시 쓴다 (ac: AC14) (after: T4-1, T4-2)
- [x] T14 문서 갱신 — `docs/scope.md`(제보·리뷰를 1차로 이동 + 변경 이력), `DESIGN.md`(리뷰 섹션의 상세 패널 내 위치, 모달 규칙 변경, 새 컴포넌트 규격), `docs/db-schema.md`(RLS 요약표), `CLAUDE.md`(로그인 판정 위치, 이미지 규칙) (ac: AC16)
- [x] T15 `npm run verify` · `./scripts/verify-schema.sh` · `npm run build` 실행, 로그아웃 상태 브라우저 확인(`playwright-cli`) (ac: AC9, AC13, AC14, AC15) (after: T12, T13)
- [x] T16 `scripts/prune-orphan-photos.mjs`(버려진 사진 청소, dry-run 기본). **이것만** `SUPABASE_SERVICE_ROLE_KEY`가 필요하다 — 승인은 SQL 한 줄로 끝난다 (req: R24-1) (ac: AC12-1) (after: T4-2)

## Acceptance Criteria

- [x] AC1 로그인 상태에서 `좋아요`를 누르면 즉시 선택되고 새로고침 후에도 유지된다 — 사용자 확인
- [x] AC2 재클릭은 해제, 다른 값은 이동. `place_reviews` 행은 항상 0개 또는 1개다 — PK와 upsert가 보장, `verify-schema.sh` G절
- [x] AC3 `anon`이 `place_review_counts()`는 부를 수 있고 `place_reviews` select는 0행이다
- [x] AC4 로그아웃 상태에서 리뷰 버튼을 누르면 저장되지 않고 **리뷰 문구**의 로그인 모달이 뜬다
- [x] AC5 `good` 선택에만 민트 색이 든다. `normal`·`bad`에는 색이 없다 — 계산된 스타일로 확인
- [x] AC6 수정 요청 제출 시 `place_edit_requests`에 `status='pending'`, `photos`(공개 URL), `note` 행이 생긴다 — 실제 제출로 확인
- [ ] AC7 같은 장소에 두 번째 제출은 안내 문구로 막히고 Postgres 원문이 노출되지 않는다 — **미확인**(중복 제출을 일부러 내야 한다)
- [x] AC8 신규 제보 제출 시 `place_reports`에 `place_id is null`, `naver_place_url`, `photos`가 채워진다 — 실제 제출로 확인
- [x] AC9 네이버가 아닌 URL은 제출이 막히고 업로드조차 하지 않는다 — 단위 테스트
- [x] AC10 업로드 파일이 `place-images/submissions/<uid>/`에 있고, 테이블의 공개 URL이 로그인 없이 열린다(200 + image/png) — curl로 확인
- [x] AC11 남의 uid 폴더나 카페 사진 자리(`<slug>/`)로 insert하면 storage 정책이 막는다
- [x] AC12 `approve_place_report(...)`가 사진을 `places.photos`에 붙이고 제보를 `approved`로 만든다 — 실제 제보로 확인(롤백), 스키마 테스트 8절
- [ ] AC12-1 제출이 실패하면 방금 올린 사진이 버킷에 남지 않는다 — **단위 테스트만 통과**, 실제 중복 제출로는 미확인
- [x] AC13 `npm run verify` 통과 (75 테스트, warning 0)
- [x] AC14 `./scripts/verify-schema.sh`가 `✅ 통과`로 끝난다
- [x] AC15 `npm run build`에서 `/` 라우트가 정적 렌더를 유지한다
- [x] AC16 `docs/scope.md`·`DESIGN.md`·`docs/db-schema.md`·`CLAUDE.md`가 갱신돼 있다

## 후속 (2026-08-21) — service_role 키 없애기

- [x] F11 `resolve_reviewer`를 "세션이 없으면"으로 넓힌다 — F1의 `auth.role()='service_role'` 조건이 대시보드 SQL 편집기까지 막고 있었다
- [x] F12 승인 함수가 사진을 직접 붙인다. 파일 이관을 없애고 `scripts/approve-submission.mjs`를 지운다 — 이관 하나 때문에 승인 전체가 키에 묶여 있었다
- [x] F13 `submission_photo_count`가 `places.photos`가 쓰는 사진을 세지 않는다 — 안 옮기면 승인해도 상한이 안 비워진다
- [x] F14 `prune-orphan-photos.mjs`의 참조 목록에 `places.photos` 추가 — 빠뜨리면 지도에 뜨는 사진을 지운다

## 코드 리뷰 후속 (2026-08-20)

- [x] F1 승인 함수에 `p_reviewer` 추가 — service_role은 `auth.uid()`가 NULL이라 승인이 통과할 수 없었다 (req: R24-2)
- [x] F2 `ReviewSection` 조회 경합 — 누른 뒤 도착한 응답을 무시하고, 요청 후 서버 집계로 맞춘다 (req: R5-1)
- [x] F3 업로드 개수 상한을 storage 정책으로 (`submission_photo_count() < 20`) (req: R7-1)
- [x] F4 `requireLogin`이 `resolved`를 본다 (req: R19-1)
- [x] F5 `prune-orphan-photos.mjs` 페이지네이션 — 1000행에서 잘리면 참조된 사진을 고아로 오인한다
- [x] F6 `submitEdit`의 `resolvePlaceId`를 업로드보다 먼저 — 거기서 던지면 롤백을 지나쳤다
- [x] F7 `split_submissions` 사전 점검이 놓치던 행(내용 없는 수정 요청, 대상 없는 수정 요청, 형식 틀린 URL)
- [x] F8 재시도 가능하게 — 이후 이관 자체를 없애면서(2026-08-21) 승인이 SQL 한 번으로 끝나 재시도 문제가 사라졌다. 사진은 중복으로 붙지 않는다
- [x] F9 모달 주석의 `kind='edit'` / `kind='new'` 잔재 제거
- [x] F10 위 셋(F1·F2·F3)에 대한 검증 추가 — 스키마 테스트 3케이스, 경합 회귀 테스트 1개(수정을 되돌리면 실패하는 것을 확인)

## Human Checks

- [x] 카카오 로그인 후 AC1·AC2 (리뷰 선택·해제·이동, 새로고침 유지)
- [x] 신규 제보 제출과 사진 업로드 (AC8, AC10)
- [ ] 같은 카페에 중복 제출 → 안내 문구 확인, 그 뒤 `prune-orphan-photos.mjs`가 고아 0장을 보고하는지 (AC7, AC12-1)
- [ ] `places`에 카페를 만든 뒤 대시보드에서 `select approve_place_report(...)` 실행 — 실제 데이터로 한 번 (AC12)
- [x] 리뷰 버튼 색 확인 — `good`에만 민트 (AC5)
- [ ] 폐기된 `submission-images` 버킷을 대시보드에서 삭제 (SQL로는 `storage.protect_delete`가 막는다)
- [ ] `supabase db push`가 열 개 마이그레이션을 순서대로 통과하는지 (원격에는 MCP로 이미 적용됨)

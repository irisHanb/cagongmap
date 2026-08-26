# 카페 이미지 — 버킷 하나

**카페와 관련된 이미지는 전부 Supabase Storage의 `place-images` 버킷을 쓴다.**
외부 CDN 이미지를 화면에 얹지 않는다 — 카카오맵 응답 URL 저장 금지(크롤링 금지)와
저작권 확인 결정이 여기 걸려 있다. 유일한 예외는 카카오 avatar이고, 그것은 카페
이미지가 아니라 프로필이다. 그래서 `next.config.ts`의 `remotePatterns`는 Supabase
Storage만 열어 두고, avatar는 `next/image`를 쓰지 않는다.

## 테이블마다 담는 모양이 다르다

목적이 다르기 때문이다.

| 컬럼 | 값 | 왜 |
|---|---|---|
| `places.photos` | 경로 (`naruteo.jpeg`) | 오래 남고 앱이 매번 읽는다. URL을 담으면 프로젝트 ref가 데이터에 들어가 프로젝트를 옮길 때 전부 죽는다 |
| `place_reports.photos`<br>`place_edit_requests.photos` | **공개 URL** | 검수자가 대시보드에서 값을 그대로 클릭해 열어야 한다. 검수가 끝나면 수명이 끝나는 데이터라 ref가 들어가는 대가를 치를 만하다 |

check 제약이 양쪽을 서로 막는다 — `places`에 URL을 넣거나 제보에 경로를 넣으면 거부된다.
제보 쪽은 `place-images` 공개 객체 URL 모양까지 강제하므로 외부 CDN 이미지는 들어올 수 없다.

**컬럼 이름은 세 테이블 모두 `photos`다.**

## 경로가 곧 상태다

| 경로 | 뜻 | 누가 쓰나 |
|---|---|---|
| `submissions/<uid>/<uuid>.jpg` | 검수 전 제보 사진 | 본인만 (storage 정책) |
| `<slug>/<uuid>.jpg` | 승인된 카페 사진 | service_role 스크립트만 |

- **URL 조립과 해체는 `lib/place-images.ts` 한 곳뿐이다** (`placeImageUrl` /
  `placeImagePath`). `toCafe()`가 전자를 불러 `Cafe.photos`를 URL로 만들어 주므로
  **컴포넌트는 버킷을 모른다.** `getPublicUrl`은 문자열만 만들고 네트워크를 타지 않아
  서버에서도 안전하다.
- **사진 파일은 승인해도 옮기지 않는다.** `submissions/<uid>/`에 그대로 두고
  `places.photos`가 그 경로를 가리킨다. 옮기려면 `<slug>/`에 쓸 권한이 필요한데 그것은
  사용자에게 열려 있지 않고, 그 하나 때문에 **승인 전체가 service_role 키에 묶였었다.**
  경로가 덜 깔끔한 대신 승인이 대시보드에서 끝난다.

## ⚠️ 공개 버킷이므로 검수 전 사진도 URL을 안다면 열린다

방어선은 셋이다.

1. 로그인 사용자는 자기 `submissions/<uid>/` 아래에만 쓸 수 있다.
2. 버킷에 5MB·이미지 3종 제한이 있다 (`lib/photo-rules.ts`의 상수와 같아야 한다).
3. **폴더당 20장 상한**을 storage 정책이 `submission_photo_count()`로 건다.
   그 함수는 **`places.photos`가 이미 쓰는 사진은 세지 않는다** — 승인된 사진은 검수
   폴더에 남지만 자리를 차지하지 않아야 한다.

개수 상한이 없으면 `MAX_PHOTOS`가 클라이언트에만 있는 셈이라(anon 키는 브라우저에
나간다) 공개 버킷이 무한 업로드 대상이 된다.

## 버려진 사진 정리는 두 겹이다

1. **앱이 그 자리에서 되돌린다** — `lib/submissions.ts`의 `removePhotos()`. 사진은
   제출 버튼을 누를 때 올라가고 insert가 그 뒤에 오므로, 중간에 실패하면(중복 제보,
   업로드 도중 실패) 방금 올린 것을 지운다. storage 정책이 `submissions/<본인 uid>/`에
   delete를 열어 두어 **사용자 세션만으로 된다** — 운영자 키가 필요 없다.
   지우기에 실패해도 **던지지 않는다.** 던지면 사용자가 알아야 할 원래 실패를 덮는다.
2. **놓친 것은 스크립트가 걷어간다** — `scripts/prune-orphan-photos.mjs`. 탭을 닫거나
   네트워크가 끊겨 1번이 못 돈 경우의 안전망이다.

```bash
node --env-file=.env.local scripts/prune-orphan-photos.mjs        # 목록만
node --env-file=.env.local scripts/prune-orphan-photos.mjs --yes  # 지운다
```

- ⛔ **`--yes`는 사용자가 실행을 지시했을 때만 붙인다.** storage 삭제는 되돌릴 수 없다.
  에이전트가 스스로 판단해서 붙이지 않는다.
- **이 스크립트만 `SUPABASE_SERVICE_ROLE_KEY`가 필요하다**(storage 삭제는 SQL로 못 한다).
  쓸 때만 넣고 지우면 된다 — **`NEXT_PUBLIC_` 접두사를 붙이지 않는다.**
- 참조 목록에 `places.photos`도 포함한다. 승인해도 파일이 검수 폴더에 남으므로,
  빠뜨리면 지도에 이미 뜨는 사진을 지우게 된다.
- 참조되는 파일은 건드리지 않고, 올라온 지 60분이 안 된 파일도 남긴다(폼이 열려 있을
  수 있다).
- **참조 목록과 파일 목록은 끝까지 페이지를 넘겨 읽는다** — 중간에 잘리면 참조되는
  사진을 고아로 오인한다.

## 폐기된 것

**`submission-images`(비공개) 버킷은 폐기됐다.** 2026-08-20 오전에 잠깐 있었다.
**storage 테이블은 SQL로 지울 수 없으므로**(`storage.protect_delete`가 막는다)
버킷을 없애는 것은 대시보드나 Storage API로만 된다. 마이그레이션으로 지우려 하지 말 것.

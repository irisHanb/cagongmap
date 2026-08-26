# CLAUDE.md

@AGENTS.md

> `AGENTS.md`는 `next dev`가 실행될 때마다 자동으로 다시 쓰인다. 직접 편집하지 말 것.

개발 작업을 시작하기 전에 `docs/code-guide.md`를 먼저 읽는다.

## 프로젝트

카공맵 — 노트북 작업하기 좋은 카페를 카카오맵 위에서 찾는 서비스. **개인 습작 MVP**
(인프런 VC 클래스)이며, 사업화가 아니라 학습이 목적이다.

## ⛔ 손대지 않는 것

되돌릴 수 없는 작업이다. **사용자가 그 작업을 지시했을 때만 한다.** "필요해 보여서",
"정리하는 김에"는 이유가 되지 않는다.

### 운영 데이터

⚠️ **`.mcp.json`의 Supabase MCP는 운영 프로젝트에 직접 붙는다**
(`project_ref=palzceynjixnbqjsagpq`, `database`·`storage` feature). 로컬 스택이 없다.
**`execute_sql`과 `apply_migration`은 운영 DB를 그대로 친다.**

| 하지 않는 것 | 대신 |
|---|---|
| `places` 등 기존 행 `delete` · `truncate` · `drop table` | 컬럼을 더하거나 상태 컬럼을 바꾼다 |
| `supabase db reset` | 로컬 스택이 없다. 이 명령은 운영 데이터를 지운다 |
| 이미 적용된 마이그레이션 파일 수정 | 새 파일로 덮는다 (`.claude/rules/supabase-db.md`) |
| `scripts/prune-orphan-photos.mjs --yes` | 플래그 없이 돌려 목록만 보고 사용자에게 보고한다 |
| Storage 버킷·오브젝트 삭제 | 참조가 남아 있는지 먼저 센다 (`docs/images.md`) |

2026-08-14와 08-15 두 세션에서 사용자가 **"기존 places 데이터는 삭제하지 마"를 각각
따로 지시했다.** 스키마를 바꾸는 작업이 데이터를 지우는 작업으로 번지지 않게 한다.

### 되돌릴 수 없는 git 작업

`push --force` · `reset --hard` · 원격 브랜치 삭제 · PR 닫기 · 태그 삭제 ·
`git commit --no-verify` — 전부 지시받았을 때만 한다.

### 그밖에

- **`.env.local`을 읽어서 값을 출력하거나 커밋하지 않는다.** 키 이름까지만 말한다.
- **`SUPABASE_SERVICE_ROLE_KEY`를 앱 코드에 들이지 않는다.** 쓰는 곳은
  `scripts/prune-orphan-photos.mjs` 하나뿐이고, `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
- **크롤링하지 않는다.** 아래 「구속력 있는 결정」 참고.
- **로그인이 필요한 화면에 대신 로그인해 주지 않는다.** 카카오 계정 자격증명을 입력하는
  일은 사람이 한다. 에이전트는 로그아웃 상태 흐름까지만 확인하고, 그 뒤는 확인하지
  못했다고 말한다.

## 명령어

```bash
npm run dev        # 개발 서버
npm run verify     # lint → typecheck → test. 커밋 훅이 부르는 것도 이것이다
```

나머지는 `package.json`의 scripts에 있다. 거기서 읽을 수 없는 것만 적는다.

- **포트는 3030이다.** 카카오 콘솔 플랫폼 도메인이 `http://localhost:3030`으로 등록되어
  있어, 다른 포트로 띄우면 지도가 뜨지 않는다. `dev`·`start` 둘 다 고정돼 있다.
- **띄우기 전에 3030이 이미 물려 있는지 확인한다.** 사용자가 서버를 켜 둔 채로 작업을
  맡기는 경우가 있다.
- **타입체크에 `npx tsc --noEmit`을 단독으로 부르지 않는다.** Next.js가 생성하는 전역
  타입(`LayoutProps` 등)을 모르기 때문에 실패한다. `npm run typecheck`가 앞에
  `next typegen`을 붙여 그 타입을 먼저 만든다. 빌드 없이 몇 초에 끝나므로 타입만 볼 때
  `npm run build`를 돌릴 이유가 없다.
- **`npm run lint`는 `--max-warnings=0`이다.** warning을 남겨 두면 exit 0으로 통과해
  아무도 보지 않게 된다.

## 커밋

- **시키지 않은 커밋을 만들지 않는다.** 커밋·푸시는 요청받았을 때만 한다.
- **요청받으면 변경 성격별로 나눠서 커밋한다.** 사용자가 세 세션에 걸쳐 같은 것을
  요청했다("변경내용 분리 commit", "변경사항별로 잘 구분해서"). 기능·수정·문서·설정을
  한 커밋에 섞지 않는다.
- **`main`에서 직접 작업하고 커밋한다.** 브랜치를 먼저 따지 않는다. 브랜치와 PR은
  CI·리뷰 워크플로를 검증할 때만 만든다.
- **메시지는 `type: 한국어 서술체`다.** `git log`가 그 형태다 —
  `feat: 구조화 로그를 lib/log.ts 한 곳에서 낸다`, `fix(ci): PR Review에 id-token: write를 준다`.
  명사로 끝내지 않는다("로깅 추가" ✗).
- 커밋 전에 pre-commit 훅이 `npm run verify`를 돌린다 (`docs/ci.md`).

## 검증

**`npm run verify`가 통과한 것과 화면이 도는 것은 다르다.** UI를 건드렸으면 실제로
띄워서 확인한다. 자동 테스트는 로직만 보고 레이아웃·SDK 초기화·하이드레이션은 보지 않는다.

```bash
playwright-cli open http://localhost:3030   # 브라우저 띄우고 바로 이동
playwright-cli snapshot                     # 요소 ref가 붙은 페이지 스냅샷
playwright-cli find "카카오 로그인"           # 스냅샷에서 텍스트 찾기
playwright-cli click e15                    # ref로 클릭
playwright-cli console                      # 콘솔 로그
playwright-cli close
```

- **`snapshot`이 기본이고 `screenshot`은 예외다.** 스냅샷은 요소 ref가 붙은 텍스트라
  클릭 대상을 좌표로 찍지 않아도 되고 토큰도 훨씬 적게 든다. 스크린샷은 레이아웃이나
  색처럼 **눈으로만 판별되는 것**을 볼 때만 쓴다.
- 개발 서버를 먼저 띄워야 한다. 서버가 없으면 빈 페이지를 보고 "고쳤다"고 말하게 된다.
- 지도는 `NEXT_PUBLIC_KAKAO_MAP_KEY`가 있어야 그려진다. 키가 없으면 안내 문구가
  대신 뜨는데 그것은 의도된 폴백이지 깨진 화면이 아니다.

## 환경변수

`.env.local`에 셋이 필요하고, 셋은 있으면 좋다.

| 변수 | 없으면 |
|---|---|
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 지도 대신 안내 문구가 렌더된다 — 의도된 폴백이다 |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase-env.ts`가 즉시 throw한다 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 위와 같다 |
| `NEXT_PUBLIC_SITE_URL` | `lib/site.ts`가 현재 배포 주소로 떨어진다. 로컬에서는 없어도 된다 |
| `LOG_LEVEL` | 개발은 `debug`, 운영은 `info`로 떨어진다 |
| `SUPABASE_SERVICE_ROLE_KEY` | `scripts/prune-orphan-photos.mjs`가 거부한다. **평소에는 없어도 된다** |

Supabase 쪽은 폴백을 두지 않았다. 원본이 하나여야 하는데 조용히 JSON으로 되돌아가면
화면이 실제 DB와 다른 것을 보여주기 때문이다.

`NEXT_PUBLIC_` 접두사이므로 값을 바꾸면 **개발 서버를 재시작해야** 반영된다.

카카오맵 무료 쿼터는 **개발자 계정의 첫 활성화 앱 1개에만** 제공된다. 새 앱을 만들지
말고 기존 앱을 쓴다.

## 구조 — 이음매 하나로 모은다

**컴포넌트는 DB·Storage·외부 SDK를 직접 건드리지 않는다.** 카페 데이터는
`lib/cafes.ts`, 스키마는 `lib/schema.ts`, 사진 URL은 `lib/place-images.ts`를 통한다.
JSON에서 Supabase로 갈아탈 때 컴포넌트가 한 줄도 바뀌지 않은 이유가 그것이다.
**이 규칙을 깨면 이 구조의 의미가 사라진다.**

**결정과 근거는 코드 옆에 있다.** 주요 파일이 머리 주석에 "왜 이렇게 했는가"를 갖고
있으므로, 고치기 전에 그 파일을 연다. 이 문서와 아래 문서들은 **한 파일만 봐서는 보이지
않는 것**만 적는다.

### 어디를 보나

| 무엇 | 어디 |
|---|---|
| 코드 작성 기준 (KISS·DRY·경계) | `docs/code-guide.md` |
| 색·타이포·간격·말투 | `DESIGN.md` |
| 이음매·서버/브라우저 경계·인증 | `lib/CLAUDE.md` |
| 관리자 화면 (가드·저장 순서·UI) | `app/admin/CLAUDE.md` |
| 카카오맵 SDK·마커·Map Shell | `components/map/CLAUDE.md` |
| 스키마·RLS·마이그레이션 | `.claude/rules/supabase-db.md` · `docs/db-schema.md` |
| TypeScript 컨벤션 | `.claude/rules/typescript.md` |
| 테스트 | `.claude/rules/tests.md` |
| 로깅 | `.claude/rules/logging.md` |
| UI·Tailwind·React Compiler | `.claude/rules/ui.md` |
| 사진 경로·버킷·정리 | `docs/images.md` |
| 리뷰·제보 테이블과 승인 함수 | `docs/ugc.md` |
| 검색·공유 카드·404 | `docs/seo.md` |
| pre-commit·GitHub Actions | `docs/ci.md` |
| 카페 후보 URL 목록 (데이터 아님) | `data/crawling/README.md` |
| 무엇을 만들고 무엇을 미루는지 | `docs/scope.md` |
| 구속력 있는 제약과 근거 | `docs/mvp-decisions.md` |
| 감사 스냅샷 (갱신하지 않는다) | `docs/seo-audit-2026-08-21/` · `docs/security-audit-2026-08-23/` |

## 데이터

런타임 원본은 Supabase `places` 테이블이다. `data/cafes.json`은 시드 마이그레이션
(`supabase/migrations/20260814000003_seed_places.sql`)을 만드는 입력으로만 남아 있다 —
`node scripts/generate-seed.mjs`로 재생성한다. 현재 9곳(송파·잠실 7 + 강남 2).

**이미 적용한 뒤 JSON을 고쳐도 DB에 반영되지 않는다.** 마이그레이션은 한 번만 돌기
때문에, 그때는 새 마이그레이션을 따로 만들거나 Supabase에서 직접 고쳐야 한다.

- **`id`가 키다.** 이름은 바뀌므로 `name`을 키로 쓰지 않는다. 앱의 키는 `places.slug`
  (`naruteo`)이고 `places.id`(uuid)가 아니다 — `toCafe()`가 `slug`를 `Cafe.id`로 옮긴다.
- `last_verified`는 화면에 "확인일"로 노출된다. **현재 값은 전부 임시로 채운 오늘
  날짜이며 실제 확인 시점이 아니다.**
- `types/cafe.ts`의 enum은 시드에 아직 등장하지 않는 값(`few`/`none`/`noisy`/`bad`)까지
  열어두었다.

## 구속력 있는 결정 (뒤집으려면 문서부터 갱신할 것)

- **크롤링 금지.** 카카오맵 API는 응답 데이터의 별도 저장을 약관으로 금지하며 차단이
  실제 집행된다. 카페 데이터는 수기 큐레이션으로만 채운다.
  - **가르는 기준은 "그 값이 `places`로 그대로 넘어가는가"다** (2026-08-26 명시).
    API 응답을 옮겨 담거나 자동화로 필드를 추출하는 것은 금지다. **검색으로 후보 URL과
    상호명을 모아 `data/crawling/`에 두는 것은 허용된다** — 후보 목록이지 데이터가
    아니고, `places`의 값은 여전히 사람이 확인해서 채운다. 경계표는
    `docs/mvp-decisions.md` 2-1절, 폴더 설명은 `data/crawling/README.md`에 있다.
- **권역은 송파·잠실.** 초기 지도 중심은 송리단길(`37.5078, 127.1072`).
- **사진은 Supabase Storage(`place-images` 버킷)에 직접 호스팅한다.** 2026-08-14에
  뒤집힌 결정이다 — 원래는 "직접 호스팅하지 않고 `naver_place_url`로 넘긴다"였다.
  배경은 `docs/mvp-decisions.md` 3절.
  - ⚠️ **현재 올라간 이미지 9장은 연습용 임시본이며 이용 권리를 확인하지 않았다.**
    공개 배포 전에 직접 촬영본이나 사용 허가를 받은 사진으로 교체해야 한다.
- **데이터 신선도를 숨기지 않는다.** `last_verified`를 UI에 노출하는 것이 명시적 결정이다.
- **`work_policy`(카공 허용) 도입.** 2026-08-21에 결정했다. **값은 9곳 전부 null이다** —
  매장에 가 봐야 아는 값이라 추측으로 채우지 않는다. `work_fit`은 대용이 아니다
  (환경 품질 ≠ 매장 정책).

## 열려 있는 결정

- **검증할 핵심 가설** — `docs/scope.md` 미확정 이슈 ③.
- **`work_policy` 9곳의 값을 무엇으로 채울 것인가** — 방문 확인 외에 방법이 없다.
- **임시 이미지를 무엇으로 교체할 것인가** — 직접 촬영할지, 매장 동의를 받을지 정하지
  않았다. **공개 전에 정해야 한다.**
- **클라이언트 쓰기의 관측** — `.claude/rules/logging.md` 마지막 절.
- **보안 감사 6절 「사람이 결정할 것」** — `docs/security-audit-2026-08-23/`.

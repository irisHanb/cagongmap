# 카공맵

노트북 작업하기 좋은 카페를 카카오맵 위에서 찾는 서비스. 인프런 VC 클래스 습작 MVP다.

- 배포: https://cagongmap-nu.vercel.app
- 권역: 송파·잠실·강남, 수기 큐레이션 9곳

## 시작하기

```bash
npm install
cp .env.example .env.local   # 키를 채운다
npm run dev                  # http://localhost:3030
```

**포트는 3030 고정이다.** 카카오 콘솔에 등록된 플랫폼 도메인이 `http://localhost:3030`이라
다른 포트로 띄우면 지도가 뜨지 않는다.

`.env.local`에 카카오맵 JavaScript 키와 Supabase URL·anon 키가 있어야 한다. 자세한 내용은
`.env.example`의 주석에 있다.

## 명령어

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (3030) |
| `npm run build` | 프로덕션 빌드 — 타입체크가 함께 돈다 |
| `npm start` | 프로덕션 실행 (3030) |
| `npm run verify` | lint → typecheck → test. 커밋 훅이 부르는 것도 이것이다 |
| `npm run test` | vitest watch |

커밋할 때마다 `.githooks/pre-commit`이 `npm run verify`를 돌린다. 실패하면 커밋이 멈춘다.

## 문서

| 문서 | 역할 |
|---|---|
| `CLAUDE.md` | 아키텍처와 이 저장소에서 밟기 쉬운 함정 |
| `DESIGN.md` | 색·타이포·간격 토큰과 그 사용 규칙 |
| `docs/scope.md` | 무엇을 만들고 무엇을 미루는지 |
| `docs/mvp-decisions.md` | 구속력 있는 제약과 근거 |
| `docs/db-schema.md` | 테이블과 RLS 정책 |

## 아직 공개 전이다

지도에 걸린 사진 9장은 연습용 임시본이고 이용 권리를 확인하지 않았다. 그래서 지금은
`robots` 메타로 검색 색인을 막아 두었다(`app/layout.tsx`). 사진을 교체한 뒤에 푼다.

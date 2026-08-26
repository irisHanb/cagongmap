# 검증 자동화

## pre-commit 훅

**커밋할 때마다 `npm run verify`가 자동으로 돈다**(4~5초). 실패하면 커밋이 멈춘다.

훅 본체는 `.githooks/pre-commit`이고 **저장소에 커밋돼 있다.** 왜 거기 두는지, 왜
스테이지된 파일만 고르지 않는지, 왜 husky를 쓰지 않는지는 **그 파일의 주석에 있다.**

- 연결은 `package.json`의 `prepare` 스크립트가 한다 — `git config core.hooksPath .githooks`.
  npm이 `npm install` 뒤에 자동으로 부르므로 따로 설치할 것이 없다.
- ⚠️ **훅은 작업 트리를 본다. 스테이지 내용이 아니다.** 스테이지하지 않은 변경이 있으면
  방금 통과한 것과 실제로 커밋되는 내용이 다르다. 훅이 그럴 때 한 줄로 알려 준다.
- 일부러 건너뛰려면 `git commit --no-verify`. **사용자가 지시했을 때만 쓴다.**

## GitHub Actions

워크플로우가 둘이다. **역할이 다르고 도는 시점도 다르다.**

| 파일 | 언제 | 무엇 |
|---|---|---|
| `.github/workflows/ci.yml` | main push · 모든 PR (커밋마다) | `lint` · `typecheck` · `test:run` · `build` |
| `.github/workflows/pr-review.yml` | **PR이 열릴 때만** (`opened`·`reopened`) | 코드 리뷰 · 보안 점검 |

- **PR Review는 `synchronize`를 넣지 않는다.** 넣으면 push 한 번에 리뷰가 한 벌씩
  쌓이고 같은 지적이 같은 줄에 중복된다.
- job이 둘이다. `review`는 내장 `code-review` skill을, `security`는 이 저장소의
  `.claude/skills/security-check`를 부른다. 발견은 해당 라인에 시급도
  (`🔴 P0 시급` · `🟠 P1 높음` · `🟡 P2 보통` · `⚪ P3 참고`)를 붙여 인라인 코멘트로 남기고,
  라인에 달 수 없는 것만 요약 코멘트 하나로 낸다.
- ⚠️ **`security-check` skill 1절은 `AskUserQuestion`으로 점검 방식을 묻는다.** CI에는
  답할 사람이 없으므로 프롬프트가 **3번(로컬 코드만)으로 고정하고 HTTP 요청을 금지한다.**
  skill을 고칠 때 이 절을 함께 본다.
- ⚠️ **skill의 보고 형식이 프롬프트를 이긴다.** `code-review` skill이 자체 형식을 갖고
  있어 처음에는 시급도 없이 영어로 달렸다. 그래서 프롬프트가 **skill에서 가져오는 것을
  "무엇을 볼지"로 한정하고 형식·언어·도구는 프롬프트가 우선한다**고 못 박는다.
- **코멘트 문체는 정중한 합니다체다.** 프롬프트에 「문체」 절이 있고 대조표까지 들어 있다.
  이 저장소 문서는 서술체("~한다")인데 그것을 그대로 가져오면 남의 코드를 반말로 지적하는
  코멘트가 된다. **판정은 단정하고 지시는 제안형**("~하는 편이 좋겠습니다")으로 쓴다.

### ⚠️ 워크플로를 고친 직후 바로 재실행하면 옛 버전이 돈다

`pull_request` 워크플로는 head가 아니라 **merge ref**(`refs/pull/<N>/merge`)에서 읽히는데,
main에 푸시한 뒤 그 ref가 다시 계산되기까지 시간이 걸린다. 2026-08-24에 이걸로 두 번
헛돌았다 — 코멘트 주인이 `claude[bot]`으로 바뀌지 않아 App 설치를 의심했지만 실제로는
액션에 `github_token`이 그대로 넘어가고 있었다. 재실행 전에 확인한다.

```bash
gh api "repos/<owner>/<repo>/contents/.github/workflows/pr-review.yml?ref=refs%2Fpull%2F<N>%2Fmerge" \
  --jq '.content' | base64 -d | grep -n "<바꾼 줄>"
```

### 인증

**`CLAUDE_CODE_OAUTH_TOKEN` 시크릿이다.** 코멘트를 다는 주인은 별개로
Claude GitHub App(`github.com/apps/claude`)이고, 액션이 `id-token: write`로 받은 OIDC
토큰을 App 토큰으로 바꿔 쓴다. **그 권한이 없으면 시작도 못 한다.**
App은 `/install-github-app`으로 설치했다 (2026-08-24). 설치 전에는 `github_token`에
`secrets.GITHUB_TOKEN`을 넘겨 우회했고, 그때 코멘트 주인은 `github-actions[bot]`이었다.

# Sites Worker 인증 체크포인트 — 2026-10-08

## 결과

기존 Next.js App Router/MUI 앱을 Vinext 1.0.0-beta.5 + Vite 8.0.13 + Cloudflare workerd로 빌드하고 **실제 Worker HTTP 인증 계약 18건**을 통과했다. 별도의 로그인 구현, 가상 세션 주입, ChatGPT 로그인 대체를 사용하지 않았다. 실제 Google 계정 로그인은 아직 실행하지 않았다.

기존 Site 프로젝트와 GitHub `feat/sites-deployment` 브랜치를 유지한다. GitHub `main` 기준 `2f6b74d7b77106d38ad914eee14e1e073c61b039`은 변경하지 않았다. 이 체크포인트는 게시 완료를 뜻하지 않는다.

## 변경과 호환성

- NextAuth v4의 Babel/CommonJS default export가 Vite 8 기본 interop에서 함수로 해석되지 않아 실제 요청이 `TypeError: ... default ... is not a function`으로 실패했다. 공식 Vite 호환 옵션 `legacy.inconsistentCjsInterop: true`로 해결했다. 인증 handler와 Google provider 코드는 유지했다.
- Worker는 앱 디렉터리에 영구 로그 파일을 만들 수 없다. Worker에서 구조화 console 기록을 사용하여 요청 초기화 실패를 해결했다. 기존 Node 파일 로그 경로와 redaction 테스트를 유지한다. **관리자 로그 조회와 보존 정책의 영구 저장 전환은 아직 남아 있다.**
- React/ReactDOM을 19.2.4에서 Vinext가 요구하는 패치 버전 19.2.6으로 맞췄다. Next 16.2.4, MUI 9, NextAuth 4.24.14는 유지한다.
- ESM 프로젝트에서 기존 문서 생성 스크립트의 CommonJS 의미를 보존하기 위해 확장자를 `.cjs`로 바꿨다.
- `tsx` CLI의 불필요한 IPC 소켓 대신 `node --import tsx`로 기존 스크립트를 실행한다. ESM 단위 테스트는 bootstrap을 먼저 실행한 뒤 로그 모듈을 읽는다.
- 기존 Node 빌드는 `npm run build:next`, Sites Worker 빌드는 `npm run build`이다.

## 실행한 검증

| 검사 | 결과 |
| --- | --- |
| lint / TypeScript / FSD | 통과 (FSD fixture 5건 및 저장소 경계) |
| 단위 정책·범위·로그 | 14/14 통과, 이 클라우드의 Node 24.19.0 및 Node 26.11.1에서 실행 |
| 전체 앱 Worker 빌드 | 통과, `dist/server/index.js`와 클라이언트 자산 생성 |
| Worker 인증 HTTP | 18/18 통과, `npm run test:sites:auth` |
| MariaDB DB suite / D1 / R2 | 이 체크포인트에서는 미실행 |
| 실제 Google 로그인 / 배포 / 브라우저 QA | 미실행 |

Worker suite는 런타임 secret 부재 시 실패, provider 미구성 시 빈 provider 목록, 익명 빈 세션, CSRF 발급, HTTPS Secure/HttpOnly/SameSite=Lax cookie, task 로그인 redirect, 두 첨부 route의 익명 거부, Google callback 경로, 외부 redirect 거부, state 없는 callback의 세션 발급 거부를 확인한다. 모든 값은 로컬 가상 테스트 값이며 운영 credential을 사용하지 않는다.

Vinext scanner는 next-auth를 포괄적으로 unsupported로 분류한다. 이 경고를 없애거나 무시하지 않고 위에 구체적인 interop 실패/해결과 검증 범위를 기록한다. 실제 Google 토큰 교환, 로그인 갱신과 로그아웃의 운영 검증은 별도로 필요하다.

도구 경고: npm의 기존 http-proxy 설정 안내, Node module mocking 실험 경고, Vinext의 동적 route 정적 분류 한계/플러그인 성능 안내가 있다. font는 이번 Worker 빌드에서 실제 자산으로 생성됐다. 이전 컨테이너의 폰트 403 실패 또는 디스크 실측 수치를 이 환경의 결과로 사용하지 않는다.

## 운영 설정과 다음 단계

2026-10-08 확인 당시 Sites runtime env는 revision 0, 등록된 키가 없었다. Google Console의 callback 등록과 Sites 런타임 설정은 서로 다르다. 실제 값은 [Sites 설정](https://chatgpt.com/sites)의 wbscowork → More actions → Settings에서 소유자가 직접 입력한다. [공식 안내](https://learn.chatgpt.com/docs/sites#configure-runtime-environment-values).

- `GOOGLE_CLIENT_ID`, secret `GOOGLE_CLIENT_SECRET`, secret `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`: `https://wbscowork.cometgnome.chatgpt.site`
- `SUPERUSER_EMAIL`: 소유자가 명시적으로 선택한 Google 계정. 이 값은 전체 관리자 권한을 부여하므로 이메일을 임의로 추정하지 않는다.
- Google callback: `https://wbscowork.cometgnome.chatgpt.site/api/auth/callback/google`

다음은 D1 migration/SQL, R2 비공개 첨부와 부분 실패 정리, 영구 감사 로그/관리 설정의 호스팅 대응, 역할/소유권/업로드 실패 회귀 검사, 실제 Google 로그인, 승인된 접근 범위의 배포 검증이다. 기존 사용자 데이터/role의 이전이나 실제 사용자 승급은 이 변경에 포함하지 않는다.


## D1 추가 체크포인트

- generated Drizzle migration에 기존 6개 domain table과 감사 로그 table을 정의했다. 실제 요청 중 DDL은 금지하고 관리 화면은 migration 상태를 조회한다.
- Worker는 request-scoped DB/R2 binding을 사용한다. 기존 MariaDB 실행 경로는 보존했다.
- user upsert의 기존 admin/member 보존, 가시성 SQL, 99개 ID + project ID 분할, UTC timestamp, D1 atomic batch를 검증했다.
- superuser 설정 화면에는 설정 유무만 제공한다. OAuth secret/SUPERUSER_EMAIL 변경은 앱에서 차단하고 Sites 소유자 설정으로 안내한다. superuser 인증/인가 guard는 유지한다.
- 영구 감사 기록은 D1 audit_logs에 저장한다. 5일 기본 보존이며 새 기록 시 만료분을 최대 500건씩 정리하고, 조회에서 보존 기간 밖 항목은 즉시 제외한다. 유휴 상태의 자동 삭제는 아직 보장하지 않는다.
- `npm run test:sites:storage`: 실제 Miniflare D1 binding, 가상 사용자/데이터로 **21건 통과**. 이 검사는 Google 로그인 성공의 증거가 아니다.
- R2 bytes, 업로드/삭제 실패 복구, 전체 Worker 역할/실제 Google 로그인과 게시는 아직 남아 있다.
- Drizzle 설치 의존성의 @esbuild-kit deprecation 안내는 도구 의존성 경고로 기록한다. 런타임 에러를 숨기는 조치는 하지 않았다.

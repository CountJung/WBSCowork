# Sites 게시 사전 점검 — 2026-10-08

기존 버전의 설치·검증은 완료했고, Sites 전환은 **공식 도우미 파일 부재 및 Google OAuth 지원 미확인으로 구현 전 보류**한다. DB 전체 전환이나 Google 로그인의 ChatGPT 로그인 대체를 하지 않았다. 필요한 기능이 기술적으로 불가능하다고 확정한 것이 아니라, 현재 실행 환경에서 지원된 경로를 검증할 수 없는 상태다.

## 완료된 체크포인트

- 원본/원격 main: `2f6b74d7b77106d38ad914eee14e1e073c61b039`.
- 충돌 없는 새 브랜치: `feat/sites-deployment`.
- 최초 설치 실측 문서 커밋: `26ed97397aafa43b5e0844a5b6fe44bf2ff229d0`. 원격 브랜치의 같은 SHA를 `git ls-remote`로 확인했다.
- [기존 설치 실측 보고서](CLOUD_INSTALL_REPORT_2026-10-08.md): 실제 추가 4.236095 GB / 3.945171 GiB, 여유 27.798471 GB / 25.889343 GiB. Node26/npm 및 개발 의존성과 MariaDB 도구/이미지·격리 디스크 데이터까지 포함한다. 원본 Node/Next 검사와 Sites/Worker 검사는 별개다.
- lint/typecheck/FSD와 unit 14 + DB 33건은 tmpfs 및 disk DB 각각 PASS. 기본 Google Fonts build 실패, 별도 실제 폰트 보완 build PASS. 익명 production `/privacy` 200, 인증 의존 경로 `NO_SECRET` 500은 실측 보고서에 구분했다.
- 기존 commit/push 금지 범위는 해당 실측 시점까지였고, 이후 받은 단계별 commit/push 승인으로 문서 체크포인트를 새 브랜치에 게시했다. main은 변경하지 않았다.

## 실제 스킬·환경·도구 확인

이 세션의 카탈로그에는 `sites-building`/`sites-hosting`이라는 별도 스킬이 없다. 대신 읽은 현재의 통합 [Sites SKILL.md](skill://plugin_connector_1p_689987207de08191979cf68eca2941c6/sites/SKILL.md)가 setup/build/source packaging/publishing 절차를 제공한다. 이는 그 두 이름의 스킬을 실행했다고 주장하는 것이 아니다.

현재 스킬의 [storage.md](skill://plugin_connector_1p_689987207de08191979cf68eca2941c6/sites/references/storage.md), [identity-and-secrets.md](skill://plugin_connector_1p_689987207de08191979cf68eca2941c6/sites/references/identity-and-secrets.md), troubleshooting, Vinext starter README를 성공적으로 읽었다. 옛 이름으로 요청된 persistence/authentication/SQLite 파일 경로는 `failed to read skill resource`였다. SQLite의 현재 전제는 D1 공식 문서로 보충했다.

`skills.list(authority=executor)`는 빈 목록을 반환했다. `/workspace`, `/opt`, `/usr/local/share`, `/home/agent`, `/run/codex-environment`, `/tmp`의 파일명 검색에서 다음 공식 도우미를 찾지 못했다:

- `scripts/project-setup.mjs`
- `scripts/install-dependencies.mjs` (설치된 plugin-root 자체 미발견)
- `scripts/build-site.mjs`
- `scripts/site-workflow.mjs`

cloud skill resource의 `sites/scripts/project-setup.mjs`와 plugin-root `scripts/project-setup.mjs` 경로로도 읽기를 시도했으나 실패했다. 공식 파일을 임의로 재작성하거나 일반 개발 포트를 GPT 게시 주소로 대체하지 않았다.

반면 **Sites native API는 제공되며 읽기 호출도 성공했다.** `sites.list_sites({role:"owner",limit:20})`의 실제 반환은 `items: [], cursor: null`이다. 계정 연결 자체가 막힌 상태는 아니며 재연결을 요구하지 않는다. `.openai/hosting.json`은 저장소에 없다. 기존 Site ID가 없어 site별 public 접근 모드나 외부 사용자 허용 가능성을 `get_site`로 확인할 대상은 아직 없다.

`create_site`는 private unpublished Site와 단기 source write credential을 반환하는 계약이다. setup이 막혀 호출하지 않았고 Site/secret/credential을 생성하지 않았다. 별도의 approval rejection도 없었다. 이후 등록은 같은 Site에 한 번만 하고 반환 ID를 즉시 manifest에 저장해야 한다.

## Google OAuth와 실제 Worker 검증의 게이트

현재 Sites 인증 문서는 hosted 인증을 dispatch-owned로 설명하고 외부 identity provider를 추가하기 전에 플랫폼 지원을 확인하라고 요구한다:

> Confirm supported platform capabilities before adding an external identity provider.

이 규칙은 지원 확인을 요구하는 것이며 Google OAuth를 금지한다는 뜻은 아니다. 기존 NextAuth v4/Google 로그인 보존은 사용자 요구다. ChatGPT identity header를 Google 인증 세션 대신 사용하거나, 세션/권한을 우회하거나, starter의 로컬 ChatGPT mock 로그인으로 통과를 주장하지 않는다.

공식 helper가 제공되는 실행 환경과 외부 Google OAuth를 허용하는 Sites 경로를 확인한 다음, 별도 최소 검증본에서 다음을 순서대로 실행해야 한다. 현재는 모두 **Worker 미실행**이다.

1. NextAuth 4.24.14 App Router handler와 `getServerSession`, `next/headers`/cookies가 Vinext Worker 빌드와 실제 workerd 요청에서 동작하는지 확인. Node import 성공은 Worker 호환성 증거가 아니다.
2. 자격증명 없이 anonymous session, provider 미설정 시 fail closed, callback 경로, redirect allowlist, secure/HttpOnly/SameSite cookies 계약을 검증. mock 세션과 실제 로그인 결과를 구분.
3. 생성된 정확한 Sites origin과 지원 audience를 native `get_site` 반환으로 확인. private dispatch와 외부 Google 사용자의 진입 흐름을 구분.
4. 실제 로그인에 필요한 기존 Google OAuth callback 변경과 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `SUPERUSER_EMAIL`의 안전한 전달은 사용자가 별도 판단하도록 정확한 대상/조치를 먼저 제시. 이 파일에는 키 이름만 있다.
5. 이 경로가 성립한 뒤에만 전체 DB/파일 전환을 진행. 실패하면 조기 blocker를 보고하고 원본 앱을 유지.

[Vinext 공식 README](https://github.com/cloudflare/vinext)는 `next build` 산출물을 사용하는 대신 Next API를 재구현하며 앱별 호환성 검증을 요구한다. README에서 NextAuth v4 지원 보장은 찾지 못했으므로 WBSCowork의 기존 Next 빌드 성공을 Sites 인증 호환성으로 간주하지 않는다.

## 지원 확인 후 전환 범위와 검증 계약

읽기 조사에서 실제 `src/entities/**/*repository.server.ts` 6개와 `.query(` 호출 46개를 확인했다. DB managed table도 users/projects/tasks/submissions/submission_attachments/comments 6개다. 관련 기본 구조는 [PROJECT_MAP.md](PROJECT_MAP.md), [ARCHITECTURE.md](ARCHITECTURE.md)를 보존한다.

| 기존 진입점 / 계약 | Sites 전환 시 필요한 작업 |
| --- | --- |
| `src/shared/server/database`, 각 repository | MariaDB TCP pool 대신 request별 D1 binding. SQL/반환 타입·가시성 필터 보존 |
| `database-admin` schema | versioned schema-only migration. AUTO_INCREMENT/ENUM/upsert/insertId/INFORMATION_SCHEMA/ALTER MODIFY 등을 SQLite로 변환. 요청 중 DDL 금지 |
| IdScope IN 조회 | D1 100 bind 한도 안에서 다른 viewer 조건의 bind도 예약하고 chunk. 공개/타인 private 범위를 넓히지 않기 |
| 제출물/첨부 파일 | R2 서버 binding. 공개 객체 URL을 발급하지 않고 Google 세션 + 부모 제출물 visibility를 확인한 handler에서 stream |
| 업로드와 DB 쓰기 | 중단·중복·재시도와 R2 성공/DB 실패 및 반대 실패의 보상·idempotency 검증 |
| 파일 삭제와 project destruction | 재시도 가능한 정리 상태. 일부 실패를 성공으로 표시하지 않기 |
| local fs 감사 로그 / `.env` 직접 편집 | hosted logging/config/secret 경계로 재설계. Worker 런타임 파일 쓰기를 영구 저장으로 취급하지 않기 |
| admin DB 생성/설정 화면 | MUI 화면 및 superuser gate를 보존하면서 migration/hosting 관리와 요청의 책임을 분리 |
| users.role / SUPERUSER_EMAIL | guest/member/admin/superuser 정책 보존. 빈 D1에는 기존 role이 없어 승인된 데이터 이전 또는 기존 DB 연결 필요 |

D1은 SQLite 기반이고 query당 bound parameter 최대 100이다. [D1 SQL](https://developers.cloudflare.com/d1/sql-api/sql-statements/), [D1 한도](https://developers.cloudflare.com/d1/platform/limits/). 한 prepare당 한 statement와 여러 statement batch는 현재 Sites storage 스킬의 계약이다. Worker의 128 MB는 isolate 단위여서 동시 upload를 전체 Buffer로 적재하면 위험하다. stream과 서버측 크기 제한을 설계하고 부하를 측정해야 한다. [Workers 한도](https://developers.cloudflare.com/workers/platform/limits/). 이 문서의 검토가 실제 migration을 실행한 것은 아니다.

검증해야 할 시나리오: 비로그인, guest/member/admin/superuser, 타인 private attachment/download, 거부된 mutation, actor 본인 허용 mutation, 역할 변경·logout 후 세션 재평가, upload 중단·반복·허용 크기 경계, R2/DB 실패, delete 실패, orphan 정리·재시도. 로컬 Node/Next와 Worker 결과를 따로 기록하고 공개 전 필수 인가 matrix를 실제로 통과시킨다.

## 재개에 필요한 조치와 현재 상태

먼저 **현재 Sites plugin의 공식 helper/template 전체가 파일로 제공되는 실행 환경**이 필요하다. 클라우드에 해당 bundle을 공식 제공하거나 그 환경에 같은 저장소/브랜치를 연결하면, 위 작은 인증 검증본부터 재개할 수 있다. 사용자 판단/서비스 지원 확인이 필요한 지점은 Google OAuth 지원·실제 callback/secret 전달·기존 데이터/역할 이전·유료 서비스·외부 audience다. 지금 credentials, 데이터, 권한 설정을 변경해서 이를 회피하지 않는다.

최종 게시 성공 native 상태와 실제 반환 URL은 아직 없다. Sites 생성·version 저장·배포·D1/R2 provisioning·actual Google login은 미실행이다. 작업물은 `feat/sites-deployment`에서만 단계별로 커밋/푸시한다. main merge/강제 push는 하지 않는다. 기존 설치 실측은 첫 체크포인트 값으로 고정하며 Sites 의존성 설치 이후의 값과 섞지 않는다.

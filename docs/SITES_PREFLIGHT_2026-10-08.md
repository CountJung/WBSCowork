# Sites 게시 사전 점검 — 2026-10-08

기존 Node/Next 버전의 설치·검증은 완료했다. Sites 전환은 배포용 빌드 환경 준비와 Google OAuth 호환성 검증이 남아 있어 구현을 보류한다. 현재 결과만으로 Sites에서 Google 로그인이 불가능하다고 판단할 수는 없다.

## 기준 버전과 실측 결과

- 원본 main: `2f6b74d7b77106d38ad914eee14e1e073c61b039`.
- 작업 브랜치: `feat/sites-deployment`.
- 설치 실측 체크포인트: `26ed97397aafa43b5e0844a5b6fe44bf2ff229d0`. 원격 브랜치에서도 같은 SHA를 확인했다.
- [기존 설치 실측 보고서](CLOUD_INSTALL_REPORT_2026-10-08.md): 실제 추가 **4.236095 GB / 3.945171 GiB**, 여유 **27.798471 GB / 25.889343 GiB**. Node/npm, 개발 의존성, MariaDB 이미지와 격리된 디스크 DB를 포함한다.

| 기존 Node/Next 검증 | 결과 |
| --- | --- |
| lint / typecheck / FSD | 통과 |
| 단위 테스트 | 14건 통과 |
| tmpfs 및 디스크 DB 필수 테스트 | 각 환경에서 단위 14 + DB 33건 통과 |
| 기본 production build | Google Fonts 다운로드 실패 |
| 공식 폰트 파일을 사용한 별도 보완 build | 통과 |
| 익명 production HTTP `/privacy` | 200 |
| 인증 의존 production HTTP 경로 | 인증 설정 부재로 `NO_SECRET` 500 |

이 수치는 기존 버전의 체크포인트다. 이후 Sites 의존성·빌드·저장소의 용량은 별도로 측정해야 한다. Node/Next에서의 통과를 Worker에서의 통과로 간주하지 않는다.

## 배포 전 확인할 사항

현재 실행 환경에는 Sites용 빌드·배포 도구와 템플릿이 준비되지 않아 실제 Worker 검증을 실행하지 못했다. 해당 환경이 준비되면 전체 앱을 전환하기 전에 작은 인증 검증본부터 실행한다.

Google OAuth, NextAuth v4, 기존 MUI 화면과 guest/member/admin/슈퍼관리자 정책을 유지해야 한다. 게시 주소의 외부 사용자 접근 범위와 Google 로그인 흐름도 확인해야 한다. 예약된 사이트 주소는 아래와 같고 실제 배포는 아직 완료하지 않았다. 로컬 개발 포트는 게시 결과가 아니다.

### 사이트 등록 체크포인트

| 항목 | 확인된 값 |
| --- | --- |
| 사이트 이름 / slug | `wbscowork` |
| 프로젝트 ID | `appgprj_6ac75dba14348191801b002e0f2a0937` |
| 예약 origin | `https://wbscowork.cometgnome.chatgpt.site` |
| Google OAuth callback 등록 후보 | `https://wbscowork.cometgnome.chatgpt.site/api/auth/callback/google` |
| 현재 접근 범위 | 비공개 (`custom`), 공개 범위 변경 없음 |
| 선택 가능한 접근 모드 | `custom`, `public` |
| 현재 게시 상태 | 미게시, 버전 0, live/preview URL 없음 |

프로젝트 ID는 `.openai/hosting.json`에 보존했다. 예약 origin은 실제 등록에서 반환된 주소이며 게시 완료나 Google 로그인 성공을 뜻하지 않는다. callback 후보는 기존 NextAuth Google callback 경로를 붙인 값이다. OAuth 설정 변경과 실제 로그인 검증은 별도 단계다. 사이트 이름을 인증 비밀키로 사용하지 않았다.

[Vinext 공식 README](https://github.com/cloudflare/vinext)는 Next API를 재구현하는 방식으로 동작하며 앱별 호환성 검증을 요구한다. 기존 `next build` 결과만으로 WBSCowork의 Sites 호환성을 확인할 수는 없다.

## Google OAuth 최소 검증본

다음 항목은 아직 Worker에서 실행하지 않았다.

1. NextAuth 4.24.14 App Router handler, `getServerSession`, `next/headers` 및 cookies가 Worker 빌드와 실제 요청에서 동작하는지 확인한다.
2. 비로그인 세션, provider 미설정 시 접근 거부, callback 경로, 허용된 redirect와 Secure/HttpOnly/SameSite cookie 계약을 검증한다. mock 세션 검사와 실제 Google 로그인 결과를 구분한다.
3. 실제 게시 origin과 외부 사용자 접근 범위를 확인하고 Google 로그인 진입·callback·로그아웃 흐름을 검증한다.
4. 실제 로그인 검증 전에 기존 Google OAuth callback 설정과 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `SUPERUSER_EMAIL`의 배포 설정을 확정한다. 비밀값은 문서와 소스에 저장하지 않는다.
5. 인증 경로가 성립한 뒤에만 전체 DB·파일 전환을 진행한다. 호환성 문제가 발견되면 원본 앱을 유지하고 해결 범위를 다시 정한다.

## DB·파일 전환 범위

현재 repository 6개에서 `.query(` 호출 46개를 확인했다. 관리 테이블도 users/projects/tasks/submissions/submission_attachments/comments 6개다. 기존 구조는 [PROJECT_MAP.md](PROJECT_MAP.md), [ARCHITECTURE.md](ARCHITECTURE.md)를 참고한다.

| 기존 진입점 / 계약 | 필요한 전환 작업 |
| --- | --- |
| `src/shared/server/database`, 각 repository | MariaDB pool을 D1 binding으로 전환하고 SQL 반환 타입·가시성 필터 보존 |
| `database-admin` schema | versioned migration 도입. AUTO_INCREMENT/ENUM/upsert/insertId/INFORMATION_SCHEMA/ALTER MODIFY를 SQLite에 맞게 변환 |
| IdScope IN 조회 | 다른 viewer 조건까지 포함한 bind 수 제한을 지키면서 분할 조회. 조회 범위를 넓히지 않기 |
| 제출물·첨부 파일 | R2 서버 저장. 공개 객체 URL 대신 로그인과 부모 제출물 가시성을 검사하는 다운로드 handler 사용 |
| 업로드와 DB 쓰기 | 중단·중복·재시도, 파일/DB 중 한쪽만 성공한 경우의 복구와 고아 파일 정리 |
| 삭제·프로젝트 파기 | 부분 실패를 표시하고 재시도 가능한 정리 상태 관리 |
| 파일 기반 감사 로그·`.env` 편집 | 배포 환경의 로그·설정 관리로 전환. 런타임 파일 쓰기를 영구 저장으로 취급하지 않기 |
| DB 생성·설정 관리 화면 | MUI 화면과 슈퍼관리자 권한을 보존하면서 migration 및 배포 설정 관리에 맞게 조정 |
| users.role / SUPERUSER_EMAIL | 기존 역할 정책 보존. 빈 D1 DB가 기존 사용자 역할을 자동 유지하지 않으므로 데이터 이전 계획 별도 확정 |

D1은 SQLite 기반이며 query당 bound parameter 최대 100이다. 다른 조회 조건의 parameter도 이 한도에 포함해야 한다. [D1 SQL 문서](https://developers.cloudflare.com/d1/sql-api/sql-statements/), [D1 한도](https://developers.cloudflare.com/d1/platform/limits/).

Worker의 128 MB 메모리 제한은 isolate 단위다. 동시 업로드를 전체 Buffer로 적재하지 않도록 stream·서버측 크기 제한을 설계하고 메모리 사용량을 검증한다. [Workers 한도](https://developers.cloudflare.com/workers/platform/limits/).

## 공개 전 필수 검증

- 비로그인 및 guest/member/admin/슈퍼관리자별 조회·쓰기·관리자 접근.
- 타인의 비공개 제출물·첨부 직접 접근 거부와 작성자·관리자의 허용 동작.
- 역할 변경 및 로그아웃 후 세션·권한 재평가.
- 업로드 중단·반복·크기 경계와 파일 저장/DB 쓰기의 부분 실패.
- 삭제 실패, 고아 파일 정리 및 재시도의 일관성.
- 로컬 Node/Next와 Worker 결과를 분리한 기록, 실제 배포 성공 상태와 반환 URL 확인.

## 남은 개발 작업

Sites 빌드·배포 환경 준비 → 최소 인증 검증본 → D1/R2 전환 → 권한·실패 경로 회귀 검사 → 실제 게시 순서로 진행한다. 기존 데이터·역할 이전, OAuth 설정·비밀값 전달, 외부 사용자 접근 범위, 유료 서비스 이용 여부는 실행 전에 별도로 확정한다.

현재 Worker 빌드·HTTP, D1/R2 전환, 실제 Google 로그인과 배포는 미실행이다. 원본 main과 설치 실측 결과는 보존한다.

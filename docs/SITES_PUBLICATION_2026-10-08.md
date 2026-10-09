# Sites 공개 게시 결과 — 2026-10-08

## 배포 확인

- 서비스: https://wbscowork.cometgnome.chatgpt.site
- 접근 범위: public. 로그인 화면은 주소를 아는 사람이 접근할 수 있고 데이터·기능은 기존 Google 인증과 역할 정책으로 제한한다.
- Site project: `appgprj_6ac75dba14348191801b002e0f2a0937` (재등록 없음)
- 게시 version: 1
- version ID: `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_7894d6e0447c81919f700409977c8dc8`
- deployment: `appgdep_6ac7712050308191955deb33769f87fa`
- 최종 상태: succeeded, 2026-10-08 10:32:16 UTC
- 적용된 환경 revision: 11
- 게시된 소스: `9938b584c08f805f1321061643a1b3fb6339260e`
- 게시 소스 tree: `3fa3f4fabaa6b26e77d2adffec2b710c22721dd6`
- GitHub branch: `feat/sites-deployment`
- 보존된 GitHub main: `2f6b74d7b77106d38ad914eee14e1e073c61b039`

이 문서는 게시 후 추가한 기록이다. 문서-only 후속 commit과 위 실제 배포 commit을 구분한다. 운영 데이터나 기존 사용자 role은 이전하지 않았고 실제 계정의 권한을 임의로 부여하지 않았다.

## 운영 화면 및 로그인 확인

지원되는 클라우드 브라우저로 실제 공개 홈을 확인했다.

- 1180px desktop 및 500px narrow/mobile 폭: 기존 MUI 화면, 줄바꿈·hamburger 메뉴, 수평 overflow 없음.
- 앱 출처의 console 오류는 발견하지 않았다. 브라우저 확장 프로그램 metadata 안내 오류는 앱 오류와 구분했다.
- Google 로그인 버튼이 실제 Google 식별자 화면으로 이동했다. callback은 `/api/auth/callback/google`, scope는 openid/email/profile, PKCE가 포함된다.
- 해당 시점의 최근 Worker error log는 0건이었다.
- 사용자는 2026-10-08 본인 브라우저에서 로그인 성공을 확인했다고 보고했다. 이는 브라우저에서 직접 관찰한 로그인 진입과 별도 근거로 기록한다.
- 소유자는 클라우드 브라우저에 직접 로그인하기 위한 제어권을 요청했다. 비밀번호·MFA·Google 동의는 사용자가 직접 처리하며, 선택된 계정과 앱 role은 로그인 완료 후 확인한다. 이 기록 시점에는 계정 정보나 비밀값을 입력하지 않았다.

shell에서 시작한 별도 Chromium은 IPC EPERM으로 실패했다. 이 제한을 보안 설정 변경으로 우회하지 않았고, 이후 지원되는 클라우드 브라우저 경로로 공개 홈을 확인했다. 390px 정밀 viewport, 인증 후 프로젝트 화면의 실제 브라우저 CRUD, 지정 테스트 계정 권한 변경은 아직 완료하지 않았다.

## 자동 검증

- lint, TypeScript, FSD 통과 (FSD fixture 5건)
- Node 단위 검사 14건
- 실제 Worker 인증 계약 18건
- 실제 D1/R2 및 실패 복구 57건
- 실제 Worker HTTP 역할·첨부·로그아웃·동시 20MiB 업로드 92건

합성 세션 검사를 실제 Google 계정 로그인으로 표현하지 않는다. 세부 범위는 [최종 검증 기록](SITES_VALIDATION_2026-10-08.md)을 참고한다.

## 이 클라우드 실행 환경의 디스크 스냅샷

2026-10-08 약 10:38 UTC에 측정했다. 아래는 **현재 이 실행 환경**의 디렉터리 크기이며 이전 별도 컨테이너의 추가 설치 실측 `4.236095 GB / 3.945171 GiB`와 다른 결과다. 여기에는 이전 MariaDB/Docker 설치 실측을 합치지 않는다.

`du -sB1` 할당 블록 기준:

| 대상 | byte |
| --- | ---: |
| 작업 checkout 전체 (node_modules 포함) | 1,096,945,664 |
| node_modules (위 전체의 부분집합) | 1,083,822,080 |
| Git history (위 전체의 부분집합) | 4,247,552 |
| Worker/client dist (위 전체의 부분집합) | 4,927,488 |
| npm cache | 1,020,772,352 |
| checkout + npm cache의 du 합계 | 2,117,718,016 |

합계는 약 **2.118 GB / 1.972 GiB**다. 중첩 행을 다시 더하지 않는다. `du`의 디렉터리 할당량과 overlay filesystem의 실제 사용량은 계층·공유 방식 때문에 동일하지 않을 수 있다. `df -B1` 당시 filesystem 전체 사용 1,270,194,176 byte, 여유 30,765,236,224 byte였다. 이 값은 이 작업만의 독점 사용량이 아니다.

`du -b` 파일 논리 크기는 checkout 966,154,210 byte + npm cache 1,015,565,512 byte였다. 로컬 gzip 배포 archive는 1,367,778 byte이다. 배포 서비스는 이를 자체 tar 형식으로 저장하므로 반환 archive size와 압축 파일 크기는 다르다.

이 환경의 설치 전 정확한 byte 기준선은 확보하지 않았으므로 위 스냅샷을 ‘추가 설치량’으로 표현하지 않는다. 도구, cache, 빌드 출력은 용량을 줄여 보이기 위해 삭제하지 않았다.

## 클라우드 브라우저 실제 로그인 확인 — 13:14 UTC

소유자가 직접 Google 인증을 완료한 뒤 에이전트가 같은 클라우드 브라우저에서 /tasks의 로그아웃·슈퍼관리자 표시와 /admin의 인증된 계정·관리 개요를 직접 확인했다. DB role은 admin이고 구성된 슈퍼관리자 판정도 적용되었다. 개인 이메일·비밀번호·토큰은 이 기록에 저장하지 않는다. 사용자 1명, 프로젝트 0개였으며 조회만 했고 데이터·권한을 변경하지 않았다. 이 결과는 이전의 사용자 보고 및 Google 식별자 진입 검사보다 강한 실제 앱 인증 근거다.

관리 개요에서 D1 대상이 undefined로 보이고 과거 MariaDB/파일 로그 설명이 남는 표시 결함을 발견했다. OPS-025에서 수정·재게시하며, 프로젝트 쓰기 실환경 검사는 OPS-024 승인 후 별도로 다룬다.

## 관리자 표시 수정 게시 — version 2

- 소스 `8fc2cc69cdc8548739ae9ae2ed208ebc6fe47ce7`, tree `684bd70633a73fe21aacdc8b4155e8570db4582a`.
- version `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_7ea31832eb848191b1f5928c64f56ad8`.
- deployment `appgdep_6ac79a4f82888191b8617754bdb85177`: 13:27:53 UTC succeeded. public, 동일 origin/환경 revision 11.
- 소유자 로그인 세션으로 수정된 /admin D1/R2·슈퍼관리자·Sites 설정·감사 보존 안내를 직접 확인했다.

## 버그 제보·리뷰 게시 — version 3

- 소스 `f294edd620bee5cc557989a690e95dddfefb1354`, tree `da81b6eadfe58f61dfc6a9a2853840c46eb92e85`.
- version `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_7648d00bc3448191be2a284d814dc067`.
- deployment `appgdep_6ac7a743cd608191882d9a80fc0d84dd`: 14:23:10 UTC succeeded, public/환경 revision 11.
- 사용자 화면: https://wbscowork.cometgnome.chatgpt.site/bugs . 관리자 리뷰: https://wbscowork.cometgnome.chatgpt.site/admin/bugs . 기존 Google/역할 세션으로 보호한다.
- 실제 empty-page/nav/form rendering과 1181px/503px 폭 확인, DB schema에 독립 archive 두 테이블 추가, 조회 당시 둘 다 0건. Worker 최근 error event 0. 실제 제보 작성은 OPS-029, native DB runtime은 OPS-028에서 별도 추적한다.

## RSC 보안 패치 게시 — version4

- 소스 `9a5367d607ce9a515b794d9a963a673a404a00f9`, tree `7b860f4dc247b4582ee8c2c2cbac1b13994068de`.
- version `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_1e4ba05b765c8191b8fa314649acf891`.
- deployment `appgdep_6ac7b2f65b08819184da0c608035c5f8`: 15:13:05 UTC succeeded, 동일 public origin/환경 revision11.
- native 저장 archive content hash `sha256:7d056c7b52951a5eceb40bb21bad517eed13e9beb0d206e62fbb5bf16a254124`, 295 files, normalized tar4,454,400bytes.
- 독립 검토된 실제 decoder가 포함된 archive이며 기존 세션으로 실제 bug 제보/검토/해결까지 확인했다. [security 범위](SECURITY_PATCH_2026-10-08.md), [live bug QA](SITES_BUG_QA_2026-10-08.md).

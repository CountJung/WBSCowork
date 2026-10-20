# 버그 제보 스크린샷 — 2026-10-20

## 구현과 보존 경계

`/bugs`에서 원문과 PNG/JPEG/WebP 스크린샷을 함께 제출한다. 파일당 2MiB, 최대 3개다. 선택 미리보기/제출 전 제거, 업로드 중 중복 제출 방지, 실패 시 입력·선택 파일 유지 후 재시도를 제공한다. 저장된 스크린샷은 새 요청과 새로고침 후 `/bugs/[id]`에서 확인한다. 첨부 없는 기존 제보도 그대로 조회한다. 원문/첨부는 저장 후 수정하지 않는다.

클라이언트의 MIME/크기/개수 검사와 별개로 서버에서 MIME·바이트 signature·크기·개수·필드·텍스트 envelope를 검사한다. 공개 URL이나 브라우저 storage에 저장하지 않는다. 기존 제출물의 파일 IO를 shared private-files로 추출해 같은 `ATTACHMENTS` R2/Node `UPLOAD_DIR`와 파일명 정규화·스트림 업로드·내용 해시를 재사용한다. 버그 파일 key는 `bugs/<actor>/...`여서 프로젝트 파일 정리에 섞이지 않는다.

메타데이터와 불변 제보/최초 이력은 한 DB transaction에 저장한다. 본문과 첨부의 이름/MIME/크기/bytes hash를 creation fingerprint로 묶어 동일 재시도는 중복 기록을 만들지 않고 다른 payload 재시도는 거부한다. 업로드/DB 실패 시 새 파일만 정리하고, R2 실패는 기존 durable cleanup queue로 복구한다. 만료된 staging lease는 DB trigger가 commit을 거부한다. cleanup은 버그 파일 참조까지 검사하여 저장된 파일을 삭제하지 않는다.

다운로드 `/api/bug-screenshots/[screenshotId]`는 매 요청에서 실제 사용자/현재 역할과 부모 제보 권한을 검사한다. 작성자 또는 관리자만 조회하며 타인/없는 ID는 같은 404다. 익명은 401. 휴지통의 첨부는 관리자만 조회한다. 파일은 `private, no-store`, `nosniff`, sandbox CSP로 제공하며 최적화 서버나 공개 객체 URL로 전달하지 않는다.

`/bugs` multipart 요청만 7MiB로 늘리고 다른 bug endpoint는 기존 64KiB, action 텍스트는 기존 48KiB, 전체 Worker는 기존 22MiB와 동시 multipart 1건 제한을 유지한다. 추가 설명/리뷰/수명주기 action은 계속 file input을 거부한다.

## 비파괴 migration

Drizzle `0013_volatile_catseye.sql`: 새 `bug_report_screenshots` 표/인덱스/CHECK/FK/lease·cleanup trigger와 `bug_reports.creation_fingerprint NOT NULL DEFAULT ''` 추가만 포함한다. 기존 migration/snapshot/ledger는 수정하지 않는다. 데이터 DML, 기존 표 rebuild/DROP은 없다. 기존 Site ID, public 정책, D1 `DB`, R2 `ATTACHMENTS`, Google/계정 권한·비밀값은 보존한다.

Native v9도 additive 명세를 추가했으며 별도 운영 적용은 하지 않는다. 첨부 없는 기존 native 영구 삭제는 유지한다. **첨부 있는 native 제보는 durable 파일 정리 절차가 구현되기 전 영구 삭제를 거부하여 원문/파일을 보존한다(QLT-020).** Sites의 기존 명시 확인된 purge는 screenshot metadata cascade와 R2 cleanup queue를 함께 사용한다. 이번 작업은 운영 제보의 생성·삭제·purge, 계정/보안 변경, NAS 배포를 수행하지 않는다.

## 검증

- lint/typecheck/FSD 통과. Vinext가 남기는 `.next` type stub과 기존 Next validator가 충돌할 때 로컬 `next typegen`으로 생성 타입을 갱신 후 typecheck했다. 추적 소스/tsconfig는 바꾸지 않았다.
- `test:sites:bug-screenshots`: D1/R2 28 PASS — 첨부 없는 제보, 3개 저장, 타인/관리자/휴지통 경계, 재조회, 동일/충돌 재시도, DB rollback, R2 두 번째 put 실패, 만료 lease, 미참조 파일 정리/참조 보호.
- `test:sites:bugs`: 기존 D1 버그 계약 58 PASS.
- `test:sites:bug-screenshots:browser`: Chromium 실제 production bundle, 1280/390px 19 PASS — 선택/제거/형식/개수 제한, 합성503 실패와 입력 유지, 재시도 제출, 이미지 decode, 새로고침, overflow/uncaught error 검사. `.test-artifacts/bug-screenshots/`에 데스크톱/모바일 evidence. 합성 gateway는 loopback만 허용하고 외부 요청을 차단한다.
- 기존 공통 레이아웃: 6개 너비/48조건 PASS, failures/errors 모두 0. 기본 실행 sandbox에서는 Chromium SUID 구성이 거부돼 승인된 실행 경로로 기본 Chromium sandbox를 유지해 실행했다. Chromium sandbox나 플랫폼 보안 설정을 변경하지 않았다.
- 기존 Worker NextAuth 18 PASS, 네트워크 보호 회귀 12 PASS. 실제 Google 로그인은 테스트하지 않았다.
- Native additive migration 99 PASS: loopback3307의 새 `_test` DB를 보존하고 1~9 migration 및 기존 row/role/ledger 보존 검증. 생성된 합성 DB는 테스트 출력에 기록하며 삭제하지 않았다.
- 기존 `npm test` 단위 108 중 105 PASS/3 FAIL. QLT-019의 `GoogleProvider is not a function`가 Node24.19.0 및 별도 임시 Node26.12.0에서 재현됐다. 격리3307 DB 기동 후 visibility suite도 동일 import 오류로 미검증이며 `test:sites:storage` 역시 동일 오류다. 인증/테스트 loader를 이번 기능에서 변경하지 않았다.
- `test:sites:workflow`는 기존 QLT-016 동시 form의503을 재현했다. 이를 pass로 계산하지 않는다. 기존 full HTTP fixture의 누락된 operation token/version/revision/change summary/삭제 확인 필드를 현재 계약에 맞추어 보완했다. 버그 HTTP와 full HTTP 최종 결과는 아래 게시 기록에 추가한다.
- 최초 `npm ci`는 기본 cache 디렉터리를 쓸 수 없어 실패했고, `/workspace/.cache/npm`의 새 cache로 고정 lockfile 설치를 완료했다. lockfile/의존성 버전을 변경하지 않았다. 빌드의 proxy 감지/정적 route 분류 안내와 module mocking experimental 안내는 기존 도구 기준선이다.

## 운영 접근 및 게시

기존 `docs/SITES_TEST_NETWORK_2026-10-19.md`와 loopback guard를 보존했다. 익명 GET-only `test:sites:live`는 exit1 / `proxy_connect` / `CONNECT 403 Forbidden` / `Domain forbidden`, `live_http_completed=false`를 재현했다. 프록시·NO_PROXY·인증서·outbound policy를 변경하지 않았고 운영으로 합성 session을 보내지 않았다. 이 환경의 합성 성공은 운영 UI 인수가 아니다. 부모의 접속 가능한 클라우드 브라우저에서 읽기 전용 `/bugs` 폼·모바일 확인은 별도다.

게시 전 `get_site`는 기존 public/version11/source repository HEAD `0a2cbb5fc42d8917ba1a605f0e9c5b6360188962`를 확인했다. 15개 업무·계정·제보 표의 모든 row를 read-only로 메모리에 읽고 pagination/truncation이 없음을 확인했다(사용자2/기존 purge receipt1, 나머지0). 게시 후 동일 row 비교와 새 schema 확인을 별도로 기록한다. audit 전체/R2 inventory 보존까지 주장하지 않는다.

이 환경에는 Sites 스킬의 `site-workflow.mjs`/`build-site.mjs`가 설치돼 있지 않아, 기존 version11의 문서화된 대체 흐름을 따른다. 정확한 GitHub SHA를 Sites source main에 fast-forward, 같은 SHA의 로컬 Vinext output과 변경 없는 hosting manifest·append-only Drizzle migration을 archive로 묶어 native save/deploy 도구로 게시한다. credential은 메모리에서 echo-off stdin으로만 전달한다. 이 절차는 네트워크 제한이나 공개 범위 변경을 우회하지 않는다.

최종 Worker HTTP: `node scripts/test-sites-http.mjs --bugs` 200 PASS; `npm run test:sites:http` 248 PASS. full fixture는 기존20MiB 업로드, 부모/첨부 가시성, 버그 수명주기, 새 이미지 권한, 기존 CRUD/파일 정리/역할 refresh/logout을 포함한다. 누락 token/version/변경 요약/현재 revision scope/삭제 확인 필드만 합성 하네스에 보완했다. full suite 중 기존 제출물 삭제가 DB/파일 제거 후에도 오류 로그/오류 redirect를 반환하는 현상을 발견했다(QLT-021). 이를 오류 없는 사용자 흐름으로 주장하지 않는다. 한 회차의 기존404 response 소비 오류는 동일 명령 최종 재실행에서 재현되지 않았다.

## 최종 게시 확인

- 동일 Site project: `appgprj_6ac75dba14348191801b002e0f2a0937`.
- URL: https://wbscowork.cometgnome.chatgpt.site — 버그 폼 https://wbscowork.cometgnome.chatgpt.site/bugs .
- 게시 version12: `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_18e1378ab8f48191a6697fc282cd9022`.
- 실제 게시 SHA: `0d1a1a3afe8680ddd7c1281b583fd9d846cc0bc1` (`feat: attach private screenshots to bug reports`). GitHub `feat/bug-screenshots`/`feat/sites-deployment` 및 별도 Sites source main에 fast-forward push하고 원격 일치를 확인했다. GitHub NAS main은 `089151345f4221fb11e7c07adafc8748d571e319` 그대로다.
- deployment: `appgdep_6ad701611af48191b37ff6b4a1548d2c`, **succeeded**, 2026-10-20 05:51:39 UTC, env revision11. native deploy 반환과 `get_site`/`get_site_version`으로 version12·exactSHA·deployment 연결을 확인했다. pending/unknown 상태가 아니다.
- source archive: `/workspace/wbscowork-bug-screenshots-0d1a1a3.tar.gz`, 1,485,966 bytes, 로컬 SHA256 `6b6bba6afeaa878d605c06271976bc5bce663228b26ccad3a8f887913b3c28cd`. Sites 정규화 archive는350files/5,273,600bytes, hash `sha256:6ead63551d163a42f3051af51fd8aa8607da9a81b7f5b7134488d07202409309`.
- 게시 후 get_site public/access policy(revision2) 전체 동일. read-only D1에서 새 screenshot표/버그 fingerprint컬럼을 확인했다. 게시 전후15개 표의 전체 row가 동일하고 모든 조회는 pagination/truncation이 없다. 사용자2명과 기존 purge receipt1건 보존, 새 screenshot표0건이다. 운영 synthetic report를 만들지 않았다. audit전체/R2 inventory를 비교한 것은 아니다.
- 게시 직후 최근5분 Worker error event0건. 차단된 실행기의 요청이 Worker까지 도달했다는 의미나 운영 브라우저 성공의 근거로 쓰지 않는다.
- 이 문단은 게시 후 문서 전용 후속 commit으로 저장한다. 실제 게시 소스 SHA는 위 `0d1a1a3`이며 후속 문서 commit을 배포 SHA로 혼동하지 않는다. 운영 UI는 기존 outbound 제한으로 여전히 미검증(OPS-035)이다.

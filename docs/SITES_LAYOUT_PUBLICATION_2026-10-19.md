# 공통 레이아웃 Sites 게시 — 2026-10-19

사용자가 이번 레이아웃 수정의 클라우드 게시를 승인했다. 이 승인은 이번 배포에 한정되며 향후 게시의 포괄 승인이 아니다. 이후 작업은 해당 요청에 "게시까지"가 명시된 경우 그 작업의 게시까지 수행하고, 그 외에는 게시 전에 확인한다. NAS main 반영·NAS 배포는 포함하지 않는다.

## 게시 결과

- URL: https://wbscowork.cometgnome.chatgpt.site
- 공개 범위: 기존 public 유지. 환경 revision11 유지. 계정 권한·비밀정보·보안 설정 변경 없음.
- 게시 version11: `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_6ccaa55524088191b9920d7b2f9c6d03`.
- 게시 소스: `0a2cbb5fc42d8917ba1a605f0e9c5b6360188962`.
- 성공 deployment: `appgdep_6ad5960689f881918f7dde37c3376428`, `succeeded`, 2026-10-19 04:01:18 UTC.
- 저장 artifact:343files/5,171,200bytes, Sites 반환 content hash `sha256:0a8936cab053f800b53e056f47abf6b4b3d2795338181bb58115707fc8e99e1a`.

배포 전 version10/소스 `3b4af81e175ca0cd889fdc2cb2f13bead9bec7b0` 이후 게시나 별도 source 변경이 없음을 확인했다. GitHub `feat/sites-deployment`는 기존 `b43704e`에서 승인된 `0a2cbb5`까지 정상 fast-forward했다. 별도 Sites source repository도 기존 version10 소스에서 같은 SHA로 fast-forward하고 원격 일치를 확인했다. NAS main은 `089151345f4221fb11e7c07adafc8748d571e319` 그대로다. 이 문서는 게시 후 기록하는 문서 전용 후속 commit이며 실제 게시 SHA와 구분한다.

## 패키징 실패와 복구

이 실행 환경에는 Sites 스킬이 설명한 `site-workflow.mjs`/`build-site.mjs` 파일이 설치돼 있지 않았다. source credential은 메모리·echo가 꺼진 stdin으로만 전달했고 파일/명령행/로그에 저장하지 않았다. Git transport는 제공된 `http_extra_header` 계약으로 사용했다.

지원되는 source-only 원격 build fallback으로 처음 저장한 version11의 deployment `appgdep_6ad59501b7ac8191af20d8792878205a`는 `build_output_missing_hosting_metadata`로 terminal failed였다. 원격 Vinext 빌드가 `dist/.openai/hosting.json` 또는 `dist/_appgen_meta/appgarden.json`을 생성하지 못했으며 새 Worker 업로드 전 실패했다.

검증된 동일 SHA의 로컬 `dist`에 기존 `.openai/hosting.json`을 그대로 복사하고 변경 없는 Drizzle migration을 포함했다. source manifest와 Worker/DB/R2 선언을 바꾸지 않았다. archive는 루트 `.openai/hosting.json`, `dist/server/index.js`, `dist/client`, `dist/.openai/hosting.json`, `drizzle` 구조다. 첫 root-relative archive는 지원 entrypoint 경로 검사에서 저장 전에 거부됐고, `dist/` 경로를 보존한 수정 archive는 저장·게시 모두 성공했다. 새 앱 코드나 schema를 만들거나 이전 실패를 숨기지 않았다. 공식 도우미가 설치된 환경에서는 그 도우미를 우선 사용한다.

## 검증과 제한

- `get_site`: public, latest version11, 기존 URL 확인. `get_site_version`: 소스 SHA와 성공 deployment의 연결 확인.
- 게시 전후 D1의 업무·사용자·버그 관련16개 표를 읽기 전용으로 비교했다. 모두 페이지 누락 없이 완전히 조회됐고 모든 row가 동일했다. 사용자2/기존 purge receipt1, 나머지14개 표0건. 감사 표 전체나 R2 bucket inventory의 동일성까지 검증한 것은 아니다. 실제 데이터 쓰기·운영 QA 자료 생성·권한 변경 없음.
- 게시 직후 최근5분 Worker error log 조회0건. 이 환경의 차단된 HTTP 요청이 앱에 도달했다는 증거는 아니다.
- [소스 검증](UI_LAYOUT_2026-10-19.md): Chromium 합성48조건, 양쪽 build, lint/typecheck/FSD, Worker auth18 PASS. 기존 Node24 단위3건 실패/DB 미실행은 QLT-019와 구분한다.
- **실사이트 HTTP·UI는 미검증**: 일반 HTTP는 proxy CONNECT403, Chromium은 `ERR_TUNNEL_CONNECTION_FAILED`, 웹 읽기 도구도 URL 접근 실패였다. 새 게시 후 정상 Chromium 재시도도 같은 네트워크 제한이었다. proxy 우회·보안 설정 변경·실제 계정 로그인은 하지 않았다. 접속 가능한 브라우저에서 실제 로그인된 작업/관리자/버그 화면의6개 너비를 확인하는 인수는 OPS-033에 남긴다. 소스 합성 검증을 live QA로 계산하지 않는다.

후속 보고: 부모의 별도 클라우드 Chrome에서 04:25 UTC/1188×761의 홈·로그인된 작업 화면을 정상 확인했다. 코딩 환경은 추가 진단에서 플랫폼 restricted outbound 허용 목록의 대상host 누락과 `Domain forbidden` 응답을 확인했다. 새 익명 운영 smoke·합성 guard 및 승인 후 필요한 최소 조치는 [네트워크 진단](SITES_TEST_NETWORK_2026-10-19.md)에 있으며, OPS-033/034의 남은 범위와 구분한다.

## 다음 클라우드 작업의 게시 조건과 흐름

사용자가 해당 작업에서 **게시까지 명시적으로 요청한 경우** 저장소·현재 게시/소스 변경 확인 → bounded 구현 → 합성 검증과 품질 검사 → 작업 단위 커밋·푸시 → 기존 Site/audience/binding을 보존해 게시 → exact version/SHA와 HTTP/UI/데이터 보존 확인 → 결과 문서화까지 진행한다. 그 외에는 게시 전에 확인한다. 항상 자동 게시하는 규칙은 저장하지 않는다. 운영 데이터 변경·계정 권한/비밀값/보안 설정 변경·NAS 배포는 해당 클라우드 게시 요청에 포함되지 않는다.

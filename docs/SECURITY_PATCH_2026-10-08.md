# RSC 보안 패치 — 2026-10-08

## 대상과 판단

게시된 f294edd Worker의 Server Action decoder에서 React 19.2.6의 해당 코드를 확인했고, 앱 인증·역할 검사보다 먼저 실행되는 경로도 확인했다. GHSA-wx67-qw84-cm4g / CVE-2026-44907은 Server Functions의 CPU/메모리 고갈을 유발할 수 있는 High 등급 문제이며 19.2 계열 수정판은 19.2.8이다. 침해나 실제 서비스 중단을 관측했다는 뜻은 아니다. 공개 서비스에 공격·부하 테스트는 수행하지 않았다.

근거: [React advisory](https://github.com/react/react/security/advisories/GHSA-wx67-qw84-cm4g), [공식 수정](https://github.com/react/react/commit/1dd4ecbdabf826f527fc9a58c05ea70375b7d170).

## 최소 수정

react / react-dom / react-server-dom-webpack 세 패키지만 19.2.8로 고정했다. npm은 3개 패키지 변경을 보고했고 lockfile 차이도 이 세 항목의 version/integrity/peer range에 한정됐다. Vinext beta.5, plugin-rsc 0.5.26, NextAuth/Google 구성과 역할 정책은 변경하지 않았다.

plugin-rsc에는 이전 vendor fallback이 남지만 이 프로젝트는 direct react-server-dom-webpack을 선택하는 공식 alias 경로를 사용한다. 패키지 metadata만으로 판단하지 않고 생성된 Worker의 실제 decoder를 확인한다. [plugin-rsc 0.5.26 공식 설명](https://github.com/vitejs/vite-plugin-react/blob/plugin-rsc@0.5.26/packages/plugin-rsc/README.md#using-different-react-versions).

## 검증

- 새 decoder는 form field 순회 중 action key 하나를 선택하고 순회가 끝난 뒤 decode한다. 이전 repeated-action accumulation이 없음을 정적으로 확인했다.
- `npm run test:sites:decoder`: 실제 compiled artifact fingerprint 검사. 공격을 전송하는 검사가 아니다.
- lint/typecheck/FSD/production Worker build 통과.
- unit 30, D1/R2 57, bug archive D1 26, actual Worker HTTP 185, credential-free auth 18 통과.
- 기존 Google callback, 익명 거부, guest/member/admin/superuser, 교차 사용자 비공개 데이터, 일반 multipart action, 같은 이름 재첨부, 20MiB admission/body cap, role refresh/logout 등을 유지했다.
- 실제 인증된 브라우저의 bug report 작성→검토→해결은 패치 게시 후 승인받은 합성 1건으로 별도 확인한다. 실환경 사용자 역할은 변경하지 않는다.

## 남은 범위

npm audit의 33건은 영향받는 package entry 수이며, 33개의 서로 다른 중대 advisory 수가 아니다. 이 패치가 audit 전체를 해소했다는 뜻은 아니다. Next/NextAuth/MariaDB 등의 다른 보고는 Worker와 native Node, 실제 인증 방식·이미지 경로·DB 연결 사용 여부를 구분해 추적한다. native MariaDB와 Windows/Node 전용 실행 경로에는 별도 보수 검토가 필요하다. 일괄 major override나 `npm audit fix --force`는 실행하지 않았다.

## 독립 산출물 확인

읽기 전용 검토에서 active import 경로 `dist/server/index.js` → `_next/static/rsc-BV_Dc-WK.js` → `framework~index~page~actions~page~page~page~actions~page~actions~page~actions~page~page~pag~i89odak0-9XpujYZx.js`를 확인했다. 마지막 chunk SHA-256은 `a75c3e7add6877c6d33f32aeb7dbe8bc56abd29735f8d5ffce777743b45b764f`다. decodeAction/decodeFormState가 순회 후 한 번 decode하는 구현이며, 직접 설치된 19.2.8 경로를 사용한다. 게시 전 검토 통과이며 실제 배포 완료는 별도 publication 기록으로 확인한다.

게시 확인: source9a5367d, Siteversion4/deployment appgdep_6ac7b2f65b08819184da0c608035c5f8가 15:13:05 UTC succeeded. 기존 owner 세션으로 승인된 합성 bug 작성·추가 설명·검토·해결 UI를 확인했다. Native DB 재검증은 직전f31f9dc/React19.2.6 범위이며 이를 새 React native 실행 증거로 확대하지 않는다.

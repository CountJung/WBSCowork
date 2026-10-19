# Sites 테스트 네트워크 진단 — 2026-10-19

## 확인한 원인

코딩 실행 환경은 `http://proxy:8080`을 통해 외부 HTTPS에 접속한다. `HTTP_PROXY/http_proxy/HTTPS_PROXY/https_proxy`가 일치하고, `NO_PROXY/no_proxy`는 모두 `localhost,127.0.0.1,::1`이다. 잘못된 프록시 선택이나 대소문자 설정 충돌은 없었다. 프록시 자격증명을 읽거나 출력하지 않았다.

읽기 전용 `/etc/codex/network-policy.json`에서 `http_network_policy.type = restricted`이며 `http_network_policy.egress_rules`에 `wbscowork.cometgnome.chatgpt.site`가 없음을 확인했다. 파일은0444이고 현재 사용자가 쓸 수 없는 플랫폼 관리 설정이다.

기존 프록시를 사용하는 표준 CONNECT 요청의 응답은 다음과 같다.

```text
CONNECT wbscowork.cometgnome.chatgpt.site:443
403 Forbidden
server: envoy
content-type: text/plain
content-length: 16

Domain forbidden
```

대상 사이트와 TLS 연결을 맺기 전 거부되므로 사이트 자체403이나 Google 로그인·앱 권한 문제가 아니다. 최초 검증에는 오류 요약만 있었고, 이번에 승인된 진단에서 위 안전한 응답 필드와 정책 사유를 추가로 확보했다.

부모 스레드 보고: 2026-10-19 04:25 UTC, 별도 클라우드 Chrome에서1188×761 실제 픽셀로 동일 사이트의 `/`와 로그인된 `/tasks`를 정상 열고 컨테이너 정렬·별도 메뉴 행·버튼 한 줄·카드 반경을 확인했다. 다른 실행 환경으로 사이트에 접속할 수 있다는 근거이며 코딩 환경이 고쳐졌다거나 전체6개 너비·관리자/버그 화면이 모두 검증됐다는 뜻은 아니다.

## 수정한 테스트 경계와 진단

- `test:ui:layout`과 기존 `test:sites:browser`의 Python 진입점은 loopback만 받는다. 운영 URL을 직접 넣어도 브라우저 기동·합성 session 전송 전에 실패한다.
- `test:sites:network`는 운영 요청 없는12개 회귀다. 실제 로컬 CONNECT 거부·자격증명 비노출·사이트 HTTP403/프록시403 구분·거부 시 nonzero exit·GET-only·로그인 redirect 미추적·부분 성공 보존·로컬 HTTP 성공 경로를 검증한다.
- `diagnose:sites:network`는 현재 설정을 읽고 기존 프록시로 CONNECT를 진단한다. 정책을 읽을 수 없으면 unknown으로 남기고 허용됐다고 추정하지 않는다. 인식한 안전한 정책 메시지만 출력하며 임의 응답 본문은 해시만 기록한다.
- `test:sites:live`는 로그인·cookie 없이 GET만 하는 운영 HTTP smoke다. `/`, `/privacy`, 빈 익명 session, `/tasks`·`/admin`·`/bugs`의 같은 origin 로그인 redirect를 검사한다. 로그인·쓰기·UI 검사를 수행하지 않는다.
- 거부는 `result=failed`, exit1이다. pass나 skip으로 바꾸지 않는다. `failure_stage=proxy_connect`와 `site_http`를 구분하고, 운영 HTTP 검사를 완료하지 못하면 `live_http_completed=false`다. loopback 성공도 fixture로 명시해 live 통과로 계산하지 않는다.
- 프록시 환경·NO_PROXY·인증서·네트워크 규칙·앱 권한·보안 설정은 변경하지 않는다.

## 실행 명령과 이번 결과

```bash
# 합성 네트워크/스크립트 회귀
npm run test:sites:network
# 이미 빌드한 Worker + 격리 D1/브라우저; 실행 중 운영 사이트 접속 없음
npm run test:ui:layout
# 현재 네트워크 진단: 플랫폼 규칙 거부로 여전히 exit1
npm run diagnose:sites:network -- --url https://wbscowork.cometgnome.chatgpt.site
# 정상 네트워크에서 익명 운영 HTTP smoke; 앱 재게시 불필요
npm run test:sites:live -- --url https://wbscowork.cometgnome.chatgpt.site
```

기본 보고서는 `.test-artifacts/sites-live/results.json`이며 `--output`으로 다른 경로를 지정할 수 있다. `diagnostic_completed`는 진단만 끝났다는 뜻이고 운영 HTTP 계약 통과가 아니다.

이번 네트워크 회귀12 PASS, lint/typecheck 통과. 운영 smoke는 실제 exit1, `proxy_connect / CONNECT 403 Forbidden / Domain forbidden`이며 운영 HTTP 검사를 시작하지 못했다. 수정 후 로컬 UI48조건은 HARNESS_MAP에 별도 기록한다. 앱 코드 변경이 없어 앱 build/배포는 다시 하지 않았다. 기존 Node24 단위 실패 QLT-019는 이번 네트워크 수정과 별도다.

## 보류한 최소 플랫폼 변경

| 항목 | 현재 값 | 제안 |
| --- | --- | --- |
| 플랫폼 HTTP outbound 정책 | `restricted` | restricted 유지 |
| `http_network_policy.egress_rules`의 대상 host | 없음 | 아래 host 규칙 하나만 추가 |
| 요청 대상 | 사이트443으로 proxy CONNECT 거부 | 해당 사이트 HTTPS CONNECT 허용; 플랫폼에 포트 단위 설정이 있으면443만 |
| HTTP/HTTPS 프록시 | `http://proxy:8080` | 변경 없음 |
| NO_PROXY | loopback3개 | 변경 없음 |

```json
{"host":"wbscowork.cometgnome.chatgpt.site"}
```

이는 **코딩 실행 환경**에서 단일 사이트로 나가는 HTTP(S) 접근 범위를 늘리는 변경이다. 사이트 공개 범위·사용자 역할·OAuth·DNS·들어오는 포트·NAS를 바꾸지 않는다. 네트워크 범위 변경은 사용자 승인 후 플랫폼 네트워크 정책 담당자가 적용해야 한다. 이번에는 적용하지 않았으며 읽기 전용 파일의 chmod/수정, 프록시 비활성화, NO_PROXY 추가, 직결을 시도하지 않았다. `*.chatgpt.site`나 다른 도메인을 열 필요는 없다. 이 실행 환경에는 플랫폼 관리 화면/쓰기 API가 제공되지 않아 로컬 파일 편집으로 적용된다고 주장하지 않는다.

담당자 적용 후 진단에서 CONNECT200을 확인하고 live smoke를 실행한 다음, 접속 가능한 브라우저에서 보호 화면의6개 너비를 확인한다. 계속 실패하면 실제 phase/status를 보존하고 새 근거에 따라 조사하며 허용 범위를 자동 확대하지 않는다.

## 단일 호스트 승인 후 관리 경로 확인

사용자가 위 정확한host 하나의 추가를 이번 작업에서 승인했다. 프록시 해제·NO_PROXY·다른host·전체 인터넷 허용은 승인하지 않았다. 현재 실행기에는 선택된 Cloud 환경의 네트워크 정책 수정 API나 관리 화면 조작 도구가 없고, 로컬 정책 파일 직접 편집이 지원 방식이라는 근거도 없다. 다른 리소스인 Vercel Sandbox의 세션 정책 전체 교체 도구는 이 환경과 연결된 session ID가 없어 사용하지 않았다. 이는 승인 대기가 아니라 플랫폼 관리 경로 접근 대기다.

[공식 Cloud environments 안내](https://learn.chatgpt.com/docs/environments/cloud-environments#connect-to-services)에 따르면 환경 편집 화면에서 도메인을 추가한다. 환경 소유자가 수행할 절차:

1. **Settings → Codex Cloud → Environments**에서 WBSCowork에 사용하는 환경의 **… → Edit**를 연다.
2. **Internet access**에서 기존 접근 모드와 허용 목록은 보존하고 **Additional allowed domains**에 `wbscowork.cometgnome.chatgpt.site` 하나만 추가한다. **All (unrestricted)**로 전환하거나 목록 전체를 교체하지 않는다. API나 YAML/JSON을 입력하는 화면이 아니라 domain 입력 필드다.
3. 저장 후 **환경 Republish**를 수행한다. 이는 WBSCowork 사이트 재게시가 아니다. 공식 문서는 기존 작업이 자신의 상태를 유지하므로 새 작업에서 확인하도록 안내한다.
4. 새 작업에서 `fix/sites-test-network-diagnostics` 브랜치를 사용해 위 진단과 `test:sites:live`를 실행한다. 정책에 정확한host만 추가됐는지, 기존proxy/NO_PROXY가 유지되는지 확인하고 실제 HTTP6계약 통과를 확인한다.

환경이 목록에 없거나 Agent Security가 잠겨 있으면 환경 소유자/워크스페이스 관리자에게 같은 단일host 요청을 전달한다. 이 실행기에서는 사용자의 실제 설정 화면을 열지 못했으므로 문서의 UI 경로와 실제 계정의 표시/권한이 일치하는지는 확인하지 못했다. 현 실행기 재검증은 여전히 exit1/`CONNECT 403 Forbidden`/`Domain forbidden`이며 변경이 적용됐다고 주장하지 않는다.

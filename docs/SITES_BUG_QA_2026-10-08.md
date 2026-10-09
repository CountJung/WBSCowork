# 버그 제보 실환경 QA — 2026-10-08

## 대상과 승인

public Site version4 / source `9a5367d607ce9a515b794d9a963a673a404a00f9`에서 소유자가 직접 Google 인증한 동일 세션을 사용했다. 관리자 overview에서 승인된 계정과 effective superuser를 다시 확인한 뒤, 사용자가 명시적으로 승인한 「닷프로 검증용 버그」 한 건만 생성했다. 실제 장애/고객 정보가 없는 합성 본문이다.

## 실제 확인

- 15:15 UTC 제보 생성 → `/bugs/1?saved=1`, version1/new. 입력 `/bugs?qa=1#form`은 `/bugs`로 저장됐다.
- 추가 설명 저장 → version2/addendum. 기존 원문 그대로 유지.
- 관리자 검토 메모와 in_progress → version3.
- 해결 사유와 검증 runtime commit SHA 저장 → version4/resolved. 실제 장애를 고쳤다는 내용이 아니라 합성 기능 검증 완료임을 본문에 명시했다.
- 대기 중 저장 버튼 disabled 확인. 새 요청을 중복 제출하지 않았다. 첫 검토 버튼 입력이 반영되지 않은 상황은 valid form, app console 및 DBversion2 유지 확인 후 같은 pending form을 다시 제출했고 event 하나만 생겼다.
- 관리자 queue와 제목+resolved 필터에서 동일 제보 1건 확인. navigation timeout 한 번은 재조회 결과 목적지 렌더 완료였으며 저장 실패로 간주하지 않았다.
- 제보자 본문, 추가 설명, 검토 메모, 해결 기록과 commit 참조가 모두 보존된다.
- 현재 owner 한 계정의 실사용 흐름이며 live guest/타인 계정 테스트로 표현하지 않는다. 해당 경계는 실제 local Worker synthetic JWT suite로 별도 검사했다.

## 정확한 테스트 기록

| 구분 | ID | 내용 |
|---|---|---|
| bug_reports | 1 | 닷프로 검증용 버그, resolved, version4 |
| bug_report_events | 1 | created, version1 |
| bug_report_events | 2 | addendum, version2 |
| bug_report_events | 3 | review/in_progress, version3 |
| bug_report_events | 4 | review/resolved, version4 |

native read-only D1 조회로 ID/status/version/관계를 확인했다. 과거 QA 프로젝트와 별개이며 첨부파일은 없다. 사용자나 역할은 변경하지 않았다.

## 정리의 경계

이 archive는 원문/처리 이력 보존을 위해 일반 삭제 endpoint를 제공하지 않는다. Sites connector의 DB 도구는 read-only이고 공식 public docs에서 row-delete 경로를 확인하지 못했다. 별도 cloud browser의 Sites 관리 화면은 ChatGPT 로그인이 없어 owner Settings UI의 행 삭제 지원 여부도 확인하지 못했다. 그 계정 로그인을 시작하지 않았고 probe tab은 닫았다.

report1/events1–4는 보존 중이다. schema-only migration에 data 삭제를 넣거나 숨은 endpoint/직접 Cloudflare 자격증명으로 우회하지 않는다. 지원되는 owner 기능 또는 명시적으로 승인된 가시적·감사 가능한 superuser maintenance 기능을 결정하고, 정확한 대상의 영구 삭제를 별도 확인한 뒤 진행한다(OPS-031).

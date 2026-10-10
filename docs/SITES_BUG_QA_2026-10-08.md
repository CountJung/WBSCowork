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

아래 표는 OPS-029 작성·검토 단계의 snapshot이며 현재 남아 있는 데이터 목록이 아니다. 후속 수명주기와 최종 정리는 아래에 기록한다.

| 구분 | ID | 내용 |
|---|---|---|
| bug_reports | 1 | 닷프로 검증용 버그, resolved, version4 |
| bug_report_events | 1 | created, version1 |
| bug_report_events | 2 | addendum, version2 |
| bug_report_events | 3 | review/in_progress, version3 |
| bug_report_events | 4 | review/resolved, version4 |

native read-only D1 조회로 ID/status/version/관계를 확인했다. 과거 QA 프로젝트와 별개이며 첨부파일은 없다. 사용자나 역할은 변경하지 않았다.

## 정리의 경계

당시 archive는 원문/처리 이력 보존을 위해 일반 삭제 endpoint를 제공하지 않았다. Sites connector의 DB 도구는 read-only이고 공식 public docs에서 row-delete 경로를 확인하지 못했다. 별도 cloud browser의 Sites 관리 화면은 ChatGPT 로그인이 없어 owner Settings UI의 행 삭제 지원 여부도 확인하지 못했다. 그 계정 로그인을 시작하지 않았고 probe tab은 닫았다.

이 단계에서는 report1/events1–4를 보존하고 지원되는 정리 기능과 별도 승인을 기다렸다. schema-only migration에 data 삭제를 넣거나 숨은 endpoint/직접 Cloudflare 자격증명으로 우회하지 않았다. 이후 사용자가 요청한 정식 수명주기 기능으로 처리한 결과는 다음과 같다.

## 후속 수명주기 및 정리 결과

- OPS-031 정식 기능을 version5로 게시한 후 동일 소유자 세션에서 검증 완료→휴지통→복원→휴지통을 확인했다. 원문을 덮어쓰지 않고 처리 이력이 추가됐다.
- 최종 삭제 직전 대상은 report #1 「닷프로 검증용 버그」 한 건, resolved/verified/trashed, version8, events1–8이었다. 최신 대상을 재확인하고 사용자의 해당 1건 영구 삭제 승인 후 정상 SU 제목·지문 확인 UI로 처리했다.
- 본문과 events1–8이 없어지고 최소 삭제 증빙 1건만 남은 것을 읽기 전용으로 확인했다. 기존 사용자·역할·감사 기록과 다른 데이터는 보존했다. 첨부파일은 없는 제보였다.
- 증빙에는 대상 ID, 수행자 계정 연결, 시각, 버전, 이력 수/마지막 ID, 내용 지문, 재시도 식별자만 남으며 제목·본문·검토 내용 사본은 남지 않는다. 호스팅 백업/진단 기록의 삭제까지 보장하지 않는다.
- 이후 version10 게시 전후에도 기존 사용자와 증빙 row가 같았다([보존 확인](P1_ACCEPTANCE_2026-10-09.md#게시-및-데이터-보존)). 이 문서의 2026-10-10 동기화는 과거 확인 결과의 정정이며 새 실환경 삭제나 테스트 실행이 아니다.
- native 파기 포함 전체 수명주기 검증은 아직 승인 대기/미실행이다. QLT-015 차단된 저장소 경합 및 QLT-016 fixture503 원인 확인도 별도 보류/미해결이며, 이번 실환경 정리 완료를 해당 검증 통과로 간주하지 않는다.

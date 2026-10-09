# 팀 업무 P0 인수 결과 — 2026-10-09

## 게시 결과

- 공개 주소: https://wbscowork.cometgnome.chatgpt.site
- version8: `d18cef86d4b7ed9063d92d41f8b4563ec58e4602`, 12:07:47 UTC 게시 성공. D1 0005–0009 추가 migration.
- 최종 version9: `82d7d516ef34ed8718dbfe09d6189b7f81cacfe8`, 12:24:42 UTC 게시 성공. 저장 대기 표시만 추가했고 migration은 바꾸지 않았다.
- Google 인증, 역할, 현재/과거 제출물 private 범위를 유지한다. 담당자/검토자 지정은 열람 권한을 추가하지 않는다.
- 게시 전후 기존 사용자1명(권한 포함)과 최소 버그 삭제 증빙1건이 동일했다. 검증 전 프로젝트·업무·산출물·첨부·댓글·버그·정리 작업은0건이었다. 환경 revision11을 유지했다.

## 통과한 검증

| 환경 | 실제 확인 |
| --- | --- |
| 로컬 실제 Worker/D1/R2 | workflow412, quality375, credential-free auth18, unit112. 두 member의 분담→제출→보완→새 버전→특정 버전 승인과 양성 검토 대기 목록/count/link, 5역할·private 파일·현재 역할 갱신·atomicity·반복/중단 요청 |
| 별도 실제 MariaDB | exact d18cef86에서 additive harness77, migration unit15, lint/types/FSD. 기존 합성 DB 보존과 재시작 snapshot/파일 동일. 최종89개 DB 보존 |
| 게시된 HTTPS / 기존 로그인 사용자 | 프로젝트2개 생성·전환·Back, 작업3개, 내 담당 업무→카드→제출3의 v1/v2·링크·첨부·버전2 댓글, 취소 후 재편집, 원본 다운로드 비교, no-review 담당자 완료 |
| 게시된 HTTPS / 반응형 | 데스크톱 및492 CSS px에서 업무/내 업무/버전 이력·모바일 메뉴·light/dark 확인. 페이지 폭과 viewport 모두492, 페이지 전체 가로 넘침 없음. Gantt는 내부 가로 스크롤 |
| 최종 UI source | lint/types/FSD/build/decoder PASS. 7개 비파괴 저장 버튼에 form별 pending 문구/진행 표시/disabled. 실제 상태 저장 시 aria-busy=true와 버튼 비활성화, 완료 후 복귀 확인 |

실제 완료 후 task3은 done/version3, 이력3건이며 leaf 완료1/3(33%), 남은 업무2다. 미완료 개인 큐에서 제외되고 완료 필터에서는1건으로 나타난다. 필터/선택 카드의 돌아가기 URL이 유지된다. v1 댓글0건과 v2 댓글1건을 각각 확인했다.

## 원본 파일 검증

| 파일 | bytes | SHA256 |
| --- | ---: | --- |
| qa-p0-v1.txt | 44 | `971f8a3c6717616aef450c568a2bc3e5be4dd7d947de7335a55f69e0d2d69137` |
| qa-p0-v2.txt | 71 | `a431d1ee0947c458b1fb3ceecef5b1bb9b0e0780790867645886e28938ae3880` |

각 다운로드가 원본과 같고, v2 저장 후 과거 v1의 첨부를 다시 내려받아 같은 hash를 확인했다. v2는 기존 파일 참조를 보존하므로 metadata3행이 실제 R2 object2개를 가리킨다. 정리 대기는0건이다.

## 실환경 합성 대상 목록 — 사용자 삭제 확인 (2026-10-09)

| 대상 | ID / 범위 |
| --- | --- |
| 프로젝트 | 2 `QA-P0-2026-10-09-WBSCowork`, 3 `QA-P0-2026-10-09-전환확인` (빈 프로젝트) |
| 업무 | 3 완료, 4/5 예정; 모두 project2 |
| 업무 이력 | 1–5 |
| 제출물 | 3, task3 소속, current revision2 |
| 버전 / 제출 이력 | submission_revisions1–2 / submission_events1–2 |
| 댓글 | 2, submission3의 revision2 |
| 첨부 metadata | 4(v1), 5(v2에 보존한 v1 파일), 6(v2 새 파일) |
| 실제 파일 | qa-p0-v1.txt, qa-p0-v2.txt |

모두 이번 P0 검증용 자료다. 에이전트의 삭제 확인 checkbox 조작은 플랫폼 검토에서 거부되어 중단했으며, 이후 사용자가 앱에서 직접 삭제했다고 알려 왔다. 2026-10-09 13:00 UTC 전후 읽기 전용 검사에서 위 project2/3 및 tasks3–5, task_events1–5, submission3, revisions1–2, submission_events1–2, comment2, attachments4–6이 모두 없음을 확인했다. 해당 테이블 전체와 file_cleanup_jobs가0건이다.

감사 기록113(project3, 12:53:32.244 UTC)과114(project2, 12:53:40.715 UTC)는 정상 project.delete 완료다. 관련 파일 정리 실패 기록은 없고 두 파일의 DB 참조/정리 대기가 남지 않았다. 이는 앱의 파일 정리 완료 근거이며 별도 R2 bucket 전체 목록을 직접 조사한 결과는 아니다.

사용자1명의 ID·email·role과 기존 버그 최소 삭제 증빙은 유지됐다. 로그인/동기화 시각(last_login_at/last_synced_at)만 정상 갱신됐다. 감사 로그는 보존됐다. 클라우드 Git 저장소/worktree와 별도 MariaDB 합성 fixture는 웹 프로젝트와 다른 자원이며 이번 확인에서 삭제·변경하지 않았다.

## 독립 정적 검토

최종 source의 현재+과거 visibility, 이전 파일 보존, atomic staging guard, 정리 전 staging 회수·참조 검사, canonical production write 경로에서 actionable defect를 찾지 못했다. 이 결과는 검사한 소스 범위의 정적 판단이다. 보충 adapter/admin 검색 일부는 리뷰 실행기 transport 중단으로 끝내지 못했으며 exhaustive 검토로 표시하지 않는다.

## 한계와 미실행

- 실제 Google 계정은 기존 로그인1개로 확인했다. 두 실제 Google 계정의 협업 브라우저 검증이나 새 OAuth 로그인은 실행하지 않았다. 다중 역할/교차 사용자 검증은 격리 가상 세션 및 실제 DB 결과다.
- native queue는 빈 검토 대기를 주로 검사했다. 양성 pending-review1건/count/정확한 version link는 D1 Worker 시나리오에서 확인했다. 별도 native 담당자 강등 interleaving은 미실행이다.
- 별도 두 cleanup runner를 의도적으로 멈추고 재개하는 동적 경합 재현은 플랫폼 검토로 차단되어 실행하지 않았다. 다른 경로로 재시도하지 않았고 전체 저장소 경합 검증 완료를 주장하지 않는다. 정적 불변식과 기존 허용된 업로드/재시도/rollback 검사는 이 미실행 항목과 구분한다.
- UI 버튼 개선 후 Worker 첫 실행은 기존 동시 검토 단계의 HTTP503 한 건으로 중단됐다. 동일 명령의 재실행은412 PASS했지만 최초503의 원인은 확정하지 않았다.
- 일부 빠르게 연속한 브라우저 입력/클릭에서 즉시 반응이 관찰되지 않았다. 이후 정상 요청·단일 DB 쓰기를 확인했으며 데이터 손실/클라이언트 navigation 결함으로 단정하지 않는다. 렌더링 후 화면의 버튼을 눌러 pending→완료를 직접 확인했다.
- 기존 destructive fixture/full purge suite와 운영 MariaDB 계정 최소권한 변경은 실행하지 않았다. 에이전트는 실환경 영구 삭제를 수행하지 않았고, 위 QA 대상은 사용자가 직접 삭제한 후 읽기 전용으로 확인했다. 이 제외 범위를 통과로 계산하지 않는다.
- 추가 schema의 자동 down은 제공하지 않는다. 새 버전 데이터 생성 후 옛 덮어쓰기 코드를 writable rollback하면 이력 계약을 깨므로 보존하는 forward fix를 기본으로 한다.

사용 방법: [팀 업무 안내](TEAM_WORKFLOW_GUIDE.md). 상세 검사별 기준선: [HARNESS_MAP.md](HARNESS_MAP.md).

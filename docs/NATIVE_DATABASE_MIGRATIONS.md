# Native MariaDB 스키마 운영

## 계정 경계 (QLT-013)

- 일반 질의·로그인·readiness는 기존 `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`만 사용한다.
- 명시적인 native 스키마 변경은 같은 서버/DB 대상의 `DB_SCHEMA_USER/DB_SCHEMA_PASSWORD`를 별도 읽는다. 없거나 일부만 설정하면 runtime 계정으로 대체하지 않고 중단한다. 슈퍼관리자 action 검사도 그대로 유지한다.
- schema 계정/비밀번호는 일반 RuntimeEnv·admin status·로그·설정 편집 폼에 포함하지 않는다. 화면에는 설정 존재 여부만 표시한다.
- 운영자는 별도 identity를 안전한 설정 경로로 구성하고 runtime 계정의 DDL 권한을 제거해야 한다. 앱 코드가 DB 계정 생성, GRANT/REVOKE, 비밀번호 전달을 수행하지 않는다. 이 운영 단계는 아직 승인·검증되지 않았다.
- 권장 runtime 범위는 도메인 테이블의 필요한 SELECT/INSERT/UPDATE/DELETE와 migration ledger SELECT다. DB 전체 쓰기를 허용하면 ledger 변조도 가능하므로 per-table 범위를 검토한다. 실제 권한은 운영자가 현재 구성과 백업/복구 계획을 확인하고 결정한다.
- 별도 키를 입력했다고 서로 다른 identity나 DDL 거부가 증명되지는 않는다. 적용 후 runtime의 정상 DML/readiness와 CREATE/ALTER/TRUNCATE 및 ledger 변경 거부를 격리 환경에서 검증해야 한다.
- Sites D1은 Worker binding과 게시 시 migration을 사용한다. 위 native 자격증명을 Sites에 넣거나 runtime DDL을 활성화하지 않는다.

테스트는 `TEST_DB_SCHEMA_*`만 사용한다. 일반 fixture의 기본값은 기존 테스트 DB identity이며 실제 최소권한 분리를 증명하지 않는다. 이전 destructive fixture/TRUNCATE나 영구 삭제 테스트는 별도 승인 없이 재개하지 않는다.

## 검증 기록

2026-10-09 코드 checkpoint: lint0/0, typecheck, FSD5/경계, unit73 PASS. 4개 새 계약은 누락/부분 설정의 fail-closed, runtime-only readiness, schema 값의 비직렬화, 미설정 초기화가 연결 전에 중단되는 것을 검사한다. 실제 운영 credential 구성/GRANT/REVOKE 및 DDL 거부 시험은 미실행이다.

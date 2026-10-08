type AdminRuntimeOptions = {
  hosted: boolean;
  databaseConfigured: boolean;
  databaseName?: string;
};

/** Presentation only: callers pass non-secret runtime metadata, never credentials. */
export function getAdminRuntimePresentation({ hosted, databaseConfigured, databaseName }: AdminRuntimeOptions) {
  return hosted ? {
    databaseLabel: "DB 대상: Sites D1 (DB)",
    databaseSetupMessage: "Sites의 DB 바인딩과 게시된 migration 상태를 확인하세요.",
    missingTablesMessage: "핵심 테이블이 아직 모두 준비되지 않았습니다. Sites 배포의 migration 적용 결과를 확인하세요.",
    summary: "Google 로그인 사용자 동기화, D1 프로젝트·작업 저장소, 권한 확인 후 제공되는 R2 첨부파일과 D1 감사 로그를 사용합니다.",
    databaseDescription: "Sites D1의 테이블과 파일 정리 대기 상태를 확인합니다. 스키마 변경은 게시 시 versioned migration으로 적용합니다.",
    settingsDescription: "호스팅 설정의 입력 여부와 감사 로그 보존 정책을 확인합니다. 값 변경은 소유자가 Sites 설정에서 직접 수행합니다.",
    logsDescription: "D1에 기록된 최근 사용자 액션과 날짜별 감사 로그를 조회합니다. 기록은 설정된 보존 기간에 따라 정리됩니다.",
  } : {
    databaseLabel: databaseConfigured ? `DB 대상: MariaDB (${databaseName || "이름 미설정"})` : "MariaDB env 미설정",
    databaseSetupMessage: "DB env가 아직 완전하지 않습니다. DB 관리 페이지 진입 전 DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME을 확인해야 합니다.",
    missingTablesMessage: "핵심 테이블이 아직 모두 준비되지 않았습니다. DB 초기화 후 상태를 다시 확인해야 합니다.",
    summary: "Google 로그인 사용자 동기화, MariaDB 프로젝트·작업 저장소, 권한 확인 후 제공되는 로컬 첨부파일과 롤링 파일 로그를 사용합니다.",
    databaseDescription: "env에 설정된 MariaDB 연결 정보로 DB와 기본 테이블을 생성하고 상태를 확인합니다.",
    settingsDescription: "파일 로그 롤링 정책, 앱 포트와 env 설정을 편집합니다.",
    logsDescription: "최근 사용자 액션 이력과 원본 로그 파일의 최근 항목을 검토합니다.",
  };
}

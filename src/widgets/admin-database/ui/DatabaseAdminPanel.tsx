"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, Chip, List, ListItem, ListItemText, Paper, Stack, Typography } from "@mui/material";
import type { DatabaseAdminStatus } from "@/src/shared/server/database-admin/index.server";
import type { DatabaseAdminActionState } from "@/src/features/database-manage";

type DatabaseAdminPanelProps = {
  initialStatus: DatabaseAdminStatus;
  initializeDatabaseAction: (previousState: DatabaseAdminActionState) => Promise<DatabaseAdminActionState>;
  retryStorageCleanupAction: (previousState: DatabaseAdminActionState) => Promise<DatabaseAdminActionState>;
  refreshDatabaseStatusAction: (previousState: DatabaseAdminActionState) => Promise<DatabaseAdminActionState>;
};

function DatabaseActionButton({ children, disabled = false }: { children: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="contained" disabled={pending || disabled}>
      {pending ? "처리 중..." : children}
    </Button>
  );
}

export default function DatabaseAdminPanel({
  initialStatus,
  initializeDatabaseAction,
  refreshDatabaseStatusAction,
  retryStorageCleanupAction,
}: DatabaseAdminPanelProps) {
  const baseState: DatabaseAdminActionState = {
    success: null,
    message: "",
    status: initialStatus,
  };

  const [activeState, formAction] = useActionState(async (previous: DatabaseAdminActionState, data: FormData) => {
    const intent = data.get("intent");
    if (intent === "initialize") return initializeDatabaseAction(previous);
    if (intent === "cleanup") return retryStorageCleanupAction(previous);
    return refreshDatabaseStatusAction(previous);
  }, baseState);
  const status = activeState.status;

  return (
    <Stack spacing={3}>
      {activeState.success !== null ? (
        <Alert severity={activeState.success ? "success" : "error"}>{activeState.message}</Alert>
      ) : null}

      <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h5">DB 대상 정보</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            {status.managedMigrations ? <>
              <Chip label="저장소: Sites D1" />
              <Chip label={`바인딩: ${status.databaseName}`} color={status.databaseExists ? "success" : "warning"} />
            </> : <>
              <Chip label={`Host: ${status.host}`} />
              <Chip label={`Port: ${status.port}`} />
              <Chip label={`User: ${status.user}`} />
              <Chip label={`DB: ${status.databaseName}`} color={status.databaseExists ? "success" : "warning"} />
            </>}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            DB 존재 여부: {status.databaseExists ? "생성됨" : "아직 없음"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            관리 대상 테이블 상태: {status.existingTableCount}/{status.managedTableCount}
          </Typography>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h5">관리 대상 테이블</Typography>
          <List disablePadding>
            {status.tables.map((table) => (
              <ListItem key={table.name} disableGutters secondaryAction={<Chip label={table.exists ? "존재" : "없음"} color={table.exists ? "success" : "default"} />}>
                <ListItemText primary={table.name} secondary={table.missingColumns.length ? `누락 컬럼: ${table.missingColumns.join(", ")}` : table.exists ? "생성 확인됨" : "아직 생성되지 않음"} />
              </ListItem>
            ))}
          </List>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h5">관리 작업</Typography>
          <Typography variant="body2" color="text.secondary">
            {status.managedMigrations ? "Sites가 게시 시 versioned migration을 적용합니다. 이 화면에서는 상태만 조회합니다." : "별도 schema 계정으로 버전과 checksum을 확인하며 누락된 migration을 적용합니다."}
          </Typography>
          {status.nativeMigrations ? <Stack spacing={1}>
            <Typography>Native migration 적용: {status.nativeMigrations.appliedVersions.join(", ") || "없음"} · 대기: {status.nativeMigrations.pendingVersions.join(", ") || "없음"}</Typography>
            {status.nativeMigrations.error ? <Alert severity="error">{status.nativeMigrations.error}</Alert> : null}
            <Typography variant="body2">DDL은 자동 되돌리기가 되지 않습니다. 백업과 적용 범위를 확인한 뒤 실행하세요.</Typography>
          </Stack> : null}
          {status.managedMigrations ? <Typography>저장 파일 정리 대기: {status.pendingCleanupCount ?? 0}개 (진행 중인 업로드 포함)</Typography> : null}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            {status.managedMigrations ? <form action={formAction}><input type="hidden" name="intent" value="cleanup" /><DatabaseActionButton>실패한 파일 정리 재시도</DatabaseActionButton></form> : null}
            {!status.managedMigrations && !status.schemaConfigured ? <Alert severity="info">스키마 변경에는 별도 DB_SCHEMA_USER / DB_SCHEMA_PASSWORD 설정이 필요합니다. 일반 조회는 runtime DB 계정을 사용합니다.</Alert> : null}
            {!status.managedMigrations && <form action={formAction}><input type="hidden" name="intent" value="initialize" />
              <DatabaseActionButton disabled={!status.schemaConfigured}>Native migration 적용</DatabaseActionButton>
            </form>}
            <form action={formAction}><input type="hidden" name="intent" value="refresh" />
              <DatabaseActionButton>상태 새로고침</DatabaseActionButton>
            </form>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}

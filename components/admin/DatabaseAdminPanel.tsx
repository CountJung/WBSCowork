"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, Chip, List, ListItem, ListItemText, Paper, Stack, Typography } from "@mui/material";
import type { DatabaseAdminStatus } from "@/lib/database-admin";
import {
  initializeDatabaseAction,
  refreshDatabaseStatusAction,
  type DatabaseAdminActionState,
} from "@/app/admin/database/actions";

type DatabaseAdminPanelProps = {
  initialStatus: DatabaseAdminStatus;
};

function DatabaseActionButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="contained" disabled={pending}>
      {pending ? "처리 중..." : children}
    </Button>
  );
}

export default function DatabaseAdminPanel({ initialStatus }: DatabaseAdminPanelProps) {
  const baseState: DatabaseAdminActionState = {
    success: null,
    message: "",
    status: initialStatus,
  };

  const [initializeState, initializeFormAction] = useActionState(initializeDatabaseAction, baseState);
  const [refreshState, refreshFormAction] = useActionState(refreshDatabaseStatusAction, baseState);
  const activeState = refreshState.success === null ? initializeState : refreshState;
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
            <Chip label={`Host: ${status.host}`} />
            <Chip label={`Port: ${status.port}`} />
            <Chip label={`User: ${status.user}`} />
            <Chip label={`DB: ${status.databaseName}`} color={status.databaseExists ? "success" : "warning"} />
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
                <ListItemText primary={table.name} secondary={table.exists ? "생성 확인됨" : "아직 생성되지 않음"} />
              </ListItem>
            ))}
          </List>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h5">관리 작업</Typography>
          <Typography variant="body2" color="text.secondary">
            아래 작업은 현재 env에 설정된 MariaDB 연결 정보로 대상 DB를 만들고, 마스터 플랜 기준 기본 테이블을 보장합니다.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <form action={initializeFormAction}>
              <DatabaseActionButton>DB 및 기본 테이블 생성</DatabaseActionButton>
            </form>
            <form action={refreshFormAction}>
              <DatabaseActionButton>상태 새로고침</DatabaseActionButton>
            </form>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
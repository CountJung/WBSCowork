"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  Alert,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { saveSettingsAction, type SettingsActionState } from "@/app/admin/settings/actions";
import type { AdminSettingsSnapshot } from "@/lib/admin-settings";

type SettingsAdminPanelProps = {
  initialSnapshot: AdminSettingsSnapshot;
};

const logSettingKeys = new Set(["LOG_DIR", "LOG_RETENTION_DAYS", "LOG_MAX_FILE_SIZE_MB"]);

function SettingsSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="contained" disabled={pending}>
      {pending ? "저장 중..." : "세팅 저장"}
    </Button>
  );
}

function getSensitiveInputType(key: string) {
  return /SECRET|PASSWORD/i.test(key) ? "password" : "text";
}

function getEntryValue(snapshot: AdminSettingsSnapshot, key: string) {
  return snapshot.envEntries.find((entry) => entry.key === key)?.value ?? "";
}

function getEntrySource(snapshot: AdminSettingsSnapshot, key: string) {
  return snapshot.envEntries.find((entry) => entry.key === key)?.source ?? "default";
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${sizeBytes} B`;
}

export default function SettingsAdminPanel({ initialSnapshot }: SettingsAdminPanelProps) {
  const baseState: SettingsActionState = {
    success: null,
    message: "",
    snapshot: initialSnapshot,
  };

  const [state, formAction] = useActionState(saveSettingsAction, baseState);
  const snapshot = state.snapshot;
  const groupedKnownKeys = new Set(snapshot.envGroups.flatMap((group) => group.keys));
  const extraEntries = snapshot.envEntries.filter((entry) => !groupedKnownKeys.has(entry.key));

  return (
    <Stack spacing={3}>
      {state.success !== null ? (
        <Alert severity={state.success ? "success" : "error"}>{state.message}</Alert>
      ) : null}

      <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h5">현재 로그 정책</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <Chip label={`로그 경로 ${snapshot.logDirectoryPath}`} color="primary" />
            <Chip label={`보관 ${snapshot.logRetentionDays}일`} />
            <Chip label={`파일당 ${snapshot.logMaxFileSizeMb}MB`} />
            <Chip label={`최근 로그 ${snapshot.logFiles.length}개`} variant="outlined" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            서버 시작, 주요 관리자 작업, Server Action 오류, 콘솔 출력이 모두 파일 로그로 기록되도록 구성됩니다.
          </Typography>
        </Stack>
      </Paper>

      <Stack component="form" action={formAction} spacing={3} key={snapshot.revision}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
          <Stack spacing={2}>
            <Typography variant="h5">로그 롤링 세팅</Typography>
            <Typography variant="body2" color="text.secondary">
              기본값은 5일 보관, 파일당 100MB입니다. 저장 후 즉시 새 로그 파일 생성 정책에 반영됩니다.
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                name="env:LOG_DIR"
                label="로그 디렉터리"
                defaultValue={getEntryValue(snapshot, "LOG_DIR")}
                fullWidth
                helperText={`출처: ${getEntrySource(snapshot, "LOG_DIR")}`}
              />
              <TextField
                name="env:LOG_RETENTION_DAYS"
                label="보관 기간(일)"
                type="number"
                defaultValue={getEntryValue(snapshot, "LOG_RETENTION_DAYS")}
                fullWidth
                helperText={`출처: ${getEntrySource(snapshot, "LOG_RETENTION_DAYS")}`}
              />
              <TextField
                name="env:LOG_MAX_FILE_SIZE_MB"
                label="파일당 최대 용량(MB)"
                type="number"
                defaultValue={getEntryValue(snapshot, "LOG_MAX_FILE_SIZE_MB")}
                fullWidth
                helperText={`출처: ${getEntrySource(snapshot, "LOG_MAX_FILE_SIZE_MB")}`}
              />
            </Stack>
          </Stack>
        </Paper>

        {snapshot.envGroups.map((group) => {
          const entries = snapshot.envEntries.filter(
            (entry) => group.keys.includes(entry.key) && !logSettingKeys.has(entry.key),
          );

          if (entries.length === 0) {
            return null;
          }

          return (
            <Paper key={group.title} elevation={0} sx={{ p: 3, borderRadius: 4 }}>
              <Stack spacing={2}>
                <Typography variant="h5">{group.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {group.description}
                </Typography>
                <Divider />
                <Stack spacing={2}>
                  {entries.map((entry) => (
                    <TextField
                      key={entry.key}
                      name={`env:${entry.key}`}
                      label={entry.key}
                      defaultValue={entry.value}
                      type={getSensitiveInputType(entry.key)}
                      fullWidth
                      helperText={`현재 값 출처: ${entry.source}`}
                    />
                  ))}
                </Stack>
              </Stack>
            </Paper>
          );
        })}

        {extraEntries.length > 0 ? (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Stack spacing={2}>
              <Typography variant="h5">추가 환경 변수</Typography>
              <Typography variant="body2" color="text.secondary">
                기존 env 파일에 있었지만 현재 기본 그룹에 포함되지 않은 키들입니다.
              </Typography>
              {extraEntries.map((entry) => (
                <TextField
                  key={entry.key}
                  name={`env:${entry.key}`}
                  label={entry.key}
                  defaultValue={entry.value}
                  type={getSensitiveInputType(entry.key)}
                  fullWidth
                  helperText={`현재 값 출처: ${entry.source}`}
                />
              ))}
            </Stack>
          </Paper>
        ) : null}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <SettingsSubmitButton />
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h5">최근 로그 파일</Typography>
          {snapshot.logFiles.length > 0 ? (
            <List disablePadding>
              {snapshot.logFiles.map((logFile) => (
                <ListItem key={logFile.path} disableGutters>
                  <ListItemText
                    primary={logFile.name}
                    secondary={`${formatBytes(logFile.sizeBytes)} · ${logFile.modifiedAt}`}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              아직 생성된 로그 파일이 없습니다. 서버 액션이나 오류가 발생하면 이 목록에 나타납니다.
            </Typography>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
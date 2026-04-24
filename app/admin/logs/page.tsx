import { Alert, Button, Chip, Container, Divider, List, ListItem, ListItemText, Paper, Stack, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import { getAuthSession, getSignInPath } from "@/lib/auth";
import { listRecentLogFiles, listRecentUserActionEntries, readRecentLogEntries, type LogEntryWithFile } from "@/lib/logger";

export const dynamic = "force-dynamic";

type AdminLogsPageProps = {
  searchParams: Promise<{
    file?: string | string[];
  }>;
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDetailValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function getActionSummary(entry: LogEntryWithFile) {
  const details = entry.details ?? {};
  const actorEmail = typeof details.actorEmail === "string" ? details.actorEmail : "익명";
  const action = typeof details.action === "string" ? details.action : entry.message;
  const entityType = typeof details.entityType === "string" ? details.entityType : entry.source;
  const entityId =
    typeof details.entityId === "number" || typeof details.entityId === "string" ? String(details.entityId) : null;

  return {
    actorEmail,
    action,
    entity: entityId ? `${entityType} #${entityId}` : entityType,
  };
}

export default async function AdminLogsPage({ searchParams }: AdminLogsPageProps) {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect(getSignInPath("/admin/logs"));
  }

  if (!session.user.isSuperuser) {
    redirect("/");
  }

  const params = await searchParams;
  const selectedFileParam = getSingleSearchParam(params.file);
  const logFiles = await listRecentLogFiles(20);
  const selectedFile = logFiles.find((logFile) => logFile.name === selectedFileParam) ?? logFiles[0] ?? null;
  const [actionEntries, selectedEntries] = await Promise.all([
    listRecentUserActionEntries(40),
    selectedFile ? readRecentLogEntries(selectedFile.name, 120) : Promise.resolve([]),
  ]);

  return (
    <Container component="main" maxWidth="xl" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h3">관리 로그</Typography>
          <Typography variant="body1" color="text.secondary">
            슈퍼유저 전용 페이지입니다. 최근 사용자 액션 이력과 원본 로그 파일 tail을 같은 화면에서 확인합니다.
          </Typography>
        </Stack>

        <Alert severity="info">다른 관리자 화면 이동은 상단 앱바를 사용합니다. 이 화면은 최근 액션 추적과 장애 분석용 원본 로그 확인에 집중합니다.</Alert>

        <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between" }}>
              <Typography variant="h5">최근 사용자 액션</Typography>
              <Chip label={`최근 액션 ${actionEntries.length}건`} color="primary" />
            </Stack>

            {actionEntries.length > 0 ? (
              <List disablePadding>
                {actionEntries.map((entry) => {
                  const summary = getActionSummary(entry);

                  return (
                    <ListItem key={`${entry.fileName}-${entry.timestamp}-${entry.message}`} disableGutters>
                      <ListItemText
                        primary={`${summary.action} · ${summary.actorEmail}`}
                        secondary={`${entry.timestamp} · ${summary.entity} · ${entry.fileName}`}
                      />
                    </ListItem>
                  );
                })}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                아직 구조화된 사용자 액션 로그가 없습니다.
              </Typography>
            )}
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between" }}>
              <Typography variant="h5">로그 파일 선택</Typography>
              <Chip label={`파일 ${logFiles.length}개`} variant="outlined" />
            </Stack>

            {logFiles.length > 0 ? (
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ flexWrap: "wrap" }}>
                {logFiles.map((logFile) => (
                  <Button
                    key={logFile.name}
                    href={`/admin/logs?file=${encodeURIComponent(logFile.name)}`}
                    variant={selectedFile?.name === logFile.name ? "contained" : "outlined"}
                  >
                    {logFile.name}
                  </Button>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                아직 생성된 로그 파일이 없습니다.
              </Typography>
            )}
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
          <Stack spacing={2}>
            <Typography variant="h5">선택 파일 상세</Typography>
            {selectedFile ? (
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                  <Chip label={selectedFile.name} color="primary" />
                  <Chip label={`수정 ${selectedFile.modifiedAt}`} variant="outlined" />
                  <Chip label={`${selectedFile.sizeBytes} bytes`} variant="outlined" />
                </Stack>
                <Divider />
                {selectedEntries.length > 0 ? (
                  <List disablePadding>
                    {selectedEntries.map((entry) => (
                      <ListItem key={`${entry.fileName}-${entry.timestamp}-${entry.message}`} disableGutters alignItems="flex-start">
                        <ListItemText
                          primary={`${entry.timestamp} · ${entry.level.toUpperCase()} · ${entry.source}`}
                          secondary={
                            <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                              <Typography variant="body2" color="text.primary">
                                {entry.message}
                              </Typography>
                              {entry.details ? (
                                <Typography component="pre" variant="caption" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", m: 0 }}>
                                  {Object.entries(entry.details)
                                    .map(([key, value]) => `${key}: ${formatDetailValue(value)}`)
                                    .join("\n")}
                                </Typography>
                              ) : null}
                            </Stack>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    선택한 파일에 표시할 최근 로그 항목이 없습니다.
                  </Typography>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                표시할 로그 파일이 없습니다.
              </Typography>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
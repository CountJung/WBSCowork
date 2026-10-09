import { Alert, Button, Chip, Container, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import { getAuthSession, getSignInPath, getUserByEmail } from "@/src/entities/user/index.server";
import { canWriteTaskContent } from "@/src/entities/user";
import { listPersonalWorkPage } from "@/src/entities/task/index.server";
import {
  buildPersonalWorkPath, getPersonalWorkLinks, parsePersonalWorkFilters, parsePersonalWorkSelectedTaskId,
  personalWorkScopeLabels, taskStatusLabels, type PersonalWorkSearchParams,
} from "@/src/entities/task";
import { getDatabaseAdminStatus } from "@/src/shared/server/database-admin/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";

function Unavailable({ message }: { message: string }) {
  return <Container component="main" maxWidth="lg" sx={{ py: 5 }}><Stack spacing={3}>
    <Typography variant="h4">내 업무</Typography><Alert severity="warning">{message}</Alert>
  </Stack></Container>;
}

export default async function PersonalWorkPage({ searchParams }: { searchParams: PersonalWorkSearchParams }) {
  const filters = parsePersonalWorkFilters(searchParams);
  const selectedTaskId = parsePersonalWorkSelectedTaskId(searchParams.taskId);
  const session = await getAuthSession();
  if (!session?.user) redirect(getSignInPath(buildPersonalWorkPath(filters, selectedTaskId)));
  if (!getRuntimeEnv().database.configured) return <Unavailable message="업무 화면을 준비 중입니다. 잠시 후 다시 확인해 주세요." />;
  const database = await getDatabaseAdminStatus();
  const requiredTables = ["users", "projects", "tasks", "submissions", "submission_revisions", "comments"];
  const ready = database.databaseExists && requiredTables.every(name => database.tables.some(table => table.name === name && table.exists && table.missingColumns.length === 0));
  if (!ready) return <Unavailable message="업무 화면 업데이트가 아직 준비되지 않았습니다. 관리자에게 확인해 주세요." />;
  const user = session.user.email ? await getUserByEmail(session.user.email) : null;
  if (!user) return <Unavailable message="현재 계정의 업무 정보를 확인할 수 없습니다. 다시 로그인하거나 관리자에게 확인해 주세요." />;
  const canWrite = canWriteTaskContent(user.role, Boolean(session.user.isSuperuser));
  const today = new Date().toISOString().slice(0, 10);
  const result = await listPersonalWorkPage({ viewerUserId: user.id, isSuperuser: Boolean(session.user.isSuperuser) }, filters, today);
  const currentFilters = { ...filters, page: result.page };

  return <Container component="main" maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Stack spacing={1}><Typography variant="h4">내 업무</Typography><Typography color="text.secondary">여러 프로젝트에서 맡은 일과 기여한 일, 지금 검토할 산출물을 확인하세요.</Typography></Stack>
        <Button href="/tasks" variant="outlined" sx={{ flexShrink: 0 }}>전체 업무 보기</Button>
      </Stack>
      {!canWrite ? <Alert severity="info">현재 계정은 읽기 전용입니다. 이전에 담당하거나 기여한 업무는 조회할 수 있으며, 업무 작성·검토는 회원 권한이 필요합니다.</Alert> : null}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        <Stack component="form" action="/my-work" method="get" spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select fullWidth name="scope" label="업무 범위" defaultValue={filters.scope}>
              {Object.entries(personalWorkScopeLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
            <TextField select fullWidth name="status" label="상태" defaultValue={filters.status}>
              <MenuItem value="open">미완료</MenuItem><MenuItem value="all">전체 상태</MenuItem>
              {Object.entries(taskStatusLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
            <TextField select fullWidth name="overdue" label="기한" defaultValue={filters.overdue ? "1" : "0"}>
              <MenuItem value="0">전체 기한</MenuItem><MenuItem value="1">기한이 지난 미완료 업무</MenuItem>
            </TextField>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <Button type="submit" variant="contained">필터 적용</Button><Button href="/my-work">초기화</Button>
            <Typography variant="caption" color="text.secondary">기한 판단 기준: {today} UTC</Typography>
          </Stack>
        </Stack>
      </Paper>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h6">{personalWorkScopeLabels[filters.scope]}</Typography>
        <Chip label={`${result.total}건`} size="small" />
        <Typography variant="body2" color="text.secondary">기한이 가까운 순서</Typography>
      </Stack>
      {filters.scope === "review" && !canWrite ? <Alert severity="info">현재 계정은 검토를 처리할 권한이 없습니다.</Alert> : null}
      {selectedTaskId !== null && !result.items.some(item => item.taskId === selectedTaskId) ? <Alert severity="info">선택했던 업무가 현재 목록에 없습니다. 상태나 담당자가 바뀌었다면 필터를 조정해 확인하세요.</Alert> : null}
      {result.items.length === 0 ? <Paper elevation={0} sx={{ p: 3 }}><Stack spacing={1}>
        <Typography>현재 조건에 맞는 내 업무가 없습니다.</Typography>
        <Typography color="text.secondary">상태·기한 필터를 바꾸거나 전체 업무에서 프로젝트를 확인하세요.</Typography>
      </Stack></Paper> : result.items.map(item => {
        const links = getPersonalWorkLinks(item, currentFilters);
        const overdue = item.status !== "done" && item.endDate < today;
        const selected = selectedTaskId === item.taskId;
        return <Paper key={item.taskId} id={`work-${item.taskId}`} elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, scrollMarginTop: 120, border: "1px solid", borderColor: selected ? "secondary.main" : "divider" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
            <Stack spacing={1} sx={{ minWidth: 0 }}>
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{item.projectName}</Typography>
              <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>{item.title}</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                <Chip label={taskStatusLabels[item.status]} size="small" color={item.status === "done" ? "success" : "default"} />
                <Chip label={`기한 ${item.endDate}${overdue ? " · 지연" : ""}`} size="small" color={overdue ? "warning" : "default"} variant="outlined" />
                {selected ? <Chip label="선택한 업무" size="small" color="secondary" /> : null}
              </Stack>
            </Stack>
            <Stack direction={{ xs: "row", sm: "column" }} spacing={1} sx={{ flexShrink: 0, justifyContent: "center", flexWrap: "wrap" }}>
              {links.reviewHref && item.reviewTarget ? <Button href={links.reviewHref} variant="contained">v{item.reviewTarget.revisionNumber} 검토하기</Button> : null}
              <Button href={links.taskHref} variant={links.reviewHref ? "outlined" : "contained"}>업무 카드 열기</Button>
            </Stack>
          </Stack>
        </Paper>;
      })}
      {result.total > 0 ? <Stack component="nav" aria-label="내 업무 페이지" direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "center" }}>
        <Button href={result.page > 1 ? buildPersonalWorkPath({ ...currentFilters, page: result.page - 1 }) : undefined} disabled={result.page <= 1}>이전</Button>
        <Typography variant="body2">{result.page} / {result.pageCount}</Typography>
        <Button href={result.page < result.pageCount ? buildPersonalWorkPath({ ...currentFilters, page: result.page + 1 }) : undefined} disabled={result.page >= result.pageCount}>다음</Button>
      </Stack> : null}
      {result.total > result.pageSize * result.pageCount ? <Alert severity="info">표시 가능한 페이지 범위를 넘었습니다. 상태·기한 필터로 범위를 좁혀 주세요.</Alert> : null}
    </Stack>
  </Container>;
}

import { randomUUID } from "node:crypto";
import {
  Alert,
  Button,
  Chip,
  Container,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  bugStatuses,
  bugPriorities,
  bugStatusLabels,
  bugPriorityLabels,
} from "@/src/entities/bug-report";
import {
  loadBugList,
  loadBugDetail,
  createBugReportAction,
  appendBugNoteAction,
  reviewBugReportAction,
} from "@/src/features/bug-report-manage/index.server";
import SubmitButton from "./SubmitButton";

type Params = Record<string, string | string[] | undefined>;
const paper = {
  p: { xs: 2, sm: 3 },
  borderRadius: 3,
  border: "1px solid",
  borderColor: "divider",
};
function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {value || "기록 없음"}
      </Typography>
    </Stack>
  );
}
function Token() {
  return <input type="hidden" name="requestToken" value={randomUUID()} />;
}
function Stamp({ value }: { value: Date | string }) {
  return (
    <Typography variant="body2" color="text.secondary">
      {new Date(value).toISOString().replace("T", " ").slice(0, 19)} UTC
    </Typography>
  );
}
function Feedback({ params }: { params: Params }) {
  return params.error ? (
    <Alert severity="warning">
      입력 제한과 최신 버전을 확인해 주세요. 다른 변경이 먼저 저장됐거나 접근
      권한이 바뀐 경우 새로고침 후 다시 시도하세요. 새 제보의 재현 방법·예상
      결과·실제 결과는 필수이며 첨부파일은 지원하지 않습니다.
    </Alert>
  ) : params.saved ? (
    <Alert severity="success">저장했습니다.</Alert>
  ) : null;
}
export async function BugListPage({
  params,
  admin = false,
}: {
  params: Params;
  admin?: boolean;
}) {
  const data = await loadBugList(params, admin),
    base = admin ? "/admin/bugs" : "/bugs";
  const pageHref = (page: number) =>
    `${base}?${new URLSearchParams({ page: String(page), q: data.query, ...(data.status ? { status: data.status } : {}) })}`;
  return (
    <Container component="main" maxWidth="lg" sx={{ py: { xs: 4, md: 7 } }}>
      <Stack spacing={3}>
        <Typography variant="h3">
          {admin ? "버그 리뷰" : "내 버그 제보"}
        </Typography>
        <Alert severity="info">
          제보와 검토 기록은 작성자와 관리자만 볼 수 있습니다. 비밀번호·인증
          코드·실제 고객 정보는 입력하지 마세요. 제보 내용은 검토 자료이며
          자동으로 실행하거나 외부로 전송하지 않습니다.
        </Alert>
        <Feedback params={params} />
        {admin ? (
          <Button href="/bugs" sx={{ alignSelf: "flex-start" }}>
            내 제보 작성
          </Button>
        ) : null}
        <Paper sx={paper}>
          <Stack
            component="form"
            method="get"
            action={base}
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
          >
            <TextField
              name="q"
              label="제목 검색"
              defaultValue={data.query}
              slotProps={{ htmlInput: { maxLength: 100 } }}
              fullWidth
            />
            <TextField
              select
              name="status"
              label="상태"
              defaultValue={data.status ?? ""}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">전체</MenuItem>
              {bugStatuses.map((s) => (
                <MenuItem key={s} value={s}>
                  {bugStatusLabels[s]}
                </MenuItem>
              ))}
            </TextField>
            <Button type="submit" variant="outlined">
              조회
            </Button>
          </Stack>
        </Paper>
        <Typography>
          제보 {data.count}건 · {data.page}페이지
        </Typography>
        {data.reports.map((report) => (
          <Paper key={report.id} sx={paper}>
            <Stack spacing={1}>
              <Button
                href={`/bugs/${report.id}`}
                sx={{
                  justifyContent: "flex-start",
                  textAlign: "left",
                  overflowWrap: "anywhere",
                }}
              >
                #{report.id} {report.title}
              </Button>
              <Stack direction="row" spacing={1}>
                <Chip label={bugStatusLabels[report.status]} />
                <Chip
                  label={bugPriorityLabels[report.priority]}
                  variant="outlined"
                />
              </Stack>
              <Stamp value={report.updated_at} />
            </Stack>
          </Paper>
        ))}
        {!data.reports.length ? (
          <Typography>표시할 제보가 없습니다.</Typography>
        ) : null}
        <Stack direction="row" spacing={1}>
          {data.page > 1 ? (
            <Button href={pageHref(data.page - 1)}>이전</Button>
          ) : null}
          {data.page * 20 < data.count ? (
            <Button href={pageHref(data.page + 1)}>다음</Button>
          ) : null}
        </Stack>
        {!admin ? (
          <Paper sx={paper}>
            <Stack component="form" action={createBugReportAction} spacing={2}>
              <Typography variant="h5">새 버그 제보</Typography>
              <Token />
              <TextField
                name="title"
                label="제목"
                required
                slotProps={{ htmlInput: { maxLength: 160 } }}
              />
              <TextField
                name="pagePath"
                label="문제가 발생한 페이지 경로 (선택)"
                helperText="/tasks 같은 내부 경로만. URL 쿼리와 fragment는 저장하지 않습니다."
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />
              <TextField
                name="reproduction"
                label="재현 방법"
                required
                multiline
                minRows={3}
                slotProps={{ htmlInput: { maxLength: 8000 } }}
              />
              <TextField
                name="expected"
                label="예상 결과"
                required
                multiline
                minRows={2}
                slotProps={{ htmlInput: { maxLength: 4000 } }}
              />
              <TextField
                name="actual"
                label="실제 결과"
                required
                multiline
                minRows={2}
                slotProps={{ htmlInput: { maxLength: 4000 } }}
              />
              <Typography variant="body2">
                원문은 저장 후 보존됩니다. 정정할 내용은 상세 화면에서 추가
                설명으로 남길 수 있습니다.
              </Typography>
              <SubmitButton>버그 제보 저장</SubmitButton>
            </Stack>
          </Paper>
        ) : null}
      </Stack>
    </Container>
  );
}
export async function BugDetailPage({
  id,
  params,
}: {
  id: number;
  params: Params;
}) {
  const raw =
    typeof params.eventsPage === "string" ? Number(params.eventsPage) : 1;
  const eventPage = Number.isSafeInteger(raw)
    ? Math.min(1000, Math.max(1, raw))
    : 1;
  const { viewer, report, events } = await loadBugDetail(id, eventPage);
  return (
    <Container component="main" maxWidth="md" sx={{ py: { xs: 4, md: 7 } }}>
      <Stack spacing={3}>
        <Stack direction="row" spacing={1}>
          <Button href="/bugs">내 제보</Button>
          {viewer.canReview ? (
            <Button href="/admin/bugs">버그 리뷰</Button>
          ) : null}
        </Stack>
        <Typography variant="h3" sx={{ overflowWrap: "anywhere" }}>
          #{report.id} {report.title}
        </Typography>
        <Feedback params={params} />
        <Stack direction="row" spacing={1}>
          <Chip label={bugStatusLabels[report.status]} />
          <Chip label={bugPriorityLabels[report.priority]} />
          <Chip label={`버전 ${report.version}`} />
        </Stack>
        <Paper sx={paper}>
          <Stack spacing={2}>
            <Typography variant="h5">제보 원문</Typography>
            <Stamp value={report.created_at} />
            <TextBlock label="페이지 경로" value={report.page_path} />
            <TextBlock label="재현 방법" value={report.reproduction} />
            <TextBlock label="예상 결과" value={report.expected} />
            <TextBlock label="실제 결과" value={report.actual} />
          </Stack>
        </Paper>
        <Paper sx={paper}>
          <Stack spacing={2}>
            <TextBlock label="현재 해결 내용" value={report.resolution} />
            <TextBlock label="수정 commit" value={report.fix_commit} />
          </Stack>
        </Paper>
        <Paper sx={paper}>
          <Stack component="form" action={appendBugNoteAction} spacing={2}>
            <Token />
            <input type="hidden" name="reportId" value={id} />
            <input type="hidden" name="version" value={report.version} />
            <Typography variant="h5">추가 설명·정정</Typography>
            <TextField
              name="body"
              label="추가 설명"
              multiline
              minRows={3}
              required
              slotProps={{ htmlInput: { maxLength: 4000 } }}
            />
            <SubmitButton>추가 설명 저장</SubmitButton>
          </Stack>
        </Paper>
        {viewer.canReview ? (
          <Paper sx={paper}>
            <Stack component="form" action={reviewBugReportAction} spacing={2}>
              <Token />
              <input type="hidden" name="reportId" value={id} />
              <input type="hidden" name="version" value={report.version} />
              <Typography variant="h5">관리자 검토</Typography>
              <Typography>
                모든 검토 메모와 처리 이력은 제보자에게도 표시됩니다.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  select
                  name="status"
                  label="처리 상태"
                  defaultValue={report.status}
                  fullWidth
                >
                  {bugStatuses.map((s) => (
                    <MenuItem key={s} value={s}>
                      {bugStatusLabels[s]}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  name="priority"
                  label="우선순위"
                  defaultValue={report.priority}
                  fullWidth
                >
                  {bugPriorities.map((s) => (
                    <MenuItem key={s} value={s}>
                      {bugPriorityLabels[s]}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <TextField
                name="body"
                label="검토 메모"
                multiline
                minRows={2}
                slotProps={{ htmlInput: { maxLength: 4000 } }}
              />
              <TextField
                name="resolution"
                label="해결 내용·종료 사유"
                defaultValue={report.resolution}
                multiline
                minRows={2}
                slotProps={{ htmlInput: { maxLength: 4000 } }}
                helperText="해결 또는 종료 상태에서는 필수입니다."
              />
              <TextField
                name="fixCommit"
                label="수정 commit SHA (선택)"
                defaultValue={report.fix_commit}
                slotProps={{ htmlInput: { maxLength: 40 } }}
              />
              <SubmitButton>검토 저장</SubmitButton>
            </Stack>
          </Paper>
        ) : null}
        <Typography variant="h5">보존된 처리 이력</Typography>
        {events.map((event) => (
          <Paper key={event.id} sx={paper}>
            <Stack spacing={1}>
              <Typography sx={{ fontWeight: 700 }}>
                {event.kind === "created"
                  ? "최초 접수"
                  : event.kind === "review"
                    ? "관리자 검토"
                    : "추가 설명"}{" "}
                · 버전 {event.report_version}
              </Typography>
              <Stamp value={event.created_at} />
              <Typography>
                {bugStatusLabels[event.status]} ·{" "}
                {bugPriorityLabels[event.priority]}
              </Typography>
              {event.body ? (
                <TextBlock label="메모" value={event.body} />
              ) : null}
              {event.resolution ? (
                <TextBlock label="해결 기록" value={event.resolution} />
              ) : null}
              {event.fix_commit ? (
                <TextBlock label="수정 commit" value={event.fix_commit} />
              ) : null}
            </Stack>
          </Paper>
        ))}
        <Stack direction="row" spacing={1}>
          {eventPage > 1 ? (
            <Button href={`/bugs/${id}?eventsPage=${eventPage - 1}`}>
              최근 이력
            </Button>
          ) : null}
          {events.length === 30 ? (
            <Button href={`/bugs/${id}?eventsPage=${eventPage + 1}`}>
              이전 이력
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Container>
  );
}

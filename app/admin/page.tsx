import { Alert, Button, Chip, Container, Paper, Stack, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import { getAuthSession, getSignInPath } from "@/lib/auth";
import { getRuntimeEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect(getSignInPath("/admin"));
  }

  if (!session.user.isSuperuser) {
    redirect("/");
  }

  const runtimeEnv = getRuntimeEnv();

  return (
    <Container component="main" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h3">관리자 전용 페이지</Typography>
          <Typography variant="body1" color="text.secondary">
            슈퍼유저 계정으로 로그인된 상태입니다. 여기에서 시스템 초기화와 관리자 전용 기능 진입점을 제어합니다.
          </Typography>
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <Chip label={`계정: ${session.user.email ?? "이메일 없음"}`} />
          <Chip label={`권한: ${session.user.role}`} color="success" />
          <Chip
            label={runtimeEnv.database.configured ? `DB 대상: ${runtimeEnv.database.database}` : "DB env 미설정"}
            color={runtimeEnv.database.configured ? "primary" : "warning"}
          />
        </Stack>

        {!runtimeEnv.database.configured ? (
          <Alert severity="warning">
            DB env가 아직 완전하지 않습니다. DB 관리 페이지 진입 전 DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME을 확인해야 합니다.
          </Alert>
        ) : null}

        <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: "stretch" }}>
          <Paper elevation={0} sx={{ flex: 1, p: 3, borderRadius: 4 }}>
            <Stack spacing={2}>
              <Typography variant="h5">DB 관리</Typography>
              <Typography variant="body2" color="text.secondary">
                env에 설정된 MariaDB 연결 정보로 실제 DB와 기본 테이블을 생성하고 상태를 확인합니다.
              </Typography>
              <Button href="/admin/database" variant="contained">
                DB 관리 페이지 이동
              </Button>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ flex: 1, p: 3, borderRadius: 4 }}>
            <Stack spacing={2}>
              <Typography variant="h5">다음 관리자 작업</Typography>
              <Typography variant="body2" color="text.secondary">
                이후 단계에서는 Google 로그인 사용자 저장, 프로젝트/사용자 repository, 관리자용 운영 대시보드를 이어서 구현할 수 있습니다.
              </Typography>
              <Button href="/" variant="outlined">
                홈으로 돌아가기
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Stack>
    </Container>
  );
}
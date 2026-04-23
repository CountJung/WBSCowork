import { Alert, Container, Stack, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import DatabaseAdminPanel from "@/components/admin/DatabaseAdminPanel";
import { getAuthSession, getSignInPath } from "@/lib/auth";
import { getDatabaseAdminStatus } from "@/lib/database-admin";
import { getRuntimeEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminDatabasePage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect(getSignInPath("/admin/database"));
  }

  if (!session.user.isSuperuser) {
    redirect("/");
  }

  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.database.configured) {
    return (
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <Typography variant="h3">DB 관리</Typography>
          <Alert severity="warning">
            DB env가 완전하지 않아 관리 기능을 실행할 수 없습니다. DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME을 먼저 점검해야 합니다.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            관리자 하위 화면 이동은 상단 앱바를 사용합니다.
          </Typography>
        </Stack>
      </Container>
    );
  }

  const initialStatus = await getDatabaseAdminStatus();

  return (
    <Container component="main" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between" }}>
          <Stack spacing={1}>
            <Typography variant="h3">DB 관리</Typography>
            <Typography variant="body1" color="text.secondary">
              슈퍼유저 전용 페이지입니다. 현재 env로 지정된 MariaDB 대상에 DB와 기본 테이블을 생성하고 상태를 확인할 수 있습니다.
            </Typography>
          </Stack>
        </Stack>

        <Alert severity="info">다른 관리자 화면 이동은 상단 앱바를 사용합니다.</Alert>

        <DatabaseAdminPanel initialStatus={initialStatus} />
      </Stack>
    </Container>
  );
}
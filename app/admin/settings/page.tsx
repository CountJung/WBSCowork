import { Alert, Button, Container, Stack, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import SettingsAdminPanel from "@/components/admin/SettingsAdminPanel";
import { getAdminSettingsSnapshot } from "@/lib/admin-settings";
import { getAuthSession, getSignInPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect(getSignInPath("/admin/settings"));
  }

  if (!session.user.isSuperuser) {
    redirect("/");
  }

  const initialSnapshot = await getAdminSettingsSnapshot();

  return (
    <Container component="main" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between" }}>
          <Stack spacing={1}>
            <Typography variant="h3">시스템 세팅</Typography>
            <Typography variant="body1" color="text.secondary">
              슈퍼유저 전용 페이지입니다. 파일 로그 롤링 정책과 환경 변수를 편집할 수 있습니다.
            </Typography>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button href="/admin" variant="outlined">
              관리자 메인으로 돌아가기
            </Button>
            <Button href="/admin/database" variant="outlined">
              DB 관리 페이지 이동
            </Button>
          </Stack>
        </Stack>

        <Alert severity="info">
          세팅은 {initialSnapshot.envFilePath} 파일에 저장됩니다. NextAuth 공급자나 DB 연결처럼 모듈 초기화 시점에 고정되는 설정은 저장 후 서버 재시작이 필요할 수 있습니다.
        </Alert>

        <SettingsAdminPanel initialSnapshot={initialSnapshot} />
      </Stack>
    </Container>
  );
}
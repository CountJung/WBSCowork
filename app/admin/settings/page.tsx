import { Alert, Container, Stack, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import SettingsAdminPanel from "@/src/widgets/admin-settings";
import { getAdminSettingsSnapshot } from "@/src/features/settings-manage/index.server";
import { getAuthSession, getSignInPath } from "@/src/entities/user/index.server";
import { saveSettingsAction } from "./actions";

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
              {initialSnapshot.managedRuntime ? "슈퍼유저 전용 페이지입니다. 호스팅 설정 상태와 감사 로그 보존 정책을 확인합니다." : "슈퍼유저 전용 페이지입니다. env 설정, 앱 포트와 파일 로그 정책을 관리합니다."}
            </Typography>
          </Stack>
        </Stack>

        {!initialSnapshot.managedRuntime && <Alert severity="info">
          세팅은 {initialSnapshot.envFilePath} 파일에 저장됩니다. 다른 관리자 화면 이동은 상단 앱바를 사용합니다. APP_PORT는 build와 start 스크립트가 참조하며, NextAuth 공급자나 DB 연결처럼 모듈 초기화 시점에 고정되는 설정은 저장 후 서버 재시작이 필요할 수 있습니다.
        </Alert>}

        {initialSnapshot.legacyOverrideKeys.length > 0 ? (
          <Alert severity="warning">
            현재 {initialSnapshot.legacyOverrideEnvPath} 파일에 관리 대상 키가 남아 있어 {initialSnapshot.envFilePath} 값을 덮어쓸 수 있습니다. 이 화면에서 한 번 저장하면 중복 키는 자동으로 정리됩니다.
          </Alert>
        ) : null}

        {initialSnapshot.managedRuntime ? (
          <Stack spacing={2}>
            <Alert severity="info">설정 변경은 Sites → wbscowork → More actions → Settings에서 소유자가 직접 수행한 후 재배포합니다. 비밀값은 이 화면에 제공하지 않습니다.</Alert>
            {initialSnapshot.envEntries.map((entry) => <Typography key={entry.key}>{entry.key}: {entry.value}</Typography>)}
            <Typography>감사 로그 보존: {initialSnapshot.logRetentionDays}일. 오래된 항목은 다음 로그 기록 시 순차 정리합니다.</Typography>
          </Stack>
        ) : <SettingsAdminPanel initialSnapshot={initialSnapshot} saveSettingsAction={saveSettingsAction} />}
      </Stack>
    </Container>
  );
}

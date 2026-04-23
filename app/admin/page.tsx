import { Alert, Chip, Container, Paper, Stack, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import { getAdminOverview } from "@/lib/admin-overview";
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
  const adminOverview = runtimeEnv.database.configured ? await getAdminOverview() : null;

  function formatOptionalDate(value: Date | null) {
    return value ? value.toISOString().slice(0, 10) : "기록 없음";
  }

  return (
    <Container component="main" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h3">관리자 전용 페이지</Typography>
          <Typography variant="body1" color="text.secondary">
            슈퍼유저 계정으로 로그인된 상태입니다. 여기에서 시스템 초기화와 관리자 전용 기능 진입점을 제어합니다.
          </Typography>
        </Stack>

        <Alert severity="info">관리자 하위 화면 이동은 상단 앱바를 사용합니다. 이 페이지는 현재 시스템 상태와 운영 현황 요약만 제공합니다.</Alert>

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

        {adminOverview ? (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" } }}>
                <Typography variant="h5">Stage 4 운영 요약</Typography>
                <Chip label={`사용자 ${adminOverview.userCount}`} color={adminOverview.ready ? "success" : "default"} />
                <Chip label={`프로젝트 ${adminOverview.projectCount}`} color={adminOverview.ready ? "primary" : "default"} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {adminOverview.message}
              </Typography>
              <Stack direction={{ xs: "column", lg: "row" }} spacing={3}>
                <Paper elevation={0} sx={{ flex: 1, p: 2.5, borderRadius: 4, border: "1px solid", borderColor: "divider" }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      최근 사용자
                    </Typography>
                    {adminOverview.recentUsers.length > 0 ? (
                      adminOverview.recentUsers.map((user) => (
                        <Typography key={user.id} variant="body2" color="text.secondary">
                          {user.name} · {user.email} · {user.role} · 최근 로그인 {formatOptionalDate(user.lastLoginAt)}
                        </Typography>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        아직 저장된 사용자 레코드가 없습니다.
                      </Typography>
                    )}
                  </Stack>
                </Paper>
                <Paper elevation={0} sx={{ flex: 1, p: 2.5, borderRadius: 4, border: "1px solid", borderColor: "divider" }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      최근 프로젝트
                    </Typography>
                    {adminOverview.recentProjects.length > 0 ? (
                      adminOverview.recentProjects.map((project) => (
                        <Typography key={project.id} variant="body2" color="text.secondary">
                          {project.name} · {project.startDate.toISOString().slice(0, 10)} ~ {project.endDate.toISOString().slice(0, 10)}
                        </Typography>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        아직 저장된 프로젝트 레코드가 없습니다.
                      </Typography>
                    )}
                  </Stack>
                </Paper>
              </Stack>
            </Stack>
          </Paper>
        ) : null}

        <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: "stretch" }}>
          <Paper elevation={0} sx={{ flex: 1, p: 3, borderRadius: 4 }}>
            <Stack spacing={2}>
              <Typography variant="h5">DB 관리</Typography>
              <Typography variant="body2" color="text.secondary">
                env에 설정된 MariaDB 연결 정보로 실제 DB와 기본 테이블을 생성하고 상태를 확인합니다. 이동은 상단 앱바의 DB 관리 항목을 사용합니다.
              </Typography>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ flex: 1, p: 3, borderRadius: 4 }}>
            <Stack spacing={2}>
              <Typography variant="h5">사용자 관리</Typography>
              <Typography variant="body2" color="text.secondary">
                Google 로그인으로 동기화된 사용자 목록과 최근 로그인 메타데이터를 확인하고 게스트 또는 일반사용자 권한을 직접 지정합니다. 이동은 상단 앱바의 사용자 관리 항목을 사용합니다.
              </Typography>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ flex: 1, p: 3, borderRadius: 4 }}>
            <Stack spacing={2}>
              <Typography variant="h5">시스템 세팅</Typography>
              <Typography variant="body2" color="text.secondary">
                파일 로그 롤링 정책과 전체 env 설정을 편집합니다. 문제 분석용 로그 파일도 여기서 관리합니다. 이동은 상단 앱바의 세팅 항목을 사용합니다.
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      </Stack>
    </Container>
  );
}
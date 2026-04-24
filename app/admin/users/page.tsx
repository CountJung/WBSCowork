import {
  Alert,
  Avatar,
  Button,
  Chip,
  Container,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { redirect } from "next/navigation";
import { getAuthSession, getSignInPath, isSuperuserEmail } from "@/lib/auth";
import { getDatabaseAdminStatus } from "@/lib/database-admin";
import { getRuntimeEnv } from "@/lib/env";
import { listAllUsers } from "@/lib/repositories/user-repository";
import { getUserRoleLabel, manageableUserRoles } from "@/models/user";
import { updateUserRoleAction } from "./actions";

export const dynamic = "force-dynamic";

type AdminUsersPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
  }>;
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect(getSignInPath("/admin/users"));
  }

  if (!session.user.isSuperuser) {
    redirect("/");
  }

  const runtimeEnv = getRuntimeEnv();
  const params = await searchParams;
  const feedbackStatus = getSingleSearchParam(params.status);
  const feedbackMessage = getSingleSearchParam(params.message);

  if (!runtimeEnv.database.configured) {
    return (
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <Typography variant="h3">사용자 관리</Typography>
          <Alert severity="warning">
            DB env가 완전하지 않아 사용자 권한을 제어할 수 없습니다. DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME을 먼저 점검해야 합니다.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            다른 관리자 화면 이동은 상단 앱바를 사용합니다.
          </Typography>
        </Stack>
      </Container>
    );
  }

  const databaseStatus = await getDatabaseAdminStatus();
  const usersTableReady = databaseStatus.databaseExists && databaseStatus.tables.some((table) => table.name === "users" && table.exists && table.missingColumns.length === 0);

  if (!usersTableReady) {
    return (
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <Typography variant="h3">사용자 관리</Typography>
          <Alert severity="warning">
            users 테이블 또는 Google 로그인 메타데이터 컬럼이 아직 준비되지 않았습니다. 먼저 DB 관리 페이지에서 DB와 기본 테이블을 초기화해야 합니다.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            초기화 후 상단 앱바의 관리자 항목으로 다시 접근할 수 있습니다.
          </Typography>
        </Stack>
      </Container>
    );
  }

  const users = await listAllUsers();
  const superuserCount = users.filter((user) => isSuperuserEmail(user.email)).length;
  const googleLinkedCount = users.filter((user) => Boolean(user.googleId)).length;
  const loggedInCount = users.filter((user) => Boolean(user.lastLoginAt)).length;
  const adminCount = users.filter((user) => user.role === "admin" && !isSuperuserEmail(user.email)).length;
  const memberCount = users.filter((user) => user.role === "member" && !isSuperuserEmail(user.email)).length;
  const guestCount = users.filter((user) => user.role === "guest").length;

  return (
    <Container component="main" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between" }}>
          <Stack spacing={1}>
            <Typography variant="h3">사용자 관리</Typography>
            <Typography variant="body1" color="text.secondary">
              슈퍼유저 전용 페이지입니다. Google 로그인으로 동기화된 사용자 목록, 프로필 메타데이터, 최근 로그인 기록을 확인하고 권한 승급을 제어할 수 있습니다.
            </Typography>
          </Stack>
        </Stack>

        <Alert severity="info">다른 관리자 화면 이동은 상단 앱바를 사용합니다. 이 화면은 Google 로그인 사용자 현황과 권한 변경에 집중합니다.</Alert>

        {feedbackStatus && feedbackMessage ? (
          <Alert severity={feedbackStatus === "success" ? "success" : "error"}>{feedbackMessage}</Alert>
        ) : null}

        <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
          <Stack spacing={2}>
            <Typography variant="h5">권한 정책</Typography>
            <Typography variant="body2" color="text.secondary">
              env에 설정된 SUPERUSER_EMAIL 계정은 슈퍼관리자로 고정되며, 새 Google 로그인 사용자는 기본적으로 게스트로 등록됩니다. 로그인 시 Google 식별자, 프로필 이미지, 최근 로그인 시각도 함께 동기화합니다.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              관리자(admin)는 관리자 메뉴(로그, 세팅 등)에 접근하고 모든 비공개 제출물을 확인할 수 있습니다. 일반사용자는 공개 제출물참조 및 작성 권한이 있으며, 게스트는 공개 제출물 읽기만 가능합니다.
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <Chip label={`전체 사용자 ${users.length}`} color="primary" />
              <Chip label={`Google 연결 ${googleLinkedCount}`} color="info" />
              <Chip label={`로그인 기록 ${loggedInCount}`} color="info" variant="outlined" />
              <Chip label={`슈퍼관리자 ${superuserCount}`} color="secondary" />
              <Chip label={`관리자 ${adminCount}`} color="warning" />
              <Chip label={`일반사용자 ${memberCount}`} color="success" />
              <Chip label={`게스트 ${guestCount}`} />
            </Stack>
          </Stack>
        </Paper>

        <Stack spacing={2}>
          {users.length > 0 ? (
            users.map((user) => {
              const isSuperuser = isSuperuserEmail(user.email);
              const roleDescription = isSuperuser
                ? "env 기반 슈퍼관리자 계정입니다. 관리자 전용 페이지와 시스템 설정에 접근할 수 있습니다."
                : user.role === "admin"
                  ? "관리자 메뉴(DB 관리 제외)에 접근하고 모든 비공개 제출물을 확인할 수 있는 관리자입니다."
                  : user.role === "member"
                    ? "공개 제출물 읽기와 작성이 가능한 일반사용자입니다."
                    : "공개 제출물만 읽을 수 있는 권한 대기 상태의 게스트입니다.";

              return (
                <Paper key={user.id} elevation={0} sx={{ p: 3, borderRadius: 4 }}>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: "column", lg: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
                      <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
                        <Avatar src={user.avatarUrl ?? undefined} alt={user.name} sx={{ width: 56, height: 56 }}>
                          {user.name.slice(0, 1)}
                        </Avatar>
                        <Stack spacing={0.75}>
                          <Typography variant="h6">{user.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {user.email}
                          </Typography>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                            <Chip
                              label={`현재 권한: ${getUserRoleLabel(user.role, isSuperuser)}`}
                              color={isSuperuser ? "secondary" : user.role === "admin" ? "warning" : user.role === "member" ? "success" : "default"}
                            />
                            <Chip label={`생성일: ${user.createdAt.toISOString().slice(0, 10)}`} variant="outlined" />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {roleDescription}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Google ID: {user.googleId ?? "동기화 전"}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            최근 로그인: {formatDateTime(user.lastLoginAt)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            마지막 동기화: {formatDateTime(user.lastSyncedAt)}
                          </Typography>
                        </Stack>
                      </Stack>

                      {isSuperuser ? (
                        <Alert severity="info" sx={{ alignSelf: { lg: "flex-start" } }}>
                          이 계정은 env 기반 슈퍼관리자로 고정되어 있어 이 화면에서 변경하지 않습니다.
                        </Alert>
                      ) : (
                        <Stack
                          component="form"
                          action={updateUserRoleAction}
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1.5}
                          sx={{ alignItems: { sm: "center" }, minWidth: { lg: 320 } }}
                        >
                          <input type="hidden" name="userId" value={String(user.id)} />
                          <TextField select name="role" label="권한" defaultValue={user.role} size="small" sx={{ minWidth: { sm: 180 } }}>
                            {manageableUserRoles.map((role) => (
                              <MenuItem key={role} value={role}>
                                {getUserRoleLabel(role)}
                              </MenuItem>
                            ))}
                          </TextField>
                          <Button type="submit" variant="contained">
                            권한 저장
                          </Button>
                        </Stack>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              );
            })
          ) : (
            <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
              <Typography variant="body2" color="text.secondary">
                아직 저장된 Google 로그인 사용자가 없습니다. 사용자가 한 번 로그인하면 여기에서 기본 게스트 권한을 확인할 수 있습니다.
              </Typography>
            </Paper>
          )}
        </Stack>
      </Stack>
    </Container>
  );
}
"use client";

import Link from "next/link";
import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
import { signIn, signOut, useSession } from "next-auth/react";
import { getUserRoleLabel } from "@/models/user";

type AuthAccessPanelProps = {
  appName: string;
  authProvidersConfigured: boolean;
  superuserConfigured: boolean;
};

export default function AuthAccessPanel({
  appName,
  authProvidersConfigured,
  superuserConfigured,
}: AuthAccessPanelProps) {
  const { data: session, status } = useSession();

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h5">로그인 및 관리자 접근</Typography>

        {!authProvidersConfigured ? (
          <Alert severity="warning">
            Google OAuth 환경 변수가 아직 준비되지 않아 로그인 기능을 사용할 수 없습니다.
          </Alert>
        ) : null}

        {authProvidersConfigured && !superuserConfigured ? (
          <Alert severity="info">
            SUPERUSER_EMAIL이 설정되지 않았습니다. 최초 관리자 계정 승격은 env 설정 후 Google 로그인으로 처리됩니다.
          </Alert>
        ) : null}

        {status === "loading" ? (
          <Typography variant="body2" color="text.secondary">
            현재 로그인 세션을 확인하고 있습니다.
          </Typography>
        ) : null}

        {!session?.user ? (
          <>
            <Typography variant="body2" color="text.secondary">
              Google 계정으로 로그인하면 {appName}에 접근할 수 있습니다. SUPERUSER_EMAIL과 일치하는 첫 관리자 계정은 로그인 즉시 슈퍼유저 권한을 갖습니다.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant="contained"
                disabled={!authProvidersConfigured}
                onClick={() => signIn("google", { callbackUrl: "/admin" })}
              >
                Google로 로그인
              </Button>
              <Button component={Link} href="/admin" variant="outlined">
                관리자 페이지 이동
              </Button>
            </Stack>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary">
              로그인 계정: {session.user.name ?? "이름 없음"} ({session.user.email ?? "이메일 없음"})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              현재 권한: {getUserRoleLabel(session.user.role, session.user.isSuperuser)}
            </Typography>
            {session.user.isSuperuser ? (
              <Alert severity="success">
                현재 계정은 슈퍼유저입니다. 관리자 페이지, 사용자 관리 페이지, DB 관리 페이지에 접근할 수 있습니다.
              </Alert>
            ) : session.user.role === "member" ? (
              <Alert severity="success">
                현재 계정은 일반사용자입니다. 업무 게시 읽기와 쓰기가 가능한 상태로 처리됩니다.
              </Alert>
            ) : (
              <Alert severity="info">
                현재 계정은 게스트입니다. 읽기 전용 상태이며, 일반사용자 승격은 슈퍼유저가 사용자 관리 페이지에서 처리해야 합니다.
              </Alert>
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button component={Link} href="/admin" variant="contained">
                관리자 페이지 이동
              </Button>
              <Button variant="outlined" onClick={() => signOut({ callbackUrl: "/" })}>
                로그아웃
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
}
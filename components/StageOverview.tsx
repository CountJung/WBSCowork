"use client";

import Link from "next/link";
import { Box, Chip, Container, Divider, List, ListItem, ListItemText, Paper, Stack, Typography } from "@mui/material";
import AuthAccessPanel from "@/components/AuthAccessPanel";

type StageOverviewProps = {
  appName: string;
  authProvidersConfigured: boolean;
  databaseConfigured: boolean;
  superuserConfigured: boolean;
};

const completedItems = [
  "Next.js App Router workspace initialized",
  "TypeScript strict mode enabled",
  "MUI theme and provider wired into the root layout",
  "Auth.js route foundation added for Google OAuth",
  "VS Code Chrome debugging flow configured",
  "Responsive app shell with system/light/dark theme mode added",
  "Google login users default to guest and can be managed by a superuser",
  "Project-scoped WBS task CRUD added with guest/member write policy integration",
];

const nextMilestones = [
  "Gantt integration and task timeline visualization",
  "Submission, comment, and upload flows",
  "Task ordering drag-and-drop and richer project detail layout",
];

export default function StageOverview({
  appName,
  authProvidersConfigured,
  databaseConfigured,
  superuserConfigured,
}: StageOverviewProps) {
  return (
    <Box component="main" sx={{ py: { xs: 6, md: 10 } }}>
      <Container maxWidth="lg">
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ alignItems: { xs: "flex-start", sm: "center" } }}
          >
            <Chip label="Stage 3 task workflow" color="primary" />
            <Chip label={authProvidersConfigured ? "Google OAuth ready" : "Google OAuth env pending"} color={authProvidersConfigured ? "success" : "warning"} variant="outlined" />
            <Chip label={databaseConfigured ? "MariaDB env ready" : "MariaDB env pending"} color={databaseConfigured ? "success" : "warning"} variant="outlined" />
          </Stack>

          <Stack spacing={1}>
            <Typography variant="h2">{appName}의 Stage 3 작업 관리 구성이 준비되었습니다.</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
              현재 저장소는 프로젝트 단위 WBS 작업 생성, 수정, 삭제와 역할 기반 읽기/쓰기 정책을 포함합니다. guest는 읽기 전용으로 작업 트리를 확인할 수 있고, member와 슈퍼유저는 같은 화면에서 프로젝트와 작업을 직접 관리할 수 있습니다.
            </Typography>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Typography component={Link} href="/tasks" sx={{ textDecoration: "none" }}>
              작업 페이지로 이동
            </Typography>
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: "stretch" }}>
            <Paper elevation={0} sx={{ flex: 1, p: 3, borderRadius: 4 }}>
              <Typography variant="h5" gutterBottom>
                완료된 기반
              </Typography>
              <List disablePadding>
                {completedItems.map((item) => (
                  <ListItem key={item} disableGutters>
                    <ListItemText primary={item} />
                  </ListItem>
                ))}
              </List>
            </Paper>

            <Paper elevation={0} sx={{ flex: 1, p: 3, borderRadius: 4 }}>
              <Typography variant="h5" gutterBottom>
                다음 준비 항목
              </Typography>
              <List disablePadding>
                {nextMilestones.map((item) => (
                  <ListItem key={item} disableGutters>
                    <ListItemText primary={item} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Stack>

          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Stack spacing={2}>
              <Typography variant="h5">환경 변수 체크</Typography>
              <Typography variant="body2" color="text.secondary">
                Google OAuth와 MariaDB를 실제로 활성화하려면 .env.local에 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME 값을 채워야 합니다.
              </Typography>
              <Divider />
              <Typography variant="body2" color="text.secondary">
                인증 공급자 설정 상태: {authProvidersConfigured ? "활성화 가능" : "환경 변수 입력 대기"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                데이터베이스 설정 상태: {databaseConfigured ? "연결 시도 가능" : "환경 변수 입력 대기"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                슈퍼유저 설정 상태: {superuserConfigured ? "관리자 로그인 가능" : "SUPERUSER_EMAIL 입력 대기"}
              </Typography>
            </Stack>
          </Paper>

          <AuthAccessPanel
            appName={appName}
            authProvidersConfigured={authProvidersConfigured}
            superuserConfigured={superuserConfigured}
          />
        </Stack>
      </Container>
    </Box>
  );
}
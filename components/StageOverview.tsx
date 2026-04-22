"use client";

import { Box, Chip, Container, Divider, List, ListItem, ListItemText, Paper, Stack, Typography } from "@mui/material";

type StageOverviewProps = {
  authProvidersConfigured: boolean;
};

const stageOneItems = [
  "Next.js App Router workspace initialized",
  "TypeScript strict mode enabled",
  "MUI theme and provider wired into the root layout",
  "Auth.js route foundation added for Google OAuth",
];

const nextMilestones = [
  "MariaDB connection and User / Project modeling",
  "Task tree CRUD and ordering",
  "Gantt integration, submissions, comments, and uploads",
];

export default function StageOverview({ authProvidersConfigured }: StageOverviewProps) {
  return (
    <Box component="main" sx={{ py: { xs: 6, md: 10 } }}>
      <Container maxWidth="lg">
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ alignItems: { xs: "flex-start", sm: "center" } }}
          >
            <Chip label="Stage 1" color="primary" />
            <Chip label={authProvidersConfigured ? "Google OAuth ready" : "Google OAuth env pending"} color={authProvidersConfigured ? "success" : "warning"} variant="outlined" />
          </Stack>

          <Stack spacing={1}>
            <Typography variant="h2">Task 중심 WBS 협업 시스템의 초기 골격이 준비되었습니다.</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
              현재 저장소는 Next.js App Router, TypeScript, Material UI, Auth.js 기반의 1단계 구성을 갖추고 있습니다. 다음 단계는 데이터 모델과 프로젝트 중심 흐름을 실제 도메인으로 연결하는 작업입니다.
            </Typography>
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: "stretch" }}>
            <Paper elevation={0} sx={{ flex: 1, p: 3, borderRadius: 4 }}>
              <Typography variant="h5" gutterBottom>
                완료된 1단계 기반
              </Typography>
              <List disablePadding>
                {stageOneItems.map((item) => (
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
                Google OAuth를 실제로 활성화하려면 .env.local에 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL 값을 채워야 합니다.
              </Typography>
              <Divider />
              <Typography variant="body2" color="text.secondary">
                인증 공급자 설정 상태: {authProvidersConfigured ? "활성화 가능" : "환경 변수 입력 대기"}
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
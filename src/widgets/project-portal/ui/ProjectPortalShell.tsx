"use client";
import type { ReactNode } from "react";
import type { PortalTeam } from "@/src/entities/project-presentation/index.server";
import { useMemo } from "react";
import { Box, Button, Container, Paper, Stack, Typography } from "@mui/material";
import { useScopedNavigation } from "@/src/shared/ui/scoped-navigation";

export function ProjectPortalShell({ projectId, name, canManage, volunteering, teams, children }: { projectId: number; name: string; canManage: boolean; volunteering: boolean; teams: PortalTeam[]; children: ReactNode }) {
  const base = `/projects/${projectId}`;
  const navigation = useMemo(() => {
    const quickTeams = teams.filter(team => team.canRead && team.kind !== "media").slice(0, 8).map(team => ({ href: `${base}/activities/${team.id}`, label: `${team.name} · ${team.kind === "meal" ? "식단표" : team.kind === "recreation" ? "시간표" : "준비 내용"}` }));
    return { rootHref: base, title: name, links: [{ href: base, label: "프로젝트 홈" }, ...(volunteering ? [{ href: `${base}/activities`, label: "팀별 식단·활동 일정" }, ...quickTeams, { href: `${base}/media`, label: "사진첩·영상" }] : []), { href: `/tasks?projectId=${projectId}`, label: "기존 WBS 업무" }, ...(canManage ? [{ href: `${base}/settings`, label: "프로젝트 화면 설정" }, { href: `/admin/projects/${projectId}/reports`, label: "활동 보고서" }] : [])] };
  }, [base, name, projectId, canManage, volunteering, teams]);
  useScopedNavigation(navigation);
  return <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 }, minWidth: 0 }} data-testid="project-portal">
    <Box component="a" href="#project-content" sx={{ position: "fixed", top: 8, left: 8, zIndex: 1800, transform: "translateY(-200%)", "&:focus": { transform: "translateY(0)" }, bgcolor: "background.paper", p: 1.5, border: "2px solid", borderColor: "primary.main" }}>프로젝트 본문으로 건너뛰기</Box>
    <Stack spacing={{ xs: 2, md: 3 }} sx={{ minWidth: 0, "& p, & h1, & h2, & h3": { overflowWrap: "anywhere" }, "& .MuiButton-root": { minHeight: 44 }, "& .MuiChip-root": { maxWidth: "100%", height: "auto", "& .MuiChip-label": { whiteSpace: "normal", overflowWrap: "anywhere", py: 0.5 } } }}>
      <Paper variant="outlined" component="section" aria-label="현재 프로젝트" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
          <Box sx={{ minWidth: 0 }}><Typography variant="caption">현재 프로젝트</Typography><Typography variant="h6" component="p">{name}</Typography><Typography variant="caption">상단 ☰ 메뉴에서 식단·일정·사진첩과 업무를 찾으세요.</Typography></Box>
          <Button component="a" href="/projects" variant="outlined" sx={{ minHeight: 44, flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}>프로젝트 전환</Button>
        </Stack>
      </Paper>
      <Box component="main" id="project-content" tabIndex={-1} sx={{ minWidth: 0, scrollMarginTop: { xs: 110, md: 200, xl: 130 }, "& img, & video": { maxWidth: "100%" } }}>{children}</Box>
    </Stack>
  </Container>;
}

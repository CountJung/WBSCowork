"use client";
import type { ReactNode } from "react";
import type { PortalTeam } from "@/src/entities/project-presentation/index.server";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Box, Button, Container, Divider, Paper, Stack, Typography } from "@mui/material";

export function ProjectPortalShell({ projectId, name, canManage, volunteering, teams, children }: { projectId: number; name: string; canManage: boolean; volunteering: boolean; teams: PortalTeam[]; children: ReactNode }) {
  const pathname = usePathname(), [expanded, setExpanded] = useState(false);
  const base = `/projects/${projectId}`;
  const quickTeams = teams.filter(team => team.canRead && team.kind !== "media").slice(0, 8).map(team => ({ href: `${base}/activities/${team.id}`, label: `${team.name} · ${team.kind === "meal" ? "식단표" : team.kind === "recreation" ? "시간표" : "준비 내용"}` }));
  const links = [{ href: base, label: "프로젝트 홈" }, ...(volunteering ? [{ href: `${base}/activities`, label: "팀별 식단·활동 일정" }, ...quickTeams, { href: `${base}/media`, label: "사진첩·영상" }] : []), { href: `/tasks?projectId=${projectId}`, label: "기존 WBS 업무" }, ...(canManage ? [{ href: `${base}/settings`, label: "프로젝트 화면 설정" }, { href: `/admin/projects/${projectId}/reports`, label: "활동 보고서" }] : [])];
  return <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 }, minWidth: 0 }} data-testid="project-portal">
    <Box component="a" href="#project-content" sx={{ position: "fixed", top: 8, left: 8, zIndex: 1800, transform: "translateY(-200%)", "&:focus": { transform: "translateY(0)" }, bgcolor: "background.paper", p: 1.5, border: "2px solid", borderColor: "primary.main" }}>프로젝트 본문으로 건너뛰기</Box>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "15rem minmax(0,1fr)" }, gap: { xs: 2, md: 3 }, alignItems: "start", "& p, & h1, & h2, & h3": { overflowWrap: "anywhere" } }}>
      <Paper variant="outlined" component="aside" sx={{ p: 2, minWidth: 0, position: { md: "sticky" }, top: { md: 176, xl: 112 }, maxHeight: { md: "calc(100dvh - 200px)", xl: "calc(100dvh - 136px)" }, overflowY: { md: "auto" } }}>
        <Stack spacing={1.5}><Typography variant="overline">PROJECT SPACE</Typography><Typography variant="h6" component="p">{name}</Typography><Typography variant="caption">현재 프로젝트 소속과 자료 공개 범위 안에서 이용합니다.</Typography>
          <Button onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="project-sidebar" variant="outlined" sx={{ display: { xs: "flex", md: "none" }, minHeight: 44 }}>프로젝트 메뉴 {expanded ? "접기" : "열기"}</Button>
          <Box component="nav" id="project-sidebar" aria-label="프로젝트 메뉴" sx={{ display: { xs: expanded ? "block" : "none", md: "block" } }}><Stack spacing={0.5}>{links.map(link => <Button key={link.href} component="a" href={link.href} variant={pathname === link.href ? "contained" : "text"} aria-current={pathname === link.href ? "page" : undefined} sx={{ minHeight: 44, justifyContent: "flex-start", textAlign: "left", overflowWrap: "anywhere" }}>{link.label}</Button>)}<Divider sx={{ my: 1 }} /><Button component="a" href="/" sx={{ minHeight: 44, justifyContent: "flex-start" }}>전체 프로젝트로</Button><Button component="a" href="/guide" sx={{ minHeight: 44, justifyContent: "flex-start" }}>사용설명서</Button></Stack></Box>
        </Stack>
      </Paper>
      <Box component="main" id="project-content" tabIndex={-1} sx={{ minWidth: 0, scrollMarginTop: { xs: 110, md: 200, xl: 130 }, "& img, & video": { maxWidth: "100%" } }}>{children}</Box>
    </Box>
  </Container>;
}

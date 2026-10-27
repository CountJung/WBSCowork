import { notFound } from "next/navigation";
import { Alert, Stack, Typography } from "@mui/material";
import { getPortalPageContext } from "@/src/features/project-portal/index.server";
import { listPortalTeams } from "@/src/entities/project-presentation/index.server";
import { PortalTeamCards } from "@/src/widgets/project-portal";
export const dynamic = "force-dynamic";
export default async function ProjectActivities({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params, { portal, viewer } = await getPortalPageContext(projectId), teams = await listPortalTeams(viewer, portal.project.id);
  if (portal.project.projectType !== "volunteering") notFound();
  return <Stack spacing={3}><Typography component="h1" variant="h4">팀별 식단·활동 일정</Typography><Alert severity="info">프로젝트 구성원 공개는 현재 이 프로젝트의 참여자에게만 보입니다. 팀 비공개 내용은 해당 팀과 지정 관리자에게만 열립니다.</Alert>{teams.length ? <PortalTeamCards projectId={portal.project.id} teams={teams} /> : <Typography>등록된 활동팀이 없습니다.</Typography>}<Typography variant="caption">최대 100개 팀을 표시합니다.</Typography></Stack>;
}

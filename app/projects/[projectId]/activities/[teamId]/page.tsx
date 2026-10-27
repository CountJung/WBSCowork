import { Alert, Button, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { getPortalPageContext } from "@/src/features/project-portal/index.server";
import { getTeamPresentation } from "@/src/features/project-presentation/index.server";
import { getTeamPreparation } from "@/src/entities/team-preparation/index.server";
import { ProjectPresentationError } from "@/src/entities/project-presentation/index.server";
import { TeamPresentationContent, TeamPublicationEditor } from "@/src/widgets/project-portal";
export const dynamic = "force-dynamic";
export default async function TeamActivity({ params }: { params: Promise<{ projectId: string; teamId: string }> }) {
  const { projectId, teamId } = await params, { portal, viewer } = await getPortalPageContext(projectId);
  if (!/^[1-9]\d*$/.test(teamId) || !Number.isSafeInteger(Number(teamId)) || String(Number(teamId)) !== teamId) notFound();
  let presentation;
  try { presentation = await getTeamPresentation(viewer, portal.project.id, Number(teamId)); }
  catch (error) { if (error instanceof ProjectPresentationError && error.status === 404) notFound(); throw error; }
  if (presentation.team.kind === "media") notFound();
  const latest = presentation.team.canEdit ? await getTeamPreparation(viewer, portal.project.id, Number(teamId)) : null;
  return <Stack spacing={3}><Typography component="h1" variant="h4">{presentation.team.name}</Typography><TeamPresentationContent presentation={presentation} />
    {presentation.team.canEdit ? <><Alert severity="info">편집 내용과 공유 버전은 별개입니다. 준비표 편집에서 먼저 저장한 뒤 공유할 최신 버전을 아래에서 선택하세요.</Alert><Button component="a" href={`/projects/${projectId}/teams/${teamId}/preparation`} variant="outlined" sx={{ alignSelf: "flex-start" }}>{presentation.team.kind === "meal" ? "식단표 편집" : presentation.team.kind === "recreation" ? "프로그램 시간표 편집" : "팀 준비표 편집"}</Button><TeamPublicationEditor projectId={portal.project.id} teamId={Number(teamId)} version={presentation.team.publicationVersion} currentAudience={presentation.team.audience} preparationVersion={latest?.version ?? 0} /></> : null}
    <Button component="a" href={`/projects/${projectId}/activities`} sx={{ alignSelf: "flex-start" }}>전체 팀으로 돌아가기</Button>
  </Stack>;
}

import { Alert, Button, Container, Stack } from "@mui/material";
import { notFound, redirect } from "next/navigation";
import { getSignInPath } from "@/src/entities/user/index.server";
import { getProjectByIdForViewer } from "@/src/entities/project/index.server";
import { getTeamPreparation, getTeamPreparationHistory, PreparationError } from "@/src/entities/team-preparation/index.server";
import { getPreparationViewer, preparationId, PreparationRequestError } from "@/src/features/team-preparation/index.server";
import { TeamPreparationEditor } from "@/src/widgets/team-preparation";

export const dynamic = "force-dynamic";
async function requestDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export default async function TeamPreparationPage({ params }: { params: Promise<{ projectId: string; teamId: string }> }) {
  const route = await params;
  let viewer: Awaited<ReturnType<typeof getPreparationViewer>>;
  try { viewer = await getPreparationViewer(); } catch (error) {
    if (error instanceof PreparationRequestError && error.status === 401) redirect(getSignInPath(`/projects/${route.projectId}/teams/${route.teamId}/preparation`));
    if (error instanceof PreparationRequestError && error.status === 404) notFound();
    throw error;
  }
  let projectId: number, teamId: number;
  try { projectId = preparationId(route.projectId); teamId = preparationId(route.teamId); } catch { notFound(); }
  const project = await getProjectByIdForViewer(projectId, viewer);
  if (!project || project.projectType !== "volunteering") notFound();
  let data: Awaited<ReturnType<typeof loadPreparation>> | null = null;
  async function loadPreparation() {
    const [sheet, history, defaultDate] = await Promise.all([getTeamPreparation(viewer, projectId, teamId), getTeamPreparationHistory(viewer, projectId, teamId), requestDate()]);
    return { sheet, history, defaultDate };
  }
  try { data = await loadPreparation(); } catch (error) {
    if (error instanceof PreparationError && error.status === 404) notFound();
    if (!(error instanceof PreparationError) || error.status !== 503) throw error;
  }
  if (!data) return <Container component="div" sx={{ py: 3 }}><Stack spacing={2}><Alert severity="warning">준비표를 사용할 수 없습니다. 추가 마이그레이션과 연결 상태를 확인해 주세요.</Alert><Button href={`/projects/${projectId}/teams`}>팀 준비표 목록으로</Button></Stack></Container>;
  return <Container component="div" sx={{ py: 3, minWidth: 0 }}><TeamPreparationEditor initialSheet={data.sheet} initialHistory={data.history} defaultDate={data.defaultDate} projectName={project.name} /></Container>;
}

import { notFound } from "next/navigation";
import { getPortalPageContext } from "@/src/features/project-portal/index.server";
import { listMediaTeams, listProjectMedia } from "@/src/entities/project-media/index.server";
import { ProjectMediaGallery } from "@/src/widgets/project-media";
export const dynamic = "force-dynamic";
export default async function ProjectMediaPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ teamId?: string | string[] }> }) {
  const { projectId } = await params, { portal, viewer } = await getPortalPageContext(projectId), query = await searchParams;
  if (portal.project.projectType !== "volunteering") notFound();
  const team = query.teamId;
  if (team !== undefined && (typeof team !== "string" || !/^[1-9]\d*$/.test(team) || !Number.isSafeInteger(Number(team)) || String(Number(team)) !== team)) notFound();
  const teamId = team === undefined ? undefined : Number(team);
  const [teams, initial] = await Promise.all([listMediaTeams(viewer, portal.project.id), listProjectMedia(viewer, portal.project.id, teamId)]);
  if (teamId !== undefined && !teams.some(row => row.id === teamId)) notFound();
  return <ProjectMediaGallery projectId={portal.project.id} canManageTeams={portal.canManage} teams={teams} initialItems={initial.items} initialTeamId={teamId} initialNextAfter={initial.nextAfter} />;
}

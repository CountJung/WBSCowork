import { notFound } from "next/navigation";
import { ProjectVoteError } from "@/src/entities/project-vote";
import { getPortalPageContext } from "@/src/features/project-portal/index.server";
import { listProjectPolls } from "@/src/entities/project-vote/index.server";
import { ProjectVoting } from "@/src/widgets/project-vote";

export const dynamic = "force-dynamic";
export default async function ProjectVotesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { portal, viewer } = await getPortalPageContext(projectId);
  const initial = await listProjectPolls(viewer, portal.project.id).catch((error: unknown) => {
    if (error instanceof ProjectVoteError && error.status === 404) notFound();
    throw error;
  });
  return <ProjectVoting key={`${portal.project.id}:${viewer.userId}`} projectId={portal.project.id} initial={initial} />;
}

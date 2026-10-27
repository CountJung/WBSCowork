import type { ReactNode } from "react";
import { getPortalPageContext } from "@/src/features/project-portal/index.server";
import { listPortalTeams } from "@/src/entities/project-presentation/index.server";
import { ProjectPortalShell } from "@/src/widgets/project-portal";
export const dynamic = "force-dynamic";
export default async function ProjectLayout({ params, children }: { params: Promise<{ projectId: string }>; children: ReactNode }) {
  const { projectId } = await params, { portal, viewer } = await getPortalPageContext(projectId);
  const teams = portal.project.projectType === "volunteering" ? await listPortalTeams(viewer, portal.project.id) : [];
  return <ProjectPortalShell projectId={portal.project.id} name={portal.project.name} canManage={portal.canManage} volunteering={portal.project.projectType === "volunteering"} teams={teams}>{children}</ProjectPortalShell>;
}

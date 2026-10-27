import { notFound } from "next/navigation";
import { getPortalPageContext } from "@/src/features/project-portal/index.server";
import { PortalSettingsEditor } from "@/src/widgets/project-portal";
export const dynamic = "force-dynamic";
export default async function ProjectSettings({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params, { portal } = await getPortalPageContext(projectId);
  if (!portal.canManage) notFound();
  return <PortalSettingsEditor projectId={portal.project.id} settings={portal.settings} volunteering={portal.project.projectType === "volunteering"} />;
}

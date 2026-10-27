import { notFound, redirect } from "next/navigation";
import { getAuthSession, getUserByEmail, getSignInPath } from "@/src/entities/user/index.server";
import { getProjectPortal, ProjectPresentationError } from "@/src/entities/project-presentation/index.server";

export async function getPortalIdentity(returnTo: string) {
  const session = await getAuthSession();
  if (!session?.user?.email) redirect(getSignInPath(returnTo));
  const user = await getUserByEmail(session.user.email);
  if (!user) notFound();
  return { userId: user.id, email: session.user.email, isSuperuser: !!session.user.isSuperuser };
}
export async function getPortalPageContext(value: string) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || String(Number(value)) !== value) notFound();
  const viewer = await getPortalIdentity(`/projects/${value}`);
  try { return { viewer, portal: await getProjectPortal(viewer, Number(value)) }; }
  catch (error) { if (error instanceof ProjectPresentationError && error.status === 404) notFound(); throw error; }
}

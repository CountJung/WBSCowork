import { redirect, notFound } from "next/navigation";
import { canAccessAdminPanel } from "@/src/entities/user";
import {
  getAuthSession,
  getSignInPath,
  getUserByEmail,
  isSuperuserEmail,
} from "@/src/entities/user/index.server";
import {
  getBugReport,
  listBugReports,
  listBugEvents,
  getBugPurgeSnapshot,
} from "@/src/entities/bug-report/index.server";
import {
  bugStatuses,
  type BugStatus,
  type BugViewer,
} from "@/src/entities/bug-report";

/** Separate from task-write rights: every persisted authenticated role may report bugs. */
export async function requireBugViewer(
  path: string,
  adminOnly = false,
): Promise<BugViewer> {
  const session = await getAuthSession();
  if (!session?.user?.email) redirect(getSignInPath(path));
  const user = await getUserByEmail(session.user.email);
  if (!user) notFound();
  const viewer = {
    userId: user.id,
    canReview: canAccessAdminPanel(user.role, isSuperuserEmail(user.email)),
    canPurge: isSuperuserEmail(user.email),
  };
  if (adminOnly && !viewer.canReview) notFound();
  return viewer;
}
export async function loadBugList(
  params: Record<string, string | string[] | undefined>,
  adminOnly = false,
  trash = false,
) {
  const viewer = await requireBugViewer(
    adminOnly ? (trash ? "/admin/bugs/trash" : "/admin/bugs") : "/bugs",
    adminOnly,
  );
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const status =
    typeof params.status === "string" &&
    bugStatuses.includes(params.status as BugStatus)
      ? (params.status as BugStatus)
      : undefined;
  const pageValue = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isSafeInteger(pageValue)
    ? Math.min(1000, Math.max(1, pageValue))
    : 1;
  // /bugs is always the caller's own queue, including for administrators.
  const scope = adminOnly ? viewer : { ...viewer, canReview: false };
  return {
    viewer,
    query,
    status,
    ...(await listBugReports(scope, { page, query, status, trash })),
  };
}
export async function loadBugDetail(id: number, eventPage = 1, trash = false) {
  const viewer = await requireBugViewer(
    trash ? `/admin/bugs/trash/${id}` : `/bugs/${id}`,
    trash,
  );
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const report = await getBugReport(id, viewer, trash);
  if (!report) notFound();
  let purge = null;
  if (trash && viewer.canPurge) {
    try {
      purge = await getBugPurgeSnapshot(id, viewer);
    } catch {
      /* Fail closed when full bounded snapshot is unavailable. */
    }
  }
  return {
    viewer,
    report,
    purge,
    events: await listBugEvents(id, viewer, eventPage, trash),
  };
}

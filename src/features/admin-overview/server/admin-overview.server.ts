import { getAdminRuntimePresentation } from "@/src/shared/config/admin-runtime";
import { getDatabaseAdminStatus } from "@/src/shared/server/database-admin/index.server";
import { listManagedProjectsForViewer, getManagedProjectCountForViewer } from "@/src/entities/project/index.server";
import { getUserCount, listUsers,getAuthSession,getUserByEmail,isSuperuserEmail } from "@/src/entities/user/index.server";
import type { Project } from "@/src/entities/project";
import type { User } from "@/src/entities/user";

export type AdminOverview = {
  ready: boolean;
  message: string;
  userCount: number;
  projectCount: number;
  recentUsers: User[];
  recentProjects: Project[];
};

export async function getAdminOverview(): Promise<AdminOverview> {
  try {
    const session=await getAuthSession();
    const user=session?.user.email?await getUserByEmail(session.user.email):null;
    if(!user||!session?.user.isSuperuser||!isSuperuserEmail(user.email)) throw new Error("운영 개요는 슈퍼관리자만 조회할 수 있습니다.");
    const databaseStatus = await getDatabaseAdminStatus();
    const presentation = getAdminRuntimePresentation({ hosted: Boolean(databaseStatus.managedMigrations), databaseConfigured: databaseStatus.databaseExists, databaseName: databaseStatus.databaseName });
    const usersReady = databaseStatus.databaseExists && databaseStatus.tables.some((table) => table.name === "users" && table.exists);
    const projectsReady = databaseStatus.databaseExists && databaseStatus.tables.some((table) => table.name === "projects" && table.exists && table.missingColumns.length === 0);

    if (!databaseStatus.databaseExists) {
      return {
        ready: false,
        message: databaseStatus.managedMigrations ? presentation.databaseSetupMessage : "대상 DB가 아직 생성되지 않았습니다. 관리자 DB 페이지에서 먼저 초기화해야 합니다.",
        userCount: 0,
        projectCount: 0,
        recentUsers: [],
        recentProjects: [],
      };
    }

    if (!usersReady || !projectsReady) {
      return {
        ready: false,
        message: presentation.missingTablesMessage,
        userCount: 0,
        projectCount: 0,
        recentUsers: [],
        recentProjects: [],
      };
    }

    const viewer={userId:user?.id,email:user?.email,isSuperuser:session?.user.isSuperuser};
    const [userCount, projectCount, recentUsers, recentProjects] = await Promise.all([
      getUserCount(),
      getManagedProjectCountForViewer(viewer),
      listUsers(5),
      listManagedProjectsForViewer(viewer).then(projects=>projects.slice(0,5)),
    ]);

    return {
      ready: true,
      message: presentation.summary,
      userCount,
      projectCount,
      recentUsers,
      recentProjects,
    };
  } catch (error) {
    return {
      ready: false,
      message: error instanceof Error ? error.message : "관리자 요약 정보를 불러오지 못했습니다.",
      userCount: 0,
      projectCount: 0,
      recentUsers: [],
      recentProjects: [],
    };
  }
}

import { getDatabaseAdminStatus } from "@/lib/database-admin";
import { listProjects, getProjectCount } from "@/lib/repositories/project-repository";
import { getUserCount, listUsers } from "@/lib/repositories/user-repository";
import type { Project } from "@/models/project";
import type { User } from "@/models/user";

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
    const databaseStatus = await getDatabaseAdminStatus();
    const usersReady = databaseStatus.databaseExists && databaseStatus.tables.some((table) => table.name === "users" && table.exists);
    const projectsReady = databaseStatus.databaseExists && databaseStatus.tables.some((table) => table.name === "projects" && table.exists);

    if (!databaseStatus.databaseExists) {
      return {
        ready: false,
        message: "대상 DB가 아직 생성되지 않았습니다. 관리자 DB 페이지에서 먼저 초기화해야 합니다.",
        userCount: 0,
        projectCount: 0,
        recentUsers: [],
        recentProjects: [],
      };
    }

    if (!usersReady || !projectsReady) {
      return {
        ready: false,
        message: "핵심 테이블이 아직 모두 준비되지 않았습니다. DB 초기화 후 상태를 다시 확인해야 합니다.",
        userCount: 0,
        projectCount: 0,
        recentUsers: [],
        recentProjects: [],
      };
    }

    const [userCount, projectCount, recentUsers, recentProjects] = await Promise.all([
      getUserCount(),
      getProjectCount(),
      listUsers(5),
      listProjects(5),
    ]);

    return {
      ready: true,
      message: "Google 로그인 사용자 메타데이터 동기화, 프로젝트 및 작업 저장소, 간트 시각화, 제출물 피드백, 첨부파일 공유, 관리자 세팅과 파일 로그 기반 운영 흐름이 활성화되어 있습니다.",
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
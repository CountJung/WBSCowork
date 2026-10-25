import type { Metadata } from "next";
import { UserGuideHome } from "@/src/widgets/user-guide";
export const metadata: Metadata = { title: "WBSCowork 사용설명서", description: "역할에 맞는 프로젝트·업무·제출물·팀 준비표·보고서 사용 방법을 쉬운 한국어로 안내합니다." };
export default function GuidePage() { return <UserGuideHome />; }

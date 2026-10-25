import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGuideRole } from "@/src/entities/user-guide";
import { UserGuideRole } from "@/src/widgets/user-guide";
type Props = { params: Promise<{ role: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { role } = await params, guideRole = getGuideRole(role);
  return { title: guideRole ? `${guideRole.label} 사용 안내 · WBSCowork` : "사용설명서 · WBSCowork" };
}
export default async function GuideRolePage({ params }: Props) {
  const { role } = await params, guideRole = getGuideRole(role);
  if (!guideRole) notFound();
  return <UserGuideRole role={guideRole} />;
}

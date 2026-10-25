import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGuideFeature, getGuideRole } from "@/src/entities/user-guide";
import { UserGuideFeature } from "@/src/widgets/user-guide";
type Props = { params: Promise<{ role: string; feature: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { role, feature } = await params, entry = getGuideFeature(role, feature);
  return { title: entry ? `${entry.title} · WBSCowork 사용설명서` : "사용설명서 · WBSCowork" };
}
export default async function GuideFeaturePage({ params }: Props) {
  const { role, feature } = await params, guideRole = getGuideRole(role), entry = getGuideFeature(role, feature);
  if (!guideRole || !entry) notFound();
  return <UserGuideFeature role={guideRole} feature={entry} />;
}

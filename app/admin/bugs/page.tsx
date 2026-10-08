import { BugListPage } from "@/src/widgets/bug-reports";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <BugListPage admin params={await searchParams} />;
}

import { BugDetailPage } from "@/src/widgets/bug-reports";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <BugDetailPage
      trash
      id={Number((await params).id)}
      params={await searchParams}
    />
  );
}

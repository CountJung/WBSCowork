import PersonalWorkPage from "@/src/widgets/personal-work";
import type { PersonalWorkSearchParams } from "@/src/entities/task";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<PersonalWorkSearchParams> }) {
  return <PersonalWorkPage searchParams={await searchParams} />;
}

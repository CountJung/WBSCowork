import WorkSearchPage from '@/src/widgets/work-search';
import type {WorkSearchParams} from '@/src/entities/task';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<WorkSearchParams>}){return <WorkSearchPage searchParams={await searchParams}/>;}

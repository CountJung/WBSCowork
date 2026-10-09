import SubmissionHistoryPage from '@/src/widgets/submission-history';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{revision?:string;page?:string;commentPage?:string;eventPage?:string}>}) {
 const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)notFound();
 return <SubmissionHistoryPage id={id} {...await searchParams}/>;
}

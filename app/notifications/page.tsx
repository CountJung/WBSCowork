import NotificationsPage from '@/src/widgets/notifications';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <NotificationsPage searchParams={await searchParams}/>;}

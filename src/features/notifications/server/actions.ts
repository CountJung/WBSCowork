"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {getAuthSession,getSignInPath,getUserByEmail} from '@/src/entities/user/index.server';
import {markNotificationRead} from '@/src/entities/notification/index.server';
import {notificationSource,parseNotificationFilters} from '@/src/entities/notification';
export async function markNotificationReadAction(form:FormData){
 const session=await getAuthSession();if(!session?.user)redirect(getSignInPath('/notifications'));
 let filters;try{filters=parseNotificationFilters({scope:String(form.get('scope')??'unread'),page:String(form.get('page')??'1')});}catch{redirect('/notifications');}
 let source;try{source=notificationSource(form.get('source'));}catch{redirect('/notifications');}
 const sourceId=Number(form.get('sourceId'));if(!Number.isSafeInteger(sourceId)||sourceId<1)redirect('/notifications');
 const user=await getUserByEmail(session.user.email??'');
 if(user)await markNotificationRead({userId:user.id,isSuperuser:session.user.isSuperuser},source,sourceId);
 revalidatePath('/notifications');redirect(`/notifications?scope=${filters.scope}&page=${filters.page}`);
}

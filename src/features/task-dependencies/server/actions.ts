"use server";
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getAuthSession,getSignInPath,getUserByEmail } from '@/src/entities/user/index.server';
import { canWriteTaskContent } from '@/src/entities/user';
import { getTaskById,setTaskPredecessors } from '@/src/entities/task/index.server';
export async function setTaskPredecessorsAction(form:FormData) {
 const session=await getAuthSession();if(!session?.user)redirect(getSignInPath('/tasks'));
 const taskId=Number(form.get('taskId'));let projectId:number|undefined,message='선행 관계를 저장했습니다.',status='success';
 try {
  if(!canWriteTaskContent(session.user.role,session.user.isSuperuser))throw new Error('업무 작성 권한이 없습니다.');
  const user=await getUserByEmail(session.user.email??'');if(!user)throw new Error('사용자를 확인할 수 없습니다.');
  const task=Number.isSafeInteger(taskId)&&taskId>0?await getTaskById(taskId):null;if(!task)throw new Error('업무를 찾을 수 없습니다.');projectId=task.projectId;
  await setTaskPredecessors({taskId,version:Number(form.get('version')),graphVersion:Number(form.get('graphVersion')),predecessorIds:form.getAll('predecessorId').map(Number),token:String(form.get('operationToken')??''),actor:{userId:user.id,isAdmin:user.role==='admin',isSuperuser:session.user.isSuperuser}});
  revalidatePath('/tasks');revalidatePath('/');revalidatePath('/my-work');
 } catch(error) {status='error';message=error instanceof Error?error.message:'선행 관계를 저장하지 못했습니다.';}
 const query=new URLSearchParams({status,message});if(projectId)query.set('projectId',String(projectId));if(Number.isSafeInteger(taskId)&&taskId>0)query.set('taskId',String(taskId));redirect('/tasks?'+query);
}

"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {getAuthSession,getSignInPath,getUserByEmail} from '@/src/entities/user/index.server';
import {canWriteTaskContent} from '@/src/entities/user';
import {applyTaskTemplate} from '@/src/entities/task/index.server';
export async function applyTaskTemplateAction(form:FormData){
 const session=await getAuthSession();if(!session?.user)redirect(getSignInPath('/tasks'));
 let message='템플릿 업무를 생성했습니다.',taskId:number|undefined;
 const projectId=Number(form.get('projectId'));
 try{
  if(!canWriteTaskContent(session.user.role,session.user.isSuperuser))throw new Error('업무 작성 권한이 없습니다.');
  const user=await getUserByEmail(session.user.email??'');if(!user)throw new Error('사용자를 확인할 수 없습니다.');
  const json=form.get('nodes');if(typeof json!=='string'||json.length>100000)throw new Error('미리보기 크기가 너무 큽니다.');
  const result=await applyTaskTemplate({projectId,templateKey:String(form.get('templateKey')??''),templateVersion:Number(form.get('templateVersion')),nodes:JSON.parse(json),token:String(form.get('operationToken')??''),actor:{userId:user.id,isAdmin:user.role==='admin',isSuperuser:session.user.isSuperuser}});
  taskId=result.taskIds[0];message=result.replayed?'이미 처리한 템플릿 요청입니다. 기존 생성 결과를 확인해 주세요.':`${result.taskIds.length}개 업무를 생성했습니다.`;
  revalidatePath('/tasks');revalidatePath('/');revalidatePath('/my-work');
 }catch(error){return {error:error instanceof Error?error.message:'템플릿 생성 실패'};}
 const q=new URLSearchParams({status:'success',message});if(Number.isSafeInteger(projectId)&&projectId>0)q.set('projectId',String(projectId));if(taskId)q.set('taskId',String(taskId));redirect('/tasks?'+q);
}

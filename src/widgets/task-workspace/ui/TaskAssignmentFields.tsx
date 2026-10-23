"use client";
import FieldLabel from "@/src/shared/ui/field-label";
import {useState} from "react";
import {MenuItem,TextField,Stack} from "@mui/material";
import type {CompletionMode} from "@/src/entities/project";
import type {User} from "@/src/entities/user";
type Props={isVolunteer:boolean;teams:{id:number;name:string}[];memberIdsByTeam:Record<number,number[]>;projectMemberIds?:number[];users:Pick<User,"id"|"name">[];eligibleUserIds:number[];defaultTeamId?:number|null;defaultAssigneeId?:number|null;defaultReviewerId?:number|null;defaultMode?:CompletionMode;defaultReviewRequired?:boolean;canChangeMode?:boolean;includeReviewer?:boolean;allowUnassignedTeam?:boolean};
export default function TaskAssignmentFields({isVolunteer,teams,memberIdsByTeam,projectMemberIds=[],users,eligibleUserIds,defaultTeamId,defaultAssigneeId,defaultReviewerId,defaultMode,defaultReviewRequired=false,canChangeMode=true,includeReviewer=false,allowUnassignedTeam=true}:Props){
 const [team,setTeam]=useState(String(defaultTeamId??""));
 const [assignee,setAssignee]=useState(String(defaultAssigneeId??""));
 const [mode,setMode]=useState<CompletionMode>(defaultMode??(isVolunteer?"direct_completion":"submission_required"));
 const [review,setReview]=useState(defaultReviewRequired?"1":"0");
 const ids=team?(memberIdsByTeam[Number(team)]??[]):isVolunteer?projectMemberIds:eligibleUserIds;
 return <Stack spacing={1.5}>
   {isVolunteer?<TextField select name="activityTeamId" label={<FieldLabel requirement={!allowUnassignedTeam?"required":"optional"}>활동팀</FieldLabel>} value={team} required={!allowUnassignedTeam} onChange={e=>{setTeam(e.target.value);setAssignee("");}}><MenuItem value="" disabled={!allowUnassignedTeam}>공통 업무 (관리자)</MenuItem>{teams.map(t=><MenuItem key={t.id} value={String(t.id)}>{t.name}</MenuItem>)}</TextField>:null}
   <TextField select name="assigneeId" label={<FieldLabel requirement="before_completion">담당자</FieldLabel>} value={assignee} onChange={e=>setAssignee(e.target.value)} helperText={isVolunteer?"선택한 팀의 현재 참여자에게 배정합니다.":undefined}><MenuItem value="">미지정</MenuItem>{users.filter(u=>eligibleUserIds.includes(u.id)&&(ids.includes(u.id)||u.id===defaultAssigneeId)).map(u=><MenuItem key={u.id} value={String(u.id)} disabled={!ids.includes(u.id)}>{u.name}</MenuItem>)}</TextField>
   {isVolunteer?<TextField select name={canChangeMode?"completionMode":undefined} label={<FieldLabel requirement="required">완료 방식</FieldLabel>} value={mode} disabled={!canChangeMode} onChange={e=>{const value=e.target.value as CompletionMode;setMode(value);if(value==="direct_completion")setReview("0");}} helperText="시작 전 업무에서만 변경할 수 있습니다. 직접 완료도 제출물·첨부를 선택해서 남길 수 있습니다."><MenuItem value="direct_completion">직접 완료 · 제출물 선택</MenuItem><MenuItem value="submission_required">제출 필수</MenuItem></TextField>:null}
   <TextField select name={canChangeMode?"reviewRequired":undefined} label={<FieldLabel requirement="required">검토 방식</FieldLabel>} value={review} disabled={!canChangeMode} onChange={e=>{setReview(e.target.value);if(e.target.value==="1")setMode("submission_required");}}><MenuItem value="0">별도 검토자 승인 없이 완료</MenuItem><MenuItem value="1">제출물 검토자 승인 후 완료</MenuItem></TextField>
   {includeReviewer?<TextField select name="reviewerId" label={<FieldLabel requirement={review==='1'?'before_completion':'optional'}>검토자</FieldLabel>} defaultValue={String(defaultReviewerId??"")}><MenuItem value="">미지정</MenuItem>{users.filter(u=>eligibleUserIds.includes(u.id)||u.id===defaultReviewerId).map(u=><MenuItem key={u.id} value={String(u.id)} disabled={!eligibleUserIds.includes(u.id)||String(u.id)===assignee}>{u.name}</MenuItem>)}</TextField>:null}
 </Stack>;
}

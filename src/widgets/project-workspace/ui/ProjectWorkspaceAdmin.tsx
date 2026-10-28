import SubmitButton from "@/src/shared/ui/submit-button";
import FieldLabel from "@/src/shared/ui/field-label";
import ConfirmationCheckbox from "@/src/shared/ui/confirmation-checkbox";
import {randomUUID} from "node:crypto";
import {Alert,Button,Chip,Divider,MenuItem,Stack,TextField,Typography} from "@mui/material";
import {activityKinds,activityKindLabels,type ProjectWorkspace,type ProjectAccessPreview} from "@/src/entities/project";
import type {User} from "@/src/entities/user";

type Action=(form:FormData)=>Promise<void>;
function Fields({workspace,kind}:{workspace:ProjectWorkspace;kind:string}){
  return <><input type="hidden" name="projectId" value={workspace.projectId}/><input type="hidden" name="workspaceVersion" value={workspace.version}/><input type="hidden" name="operationToken" value={randomUUID()}/><input type="hidden" name="workspaceKind" value={kind}/></>;
}
export default function ProjectWorkspaceAdmin({workspace,users,action,accessPreview}:{workspace:ProjectWorkspace;users:User[];action:Action;accessPreview:ProjectAccessPreview|null}){
  const userName=(id:number)=>users.find(u=>u.id===id)?.name??`회원 #${id}`;
  const active=workspace.members.filter(m=>m.active);
  const candidates=users.filter(user=>!user.isSuperuser);
  return <Stack key={`${workspace.projectId}:${workspace.version}`} spacing={2}>
    <Divider/><Typography variant="h6">프로젝트 소속과 활동팀</Typography>
    <Typography variant="body2">슈퍼관리자가 프로젝트 소속을 지정합니다. 소속 추가는 계정 역할이나 비공개 제출물 열람 권한을 높이지 않습니다.</Typography>
    {accessPreview?<Stack spacing={1.5} data-testid={`project-access-${workspace.projectId}`} sx={{p:2,border:1,borderColor:"divider",borderRadius:2}}>
      <Typography variant="subtitle1">프로젝트 접근 범위</Typography>
      <Typography>현재: {accessPreview.accessMode==="members_only"?"소속 구성원만":"기존 접근 유지"}</Typography>
      <Typography variant="body2">소속 {accessPreview.activeMemberCount}명 · 제한 전환 시 접근 유지 {accessPreview.visibleUserCount}명 / 제한 {accessPreview.blockedUserCount}명</Typography>
      <Typography variant="caption">슈퍼관리자만 전체 프로젝트에 접근하며 일반 관리자는 지정된 프로젝트만 관리합니다. 소속만으로 비공개 제출물이 공개되지는 않습니다. 사용자 소속을 자동으로 추정하거나 부여하지 않습니다.</Typography>
      {accessPreview.warnings.map((warning,index)=><Alert severity="warning" key={index}>{warning}</Alert>)}
      <Stack component="form" action={action} spacing={1.5} aria-label="프로젝트 접근 범위 전환">
        <Fields workspace={{...workspace,version:accessPreview.version}} kind="access_mode"/>
        <input type="hidden" name="impactHash" value={accessPreview.impactHash}/>
        <input type="hidden" name="accessMode" value={accessPreview.accessMode==="members_only"?"legacy_authenticated":"members_only"}/>
        <ConfirmationCheckbox name="confirmImpact" value="yes" required label="위 접근 영향과 기록 보존을 확인했습니다 · 필수"/>
        <SubmitButton variant="outlined" disabled={accessPreview.accessMode!=="members_only"&&!accessPreview.canRestrict} pendingLabel="전환 중…">{accessPreview.accessMode==="members_only"?"기존 접근으로 전환":"소속 제한으로 전환"}</SubmitButton>
        <Typography variant="caption">소속 제한은 공개 제출물과 본인의 과거 자료에도 적용됩니다. 해제된 소속은 다시 지정하기 전까지 접근할 수 없으며 기록은 삭제하지 않습니다. 기존 접근으로 되돌려도 관리자 범위는 지정 프로젝트로 유지됩니다.</Typography>
      </Stack>
    </Stack>:null}
    <Stack component="form" action={action} spacing={1.5}>
      <Fields workspace={workspace} kind="project_type"/>
      <TextField select name="projectType" label="프로젝트 유형" defaultValue={workspace.projectType}><MenuItem value="collaboration">업무 협업</MenuItem><MenuItem value="volunteering">봉사활동</MenuItem></TextField>
      <Typography variant="caption">유형 변경은 참여자·팀·업무가 없는 프로젝트에서만 가능합니다.</Typography>
      <Button type="submit" variant="outlined">프로젝트 유형 변경</Button>
    </Stack>
      {accessPreview?<Stack component="form" action={action} spacing={1.5}>
        <Fields workspace={workspace} kind="project_member"/><input type="hidden" name="active" value="1"/>
        <TextField select name="userId" label={<FieldLabel requirement="required">프로젝트 참여자</FieldLabel>} defaultValue="" required><MenuItem value="" disabled>참여자를 선택하세요</MenuItem>{candidates.filter(u=>!active.some(m=>m.userId===u.id)).map(u=><MenuItem key={u.id} value={u.id}>{u.name}{u.role==="admin"?" · 관리자":""}</MenuItem>)}</TextField>
        <SubmitButton variant="outlined" pendingLabel="소속 지정 중…">참여자 추가</SubmitButton>
      </Stack>:null}
      <Stack spacing={1}>{active.map(member=><Stack key={member.userId} direction={{xs:"column",sm:"row"}} spacing={1} sx={{alignItems:{sm:"center"},justifyContent:"space-between"}}>
        <Typography>{userName(member.userId)}{users.find(user=>user.id===member.userId)?.isSuperuser?" · 슈퍼관리자 (기존 소속)":users.find(user=>user.id===member.userId)?.role==="admin"?" · 이 프로젝트 관리자":""}</Typography>{accessPreview?<Stack component="form" action={action}><Fields workspace={workspace} kind="project_member"/><input type="hidden" name="active" value="0"/><input type="hidden" name="userId" value={member.userId}/><SubmitButton size="small" pendingLabel="종료 중…">프로젝트 참여 종료</SubmitButton></Stack>:null}
      </Stack>)}</Stack>
    {!accessPreview?<Typography variant="caption">프로젝트 소속 지정·해제와 접근 범위 변경은 슈퍼관리자 전용입니다.</Typography>:null}
    {workspace.projectType==="volunteering"?<>
      <Typography variant="body2">활동팀에는 여러 명이 참여할 수 있고 한 사람이 여러 팀에 참여할 수 있습니다. 팀장은 팀당 한 명이며 교체하면 이전 팀장은 팀원으로 남습니다.</Typography>
      <Stack component="form" action={action} spacing={1.5}>
        <Fields workspace={workspace} kind="create_team"/>
        <TextField select name="activityKind" label="활동 종류" defaultValue="meal">{activityKinds.map(kind=><MenuItem key={kind} value={kind}>{activityKindLabels[kind]}</MenuItem>)}</TextField>
        <TextField name="teamName" label={<FieldLabel requirement="required">팀 이름</FieldLabel>} required slotProps={{htmlInput:{maxLength:255}}}/>
        <Button type="submit" variant="outlined">활동팀 추가</Button>
      </Stack>
      {workspace.teams.map(team=><Stack key={team.id} spacing={1.5} data-testid={`activity-team-${team.id}`} sx={{p:2,border:1,borderColor:"divider",borderRadius:2}}>
        <Typography variant="subtitle1">{team.name}</Typography><Chip label={activityKindLabels[team.activityKind]} size="small" sx={{alignSelf:"flex-start"}}/>
        <Typography>팀장: {team.leaderUserId?userName(team.leaderUserId):"미지정"}</Typography>
        <Button href={team.activityKind==="media"?`/projects/${workspace.projectId}/media?teamId=${team.id}`:`/projects/${workspace.projectId}/teams/${team.id}/preparation`} variant="outlined" sx={{alignSelf:"flex-start"}}>{team.activityKind==="media"?"사진첩·영상 관리":"팀 준비표 · 메뉴·활동 준비"}</Button>
        {workspace.teamMembers.filter(m=>m.teamId===team.id&&m.active).map(member=><Stack key={member.userId} component="form" action={action} direction={{xs:"column",sm:"row"}} spacing={1} sx={{justifyContent:"space-between"}}>
          <Fields workspace={workspace} kind="team_member"/><input type="hidden" name="active" value="0"/><input type="hidden" name="teamId" value={team.id}/><input type="hidden" name="userId" value={member.userId}/><input type="hidden" name="role" value={member.role}/>
          <Typography>{userName(member.userId)} · {member.userId===team.leaderUserId?"팀장":"팀원"}</Typography><Button type="submit" size="small">팀에서 제외</Button>
        </Stack>)}
        <Stack component="form" action={action} spacing={1.5} aria-label={`${team.name} 참여자 배정`}>
          <Fields workspace={workspace} kind="team_member"/><input type="hidden" name="active" value="1"/><input type="hidden" name="teamId" value={team.id}/>
          <TextField select name="userId" label={<FieldLabel requirement="required">팀 참여자</FieldLabel>} defaultValue="" required><MenuItem value="" disabled>프로젝트 참여자 선택</MenuItem>{active.filter(m=>candidates.some(u=>u.id===m.userId)).map(m=><MenuItem key={m.userId} value={m.userId}>{userName(m.userId)}</MenuItem>)}</TextField>
          <TextField select name="role" label="팀 역할" defaultValue="member" helperText="업무 작성 권한이 있는 팀원만 팀장으로 지정할 수 있습니다."><MenuItem value="member">팀원</MenuItem><MenuItem value="leader">팀장 (기존 팀장 교체)</MenuItem></TextField>
          <Button type="submit" variant="outlined">팀원 배정</Button>
        </Stack>
      </Stack>)}
      <Typography variant="caption">진행 담당 업무가 남아 있거나 팀장인 경우 먼저 재배정·해임한 후 소속을 해제하세요. 봉사 대상자의 개인정보·아동 개별정보는 입력하지 마세요.</Typography>
    </>:null}
  </Stack>;
}

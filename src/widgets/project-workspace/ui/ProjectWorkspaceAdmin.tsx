import {randomUUID} from "node:crypto";
import {Button,Chip,Divider,MenuItem,Stack,TextField,Typography} from "@mui/material";
import {activityKinds,activityKindLabels,type ProjectWorkspace} from "@/src/entities/project";
import type {User} from "@/src/entities/user";

type Action=(form:FormData)=>Promise<void>;
function Fields({workspace,kind}:{workspace:ProjectWorkspace;kind:string}){
  return <><input type="hidden" name="projectId" value={workspace.projectId}/><input type="hidden" name="workspaceVersion" value={workspace.version}/><input type="hidden" name="operationToken" value={randomUUID()}/><input type="hidden" name="workspaceKind" value={kind}/></>;
}
export default function ProjectWorkspaceAdmin({workspace,users,action}:{workspace:ProjectWorkspace;users:User[];action:Action}){
  const userName=(id:number)=>users.find(u=>u.id===id)?.name??`회원 #${id}`;
  const active=workspace.members.filter(m=>m.active);
  return <Stack key={`${workspace.projectId}:${workspace.version}`} spacing={2}>
    <Divider/><Typography variant="h6">봉사활동 팀과 참여자</Typography>
    <Typography variant="body2">활동팀에는 여러 명이 참여할 수 있고 한 사람이 여러 팀에 참여할 수 있습니다. 팀장은 팀당 한 명이며 교체하면 이전 팀장은 팀원으로 남습니다.</Typography>
    <Stack component="form" action={action} spacing={1.5}>
      <Fields workspace={workspace} kind="project_type"/>
      <TextField select name="projectType" label="프로젝트 유형" defaultValue={workspace.projectType}><MenuItem value="collaboration">업무 협업</MenuItem><MenuItem value="volunteering">봉사활동</MenuItem></TextField>
      <Typography variant="caption">유형 변경은 참여자·팀·업무가 없는 프로젝트에서만 가능합니다.</Typography>
      <Button type="submit" variant="outlined">프로젝트 유형 변경</Button>
    </Stack>
    {workspace.projectType==="volunteering"?<>
      <Stack component="form" action={action} spacing={1.5}>
        <Fields workspace={workspace} kind="project_member"/><input type="hidden" name="active" value="1"/>
        <TextField select name="userId" label="프로젝트 참여자" defaultValue="" required><MenuItem value="" disabled>참여자를 선택하세요</MenuItem>{users.filter(u=>!active.some(m=>m.userId===u.id)).map(u=><MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}</TextField>
        <Button type="submit" variant="outlined">참여자 추가</Button>
      </Stack>
      <Stack spacing={1}>{active.map(member=><Stack key={member.userId} direction={{xs:"column",sm:"row"}} spacing={1} sx={{alignItems:{sm:"center"},justifyContent:"space-between"}}>
        <Typography>{userName(member.userId)}</Typography><Stack component="form" action={action}><Fields workspace={workspace} kind="project_member"/><input type="hidden" name="active" value="0"/><input type="hidden" name="userId" value={member.userId}/><Button type="submit" size="small">프로젝트 참여 종료</Button></Stack>
      </Stack>)}</Stack>
      <Stack component="form" action={action} spacing={1.5}>
        <Fields workspace={workspace} kind="create_team"/>
        <TextField select name="activityKind" label="활동 종류" defaultValue="meal">{activityKinds.map(kind=><MenuItem key={kind} value={kind}>{activityKindLabels[kind]}</MenuItem>)}</TextField>
        <TextField name="teamName" label="팀 이름" required slotProps={{htmlInput:{maxLength:255}}}/>
        <Button type="submit" variant="outlined">활동팀 추가</Button>
      </Stack>
      {workspace.teams.map(team=><Stack key={team.id} spacing={1.5} data-testid={`activity-team-${team.id}`} sx={{p:2,border:1,borderColor:"divider",borderRadius:2}}>
        <Typography variant="subtitle1">{team.name}</Typography><Chip label={activityKindLabels[team.activityKind]} size="small" sx={{alignSelf:"flex-start"}}/>
        <Typography>팀장: {team.leaderUserId?userName(team.leaderUserId):"미지정"}</Typography>
        {workspace.teamMembers.filter(m=>m.teamId===team.id&&m.active).map(member=><Stack key={member.userId} component="form" action={action} direction={{xs:"column",sm:"row"}} spacing={1} sx={{justifyContent:"space-between"}}>
          <Fields workspace={workspace} kind="team_member"/><input type="hidden" name="active" value="0"/><input type="hidden" name="teamId" value={team.id}/><input type="hidden" name="userId" value={member.userId}/><input type="hidden" name="role" value={member.role}/>
          <Typography>{userName(member.userId)} · {member.userId===team.leaderUserId?"팀장":"팀원"}</Typography><Button type="submit" size="small">팀에서 제외</Button>
        </Stack>)}
        <Stack component="form" action={action} spacing={1.5} aria-label={`${team.name} 참여자 배정`}>
          <Fields workspace={workspace} kind="team_member"/><input type="hidden" name="active" value="1"/><input type="hidden" name="teamId" value={team.id}/>
          <TextField select name="userId" label="팀 참여자" defaultValue="" required><MenuItem value="" disabled>프로젝트 참여자 선택</MenuItem>{active.map(m=><MenuItem key={m.userId} value={m.userId}>{userName(m.userId)}</MenuItem>)}</TextField>
          <TextField select name="role" label="팀 역할" defaultValue="member" helperText="업무 작성 권한이 있는 팀원만 팀장으로 지정할 수 있습니다."><MenuItem value="member">팀원</MenuItem><MenuItem value="leader">팀장 (기존 팀장 교체)</MenuItem></TextField>
          <Button type="submit" variant="outlined">팀원 배정</Button>
        </Stack>
      </Stack>)}
      <Typography variant="caption">담당 업무가 남아 있으면 먼저 재배정하거나 연결을 해제한 후 참여를 종료하세요. 봉사 대상자의 개인정보·아동 개별정보는 입력하지 마세요.</Typography>
    </>:null}
  </Stack>;
}

"""Hydrated volunteer UI QA; all synthetic identity and writes stay on loopback."""
import json,os,sys
from pathlib import Path
from urllib.parse import parse_qs,unquote,urlparse
from playwright.sync_api import expect,sync_playwright
from sites_test_network import validate_origin

settings=json.load(sys.stdin)
root=validate_origin(settings['url'],local_only=True)
assets=Path('dist/client').resolve()
output=Path('.test-artifacts/volunteer-browser');output.mkdir(parents=True,exist_ok=True)
checks=0
cases=[]
console_messages=[]
admin_spa=os.environ.get('WBS_QA_ADMIN_SPA')=='1'

def check(value,label):
    global checks
    assert value,label
    checks+=1
    print('PASS '+label,flush=True)

def choose(form,name,value):
    field=form.locator(f'[name="{name}"]')
    field.locator('..').get_by_role('combobox').click()
    form.page.locator(f'[role="option"][data-value="{value}"]').click()

def submit(form,button,success=True):
    page=form.page
    spa_admin=admin_spa and urlparse(page.url).path=='/admin/projects'
    resets={}
    removed=False
    if spa_admin and form.locator('[name="workspaceKind"]').count():
        kind=form.locator('[name="workspaceKind"]').input_value()
        active=form.locator('[name="active"]').input_value() if form.locator('[name="active"]').count() else None
        if kind=='create_team':resets={'teamName':''}
        elif kind=='project_member' and active=='1':resets={'userId':''}
        elif kind=='team_member' and active=='1':resets={'userId':'','role':'member'}
        elif active=='0':removed=True
    with page.expect_response(lambda response:response.request.method=='POST' and response.url.startswith(root+'/'),timeout=30000) as pending:
        form.get_by_role('button',name=button,exact=True).click()
    response=pending.value
    assert response.status in [200,303],f'Unexpected action HTTP {response.status}'
    expected='success' if success else 'error'
    page.wait_for_url(lambda target:parse_qs(urlparse(target).query).get('status')==[expected],wait_until='networkidle',timeout=30000)
    page.wait_for_load_state('networkidle')
    if spa_admin:
        for name,value in resets.items():expect(form.locator(f'[name="{name}"]')).to_have_value(value,timeout=10000)
        if removed:expect(form).to_have_count(0,timeout=10000)
    else:page.reload(wait_until='networkidle')
    query=parse_qs(urlparse(page.url).query)
    assert query.get('status')==[expected],f'Expected {expected}: {page.url}'

def workspace_form(card,kind):
    return card.locator(f'form:has(input[name="workspaceKind"][value="{kind}"])')

with sync_playwright() as p:
    config=(output/'chrome-config').resolve();config.mkdir(exist_ok=True)
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,chromium_sandbox=True,env={**os.environ,'XDG_CONFIG_HOME':str(config)})
    for width,legacy_task in [(1280,1),(390,2)]:
        contexts=[]
        errors=[]
        failed_requests=[]
        def session(actor):
            context=browser.new_context(viewport={'width':width,'height':1000},color_scheme='light' if width==1280 else 'dark')
            contexts.append(context)
            context.add_cookies([{'name':'next-auth.session-token','value':settings['tokens'][str(actor)],'url':root,'httpOnly':True,'sameSite':'Lax'}])
            def route(request):
                if not request.request.url.startswith(root+'/'):
                    request.abort();return
                target=(assets/unquote(urlparse(request.request.url).path).lstrip('/')).resolve()
                if target.is_relative_to(assets) and target.is_file():
                    request.fulfill(path=str(target));return
                request.continue_()
            context.route('**/*',route)
            page=context.new_page()
            page.on('pageerror',lambda error:errors.append(str(error)))
            def console(message):
                if message.type in ['error','warning']:
                    console_messages.append({'width':width,'type':message.type,'text':message.text[:1500]})
                if message.type=='error':errors.append('console: '+message.text[:1500])
            page.on('console',console)
            page.on('requestfailed',lambda request:failed_requests.append({'path':urlparse(request.url).path,'failure':request.failure}))
            return context,page

        admin_context,admin=session(1)
        admin.goto(root+'/admin/projects',wait_until='networkidle')
        create=admin.locator('form:has([name="projectType"])').filter(has_not=admin.locator('[name="projectId"]')).first
        create.locator('[name="name"]').fill(f'Volunteer browser {width}')
        choose(create,'projectType','volunteering')
        create.locator('[name="goal"]').fill('Synthetic volunteer coordination')
        create.locator('[name="successCriteria"]').fill('Synthetic tasks finished')
        submit(create,'프로젝트 생성')
        project_card=admin.locator('[data-testid^="project-card-"]').filter(has_text=f'Volunteer browser {width}')
        project_id=int(project_card.get_attribute('data-testid').split('-')[-1])
        check(project_card.get_by_text('봉사활동 팀과 참여자',exact=True).count()==1,f'{width}: create volunteer project through actual UI')
        for user in [2,3,4,5]:
            form=workspace_form(project_card,'project_member').filter(has=admin.get_by_role('button',name='참여자 추가',exact=True))
            choose(form,'userId',user)
            submit(form,'참여자 추가')
        check(True,f'{width}: add project participants')
        for kind,name in [('meal',f'식사 QA {width}'),('facility',f'보수 QA {width}')]:
            form=workspace_form(project_card,'create_team')
            choose(form,'activityKind',kind)
            form.locator('[name="teamName"]').fill(name)
            submit(form,'활동팀 추가')
        team=project_card.locator('[data-testid^="activity-team-"]').filter(has_text=f'식사 QA {width}')
        other_team=project_card.locator('[data-testid^="activity-team-"]').filter(has_text=f'보수 QA {width}')
        team_id=int(team.get_attribute('data-testid').split('-')[-1])
        for target,user,role in [(team,2,'leader'),(team,3,'member'),(team,4,'member'),(other_team,5,'leader'),(other_team,3,'member')]:
            form=workspace_form(target,'team_member').filter(has=admin.get_by_role('button',name='팀원 배정',exact=True))
            choose(form,'userId',user)
            choose(form,'role',role)
            submit(form,'팀원 배정')
        check(True,f'{width}: assign one leader, members, and a participant in two activity teams')

        leader_context,leader=session(2)
        leader.goto(root+f'/tasks?projectId={project_id}',wait_until='networkidle')
        create_task=leader.locator('form:has([name="title"]):has([name="projectId"]):not(:has([name="taskId"]))')
        create_task.locator('[name="title"]').fill(f'QA direct {width}')
        choose(create_task,'activityTeamId',team_id)
        check(create_task.locator('[name="completionMode"]').input_value()=='direct_completion',f'{width}: new volunteer task defaults to optional submission/direct completion')
        create_task.locator('[name="definitionOfDone"]').fill('QA criteria checked')
        choose(create_task,'assigneeId',3)
        submit(create_task,'작업 생성')
        task_id=int(parse_qs(urlparse(leader.url).query)['taskId'][0])
        check(True,f'{width}: scoped leader creates and assigns own-team WBS task')

        member_context,member=session(3)
        task_url=root+f'/tasks?projectId={project_id}&taskId={task_id}'
        member.goto(task_url,wait_until='networkidle')
        task=member.locator(f'#task-{task_id}')
        status=task.locator('form:has([name="taskStatus"])')
        status.locator('[name="projectId"]').evaluate('(element)=>element.value="1"')
        choose(status,'taskStatus','done')
        submit(status,'상태 저장',success=False)
        check(True,f'{width}: tampered cross-project status form is denied')
        member.goto(task_url,wait_until='networkidle')
        task=member.locator(f'#task-{task_id}')
        status=task.locator('form:has([name="taskStatus"])')
        choose(status,'taskStatus','done')
        status.locator('[name="note"]').fill('')
        submit(status,'상태 저장')
        check(task.get_by_text('QA Member',exact=False).count()>0 and task.get_by_text('완료',exact=True).count()>0,f'{width}: assignee completes without a submission or mandatory note')
        member.reload(wait_until='networkidle')
        status=task.locator('form:has([name="taskStatus"])')
        choose(status,'taskStatus','in_progress')
        status.locator('[name="note"]').fill(f'QA reopen {width}')
        submit(status,'상태 저장')
        check(task.get_by_text(f'QA reopen {width}',exact=False).count()>0,f'{width}: completion and reasoned reopen history survive reload')

        leader.goto(task_url,wait_until='networkidle')
        old_status=leader.locator(f'#task-{task_id} form:has([name="taskStatus"])')
        form=workspace_form(team,'team_member').filter(has=admin.get_by_role('button',name='팀원 배정',exact=True))
        choose(form,'userId',4);choose(form,'role','leader');submit(form,'팀원 배정')
        choose(old_status,'taskStatus','done')
        submit(old_status,'상태 저장',success=False)
        check(leader.locator(f'#task-{task_id} form:has([name="taskStatus"])').count()==0,f'{width}: replacing a leader immediately rejects their stale form/session')
        replacement_context,replacement=session(4)
        replacement.goto(task_url,wait_until='networkidle')
        new_status=replacement.locator(f'#task-{task_id} form:has([name="taskStatus"])')
        choose(new_status,'taskStatus','done')
        submit(new_status,'상태 저장')
        check(True,f'{width}: replacement leader can directly complete their own team task')

        member.goto(task_url,wait_until='networkidle')
        task=member.locator(f'#task-{task_id}')
        submission=task.locator('form').filter(has=member.get_by_role('button',name='제출 등록',exact=True))
        submission.locator('[name="content"]').fill(f'QA PRIVATE OPTIONAL {width}')
        submission.locator('input[name="visibility"][value="private"]').check()
        submission.locator('[name="attachments"]').set_input_files({'name':'volunteer.txt','mimeType':'text/plain','buffer':f'SYNTHETIC VOLUNTEER {width}'.encode()})
        submit(submission,'제출 등록')
        link=task.locator('a[href^="/api/submission-attachments/"]').first
        download=root+link.get_attribute('href')
        downloaded=member_context.request.get(download)
        check(downloaded.status==200 and downloaded.body()==f'SYNTHETIC VOLUNTEER {width}'.encode(),f'{width}: optional private TXT upload persists and downloads exact bytes')
        replacement.goto(task_url,wait_until='networkidle')
        check(replacement.get_by_text(f'QA PRIVATE OPTIONAL {width}',exact=True).count()==0 and replacement_context.request.get(download).status==404,f'{width}: team leader gains no private submission/file access')

        stale_replacement=replacement.locator(f'#task-{task_id} form:has([name="taskStatus"])')
        removal=workspace_form(team,'team_member').filter(has=admin.locator('input[name="userId"][value="4"]')).filter(has=admin.get_by_role('button',name='팀에서 제외',exact=True))
        submit(removal,'팀에서 제외')
        choose(stale_replacement,'taskStatus','in_progress')
        stale_replacement.locator('[name="note"]').fill('Revoked leader must fail')
        submit(stale_replacement,'상태 저장',success=False)
        check(replacement.locator(f'#task-{task_id} form:has([name="taskStatus"])').count()==0,f'{width}: team departure immediately revokes stale leader authority')

        member.goto(root+f'/tasks?projectId=1&taskId={legacy_task}',wait_until='networkidle')
        legacy=member.locator(f'#task-{legacy_task}')
        legacy_status=legacy.locator('form:has([name="taskStatus"])')
        choose(legacy_status,'taskStatus','done')
        legacy_status.locator('[name="note"]').fill('Legacy still needs submission')
        submit(legacy_status,'상태 저장',success=False)
        check(True,f'{width}: old collaboration task still rejects completion without a submission')
        member.goto(task_url,wait_until='networkidle')
        check(member.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'{width}: task workspace has no horizontal overflow')
        admin.goto(root+'/admin/projects',wait_until='networkidle')
        check(admin.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'{width}: project/team admin has no horizontal overflow')
        check(not errors,f'{width}: no uncaught browser page errors')
        check(not [request for request in failed_requests if request['failure']!='net::ERR_ABORTED'],f'{width}: no failed browser requests except navigation cancellation')
        member.screenshot(path=str(output/f'task-{width}.png'),full_page=True)
        admin.screenshot(path=str(output/f'admin-{width}.png'),full_page=True)
        cases.append({'width':width,'projectId':project_id,'teamId':team_id,'taskId':task_id,'legacyTaskId':legacy_task})
        for context in contexts:context.close()
    browser.close()
output.joinpath('result.json').write_text(json.dumps({'complete':True,'checks':checks,'cases':cases,'adminSpa':admin_spa},indent=2))
output.joinpath('console.json').write_text(json.dumps(console_messages,indent=2))

"""Project UX acceptance on real hydrated pages and synthetic loopback fixtures only."""
import json
import os
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
from playwright.sync_api import expect, sync_playwright
from sites_test_network import validate_origin

settings = json.load(sys.stdin)
root = validate_origin(settings['url'], local_only=True)
assets = Path('dist/client').resolve()
output = Path(settings.get('output', '.test-artifacts/project-ux/worker'))
assert output.resolve().is_relative_to(Path('.test-artifacts/project-ux').resolve()), 'Output must stay in synthetic artifact directory'
output.mkdir(parents=True, exist_ok=True)
checks = []
cases = []
errors = []
console = []
requests_failed = []
geometry = []
contrast = []

def check(value, label):
    assert value, label
    checks.append(label)
    print('PASS ' + label, flush=True)

def query(page):
    return parse_qs(urlparse(page.url).query)

def choose(form, name, value):
    field = form.locator(f'[name="{name}"]')
    field.locator('..').get_by_role('combobox').click()
    form.page.locator(f'[role="option"][data-value="{value}"]').click()

def inspect_option(form, name, value, label):
    page = form.page
    trigger = form.locator(f'[name="{name}"]').locator('..').get_by_role('combobox')
    trigger.click()
    option = page.locator(f'[role="option"][data-value="{value}"]')
    expect(option).to_be_visible()
    screenshot(page, label)
    metrics = option.evaluate('(element)=>({scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,whiteSpace:getComputedStyle(element).whiteSpace})')
    geometry.append({'label': label + '-option', **metrics})
    check(metrics['scrollWidth'] <= metrics['clientWidth'] + 1 and metrics['whiteSpace'] == 'normal', label + ': long option wraps inside bounded popover')
    page.keyboard.press('Escape')
    expect(trigger).to_be_focused()
    check(True, label + ': Escape restores select focus')

def go(page, path):
    response = page.goto(root + path, wait_until='networkidle')
    assert response.status == 200, f'Unexpected document HTTP {response.status}: {path}'
    page.evaluate('document.fonts.ready')

def screenshot(page, label):
    page.screenshot(path=str(output / (label + '.png')), full_page=True)
    (output / (label + '.html')).write_text(page.content())
    result = page.evaluate('''() => {
      const width=innerWidth;
      const out=[...document.querySelectorAll('main *')].filter(e=>{
        const r=e.getBoundingClientRect(),s=getComputedStyle(e);
        if(!r.width||!r.height||s.display==='none'||s.visibility==='hidden')return false;
        if(e.closest('.gantt-container,.gantt-wrapper,[data-testid="gantt-scroll"]'))return false;
        return r.left < -1 || r.right > width+1;
      }).slice(0,20).map(e=>({tag:e.tagName,id:e.id,testid:e.getAttribute('data-testid'),text:e.textContent.slice(0,80),left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}));
      return {width,scrollWidth:document.documentElement.scrollWidth,overflow:out};
    }''')
    geometry.append({'label': label, **result})
    check(result['scrollWidth'] <= result['width'] + 1, label + ': no page horizontal overflow')
    measure_contrast(page, label)

def measure_contrast(page, label):
    measured = page.evaluate(r"""() => {
      const rgba=s=>{const n=s.match(/[\d.]+/g)?.map(Number);return n?.length>=3?[n[0],n[1],n[2],n[3]??1]:null;};
      const blend=(f,b)=>[0,1,2].map(i=>f[i]*f[3]+b[i]*(1-f[3]));
      const lum=c=>c.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
      const result=[];
      for(const e of document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,.MuiChip-label,a.MuiButton-root,button.MuiButton-root')){
        const st=getComputedStyle(e),r=e.getBoundingClientRect();
        if(!r.width||!r.height||st.visibility!=='visible'||e.closest('[disabled],[aria-disabled="true"],[aria-hidden="true"]')||!e.textContent.trim())continue;
        const layers=[];let supported=true;
        for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p),bg=rgba(s.backgroundColor);if(bg&&bg[3]>0)layers.push(bg);if(bg?.[3]===1)break;if(s.backgroundImage!=='none'){supported=false;break;}}
        if(!supported||!layers.length)continue;
        let bg=[255,255,255];for(const layer of layers.reverse())bg=blend(layer,bg);
        const fg=rgba(st.color);if(!fg)continue;
        const a=lum(blend(fg,bg)),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),size=parseFloat(st.fontSize),bold=Number(st.fontWeight)>=700,minimum=size>=24||(size>=18.66&&bold)?3:4.5;
        result.push({text:e.textContent.trim().slice(0,100),ratio,minimum,fontSize:size,fontWeight:st.fontWeight});
      }
      return result;
    }""")
    contrast.append({'label': label, 'measurements': measured})
    violations = [item for item in measured if item['ratio'] < item['minimum']]
    check(not violations, label + ': measured solid-background text contrast ' + str(violations[:2]))


def action(form, button, success=True):
    page = form.page
    with page.expect_response(lambda response: response.request.method == 'POST' and response.url.startswith(root + '/'), timeout=30000) as response:
        form.get_by_role('button', name=button, exact=True).click()
    assert response.value.status in [200, 303]
    expected = 'success' if success else 'error'
    page.wait_for_url(lambda url: parse_qs(urlparse(url).query).get('status') == [expected], wait_until='networkidle')
    page.reload(wait_until='networkidle')

def binding_acceptance(browser):
    sessions = []
    binding_console = []
    binding_http_errors = []
    phase = {'name': 'initial-roster'}
    def session(actor):
        context = browser.new_context(viewport={'width': 390, 'height': 900}, color_scheme='light', has_touch=True)
        sessions.append(context)
        current_actor = {'id': actor}
        def identity(user):
            current_actor['id'] = user
            context.clear_cookies()
            context.add_cookies([{'name': 'next-auth.session-token', 'value': settings['tokens'][str(user)], 'url': root, 'httpOnly': True, 'sameSite': 'Lax'}])
        identity(actor)
        def route(request):
            if not request.request.url.startswith(root + '/'):
                request.abort()
                return
            target = (assets / unquote(urlparse(request.request.url).path).lstrip('/')).resolve()
            if settings.get('runtime', 'worker') == 'worker' and target.is_relative_to(assets) and target.is_file():
                request.fulfill(path=str(target))
                return
            request.continue_()
        context.route('**/*', route)
        page = context.new_page()
        page.on('response', lambda response: binding_http_errors.append({'actor': current_actor['id'], 'phase': phase['name'], 'path': urlparse(response.url).path, 'method': response.request.method, 'status': response.status}) if response.status >= 400 else None)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: binding_console.append({'case': 'binding-390', 'actor': current_actor['id'], 'phase': phase['name'], 'url': page.url, 'location': message.location, 'type': message.type, 'text': message.text[:1500]}) if message.type in ['warning', 'error'] else None)
        page.on('requestfailed', lambda request: requests_failed.append({'path': urlparse(request.url).path, 'failure': request.failure}))
        return context, page, identity
    def workspace(card, kind):
        return card.locator(f'form:has(input[name="workspaceKind"][value="{kind}"])')
    context, su, identity = session(1)
    try:
        go(su, '/admin/projects')
        for project, users in [(101, [2, 6, 5]), (102, [2, 3])]:
            card = su.locator(f'[data-testid="project-card-{project}"]')
            for user in users:
                form = workspace(card, 'project_member').filter(has=su.get_by_role('button', name='참여자 추가', exact=True))
                choose(form, 'userId', user)
                action(form, '참여자 추가')
            preview = card.locator(f'[data-testid="project-access-{project}"]')
            check(preview.get_by_text('현재: 기존 접근 유지', exact=True).count() == 1, f'binding: project {project} impact preview precedes activation')
            transition = workspace(card, 'access_mode')
            check(len(transition.locator('[name="impactHash"]').input_value()) == 64 and not transition.locator('[name="confirmImpact"]').is_checked(), f'binding: project {project} preview fingerprint and explicit confirmation are present')
        card = su.locator('[data-testid="project-card-101"]')
        tampered = workspace(card, 'project_member').filter(has=su.get_by_role('button', name='참여자 추가', exact=True))
        choose(tampered, 'userId', 4)
        phase['name'] = 'stale-SU-membership-command-as-admin'
        identity(6)
        action(tampered, '참여자 추가', success=False)
        check(su.locator('[name="workspaceKind"][value="project_member"]').count() == 0 and su.locator('[data-testid^="project-access-"]').count() == 0, 'binding: assigned admin stale SU membership command denied and SU controls hidden')
        phase['name'] = 'restore-SU-and-activate'
        identity(1)
        go(su, '/admin/projects')
        for project in [101, 102]:
            card = su.locator(f'[data-testid="project-card-{project}"]')
            transition = workspace(card, 'access_mode')
            transition.locator('[name="confirmImpact"]').check()
            action(transition, '소속 제한으로 전환')
            expect(card.get_by_text('현재: 소속 구성원만', exact=True)).to_be_visible()
        check(True, 'binding: SU explicitly activates two generic collaboration project scopes through hydrated forms')
        screenshot(su, 'binding-390-su-activated')
        phase['name'] = 'assigned-admin-read'
        admin_context, assigned, _ = session(6)
        go(assigned, '/admin/projects')
        check(assigned.locator('[data-testid="project-card-101"]').count() == 1 and assigned.locator('[data-testid="project-card-102"]').count() == 0, 'binding: administrator management list contains assigned A and excludes unassigned B')
        check(assigned.locator('[name="workspaceKind"][value="project_member"]').count() == 0 and assigned.locator('[data-testid^="project-access-"]').count() == 0, 'binding: assigned admin cannot manage membership or access settings')
        go(assigned, '/tasks?projectId=101&taskId=101')
        check(assigned.locator('[data-testid="task-detail-101"]').get_by_role('button', name='수정', exact=True).count() == 1, 'binding: assigned admin can manage own project task')
        check(assigned.locator('[data-testid="task-detail-101"] form:has([name="taskStatus"])').count() == 1, 'binding: assigned administrator has execution controls in own project')
        check(admin_context.request.get(root + '/tasks?projectId=102').status == 404, 'binding: assigned admin has no protected B read bypass')
        phase['name'] = 'unassigned-admin-read'
        unassigned_context, unassigned, _ = session(7)
        go(unassigned, '/admin/projects')
        check(unassigned.locator('[data-testid^="project-card-"]').count() == 0 and unassigned.get_by_text('관리하도록 지정된 프로젝트가 없습니다.', exact=False).count() > 0, 'binding: unassigned admin receives no management projects')
        check(unassigned_context.request.get(root + '/tasks?projectId=101').status == 404, 'binding: unassigned admin cannot read protected A')
        phase['name'] = 'B-only-member-read'
        b_context, b_user, _ = session(3)
        go(b_user, '/tasks?projectId=102')
        check(b_context.request.get(root + '/tasks?projectId=101').status == 404, 'binding: B-only user cannot open protected A directly')
        phase['name'] = 'guest-read-only'
        guest_context, guest, _ = session(5)
        go(guest, '/tasks?projectId=101&taskId=101&submissionId=101')
        check(guest.locator('[data-testid="submission-detail-101"]').count() == 1 and guest.locator('form:has([name="taskStatus"])').count() == 0 and guest.get_by_role('button', name='제출물 등록…', exact=True).count() == 0, 'binding: guest membership permits read without write promotion')
        check(guest_context.request.get(root + '/api/submission-attachments/102').status == 404, 'binding: project membership does not disclose another author private file')
        phase['name'] = 'A-author-before-removal'
        member_context, member, _ = session(2)
        go(member, '/tasks?projectId=101&taskId=101&submissionId=101')
        check(member.locator('[data-testid="task-detail-101"] form:has([name="taskStatus"])').count() == 0, 'binding: ordinary nonassignee collaboration member has no execution controls')
        check(member_context.request.get(root + '/api/submission-attachments/102').status == 200, 'binding: current member author can read own private file')
        member.get_by_role('button', name='댓글 작성', exact=True).click()
        stale = member.locator('form').filter(has=member.get_by_role('button', name='댓글 등록', exact=True))
        stale.locator('[name="content"]').fill('SYNTHETIC STALE MUST NOT SAVE')
        card = su.locator('[data-testid="project-card-101"]')
        removal = workspace(card, 'project_member').filter(has=su.locator('input[name="active"][value="0"]')).filter(has=su.locator('input[name="userId"][value="2"]'))
        phase['name'] = 'SU-removes-A-membership'
        action(removal, '프로젝트 참여 종료')
        check(True, 'binding: SU removes A membership through actual roster UI')
        phase['name'] = 'removed-author-stale-comment'
        with member.expect_response(lambda response: response.request.method == 'POST' and response.url.startswith(root + '/'), timeout=30000) as denied:
            stale.get_by_role('button', name='댓글 등록', exact=True).click()
        check(denied.value.status in [200, 303, 404], 'binding: stale comment form receives normal denial response after membership removal')
        member.wait_for_load_state('networkidle')
        phase['name'] = 'removed-author-fresh-requests'
        for path in ['/tasks?projectId=101', '/tasks?projectId=101&taskId=101&submissionId=102', '/submissions/102', '/api/submission-attachments/101', '/api/submission-attachments/102']:
            check(member_context.request.get(root + path).status == 404, 'binding: removed author next request denied ' + path)
        go(member, '/tasks?projectId=102')
        check(member_context.request.get(root + '/api/submission-attachments/103').status == 200, 'binding: removing A preserves independent B membership and public file access')
        go(member, '/tasks')
        check(member.get_by_text('합성 소속 범위 A', exact=True).count() == 0 and member.get_by_text('합성 소속 범위 B', exact=True).count() > 0, 'binding: project list excludes removed A and retains B')
        go(member, '/search?q=BINDING_PUBLIC_A')
        check('BINDING_PUBLIC_A' not in member.locator('main').inner_text().replace('검색어: BINDING_PUBLIC_A', ''), 'binding: removed A content does not appear in search results')
        screenshot(member, 'binding-390-member-after-removal')
        phase['name'] = 'SU-legacy-rollback'
        card = su.locator('[data-testid="project-card-101"]')
        transition = workspace(card, 'access_mode')
        transition.locator('[name="confirmImpact"]').check()
        action(transition, '기존 접근으로 전환')
        check(member_context.request.get(root + '/api/submission-attachments/101').status == 200 and member_context.request.get(root + '/api/submission-attachments/102').status == 200, 'binding: explicit legacy rollback restores public and own-private read without deleting records')
        check(unassigned_context.request.get(root + '/api/submission-attachments/102').status == 404, 'binding: legacy rollback does not grant unassigned admin private access')
        check(not errors, 'binding: no uncaught page errors')
        for message in binding_console:
            expected = message['type'] == 'error' and 'Failed to load resource' in message['text'] and '404' in message['text']
            message['expectedProtectedHttp404'] = expected
            assert message['type'] != 'error' or expected, message
        console.extend(binding_console)
        return {'complete': True, 'width': 390, 'mode': 'SU scoped A/B activation/revocation/rollback', 'expectedHttp404ConsoleCount': sum(item.get('expectedProtectedHttp404', False) for item in binding_console)}
    except Exception:
        for index, candidate in enumerate([su] + [ctx.pages[0] for ctx in sessions[1:] if ctx.pages]):
            if not candidate.is_closed():
                candidate.screenshot(path=str(output / f'binding-failure-{index}.png'), full_page=True)
                (output / f'binding-failure-{index}.html').write_text(candidate.content())
        console.extend(binding_console)
        raise
    finally:
        output.joinpath('binding-console.json').write_text(json.dumps(binding_console, ensure_ascii=False, indent=2))
        output.joinpath('binding-http-errors.json').write_text(json.dumps(binding_http_errors, ensure_ascii=False, indent=2))
        for context in sessions:
            context.close()

try:
    with sync_playwright() as p:
        config = (output / 'chrome-config').resolve()
        config.mkdir(exist_ok=True)
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, chromium_sandbox=True, env={**os.environ, 'XDG_CONFIG_HOME': str(config)})
        for width in ([] if os.environ.get('WBS_PROJECT_UX_BINDING_ONLY') == '1' else [360, 390, 768, 1280, 1440]):
            for theme in ['light', 'dark']:
                label = f'{width}-{theme}'
                context = browser.new_context(viewport={'width': width, 'height': 900}, color_scheme=theme, has_touch=width in [360, 390])
                context.add_cookies([{'name': 'next-auth.session-token', 'value': settings['tokens']['1'], 'url': root, 'httpOnly': True, 'sameSite': 'Lax'}])
                def route(request):
                    if not request.request.url.startswith(root + '/'):
                        request.abort()
                        return
                    target = (assets / unquote(urlparse(request.request.url).path).lstrip('/')).resolve()
                    if settings.get("runtime", "worker") == "worker" and target.is_relative_to(assets) and target.is_file():
                        request.fulfill(path=str(target))
                        return
                    request.continue_()
                context.route('**/*', route)
                page = context.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                def collect(message):
                    if message.type in ['error', 'warning']:
                        console.append({'case': label, 'type': message.type, 'text': message.text[:1500]})
                    if message.type == 'error':
                        errors.append(message.text[:1500])
                page.on('console', collect)
                page.on('requestfailed', lambda request: requests_failed.append({'path': urlparse(request.url).path, 'failure': request.failure}))
                try:
                    go(page, '/tasks?projectId=1&teamId=1')
                    expect(page.locator('[data-testid="task-summary-1"]')).to_be_visible()
                    expect(page.locator('html')).to_have_attribute('data-mui-color-scheme', theme)
                    check(True, label + ': actual MUI color scheme matches requested theme')
                    check(page.locator('[data-testid^="task-summary-"]').count() == 2, label + ': team-filtered summary preserves parent and child')
                    check(page.locator('[data-testid^="task-detail-"]').count() == 0 and page.locator('textarea[name="content"]').count() == 0, label + ': main renders summaries without full submission/comment forms')
                    check(page.get_by_text('COMMENT_FULL_TEXT_ONLY_IN_DETAIL:', exact=False).count() == 0 and page.get_by_text('PUBLIC_FULL_TEXT_ONLY_IN_DETAIL:', exact=False).count() == 0, label + ': main hides submission and comment full text')
                    check('PUBLIC_FULL_TEXT_ONLY_IN_DETAIL:' not in page.content() and 'COMMENT_FULL_TEXT_ONLY_IN_DETAIL:' not in page.content(), label + ': main HTML/RSC omits full submission/comment payload')
                    check(page.locator('[name="confirmRevisionDeletion"]').count() == 0, label + ': main does not expose destructive confirmation')
                    summary = page.locator('[data-testid="task-summary-1"]')
                    boxes = summary.evaluate('''(element)=>[...element.firstElementChild.children].map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};})''')
                    check(all(boxes[i]['bottom'] <= boxes[i+1]['top'] + 1 for i in range(len(boxes)-1)), label + ': summary title/chips/assignee/actions do not overlap')
                    chip_boxes = summary.locator('.MuiChip-root').evaluate_all('''elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})''')
                    check(all(not (min(a['right'],b['right'])-max(a['left'],b['left']) > 1 and min(a['bottom'],b['bottom'])-max(a['top'],b['top']) > 1) for i,a in enumerate(chip_boxes) for b in chip_boxes[i+1:]), label + ': wrapped summary chips do not overlap')
                    screenshot(page, label + '-summary')
                    if (width, theme) in [(360, 'light'), (1440, 'dark')]:
                        page.locator('summary').filter(has_text='새 업무 추가').click()
                        create_preview = page.locator('form:has([name="title"]):not(:has([name="taskId"]))')
                        inspect_option(create_preview, 'activityTeamId', 1, label + '-team-options')
                        inspect_option(create_preview, 'parentId', 1, label + '-parent-options')
                        page.locator('summary').filter(has_text='새 업무 추가').click()

                    if width < 900:
                        trigger = page.locator('button[aria-label="메뉴 열기"]')
                        trigger.focus()
                        page.keyboard.press('Enter')
                        expect(trigger).to_have_attribute('aria-expanded', 'true')
                        page.keyboard.press('Escape')
                        expect(trigger).to_have_attribute('aria-expanded', 'false')
                        expect(trigger).to_be_focused()
                        bounds = trigger.bounding_box()
                        check(bounds['width'] >= 44 and bounds['height'] >= 44, label + ': mobile navigation Escape restores focus and has 44px target')
                    link = page.locator('[data-testid="task-summary-1"]').get_by_role('link', name='업무 상세', exact=True)
                    link.focus()
                    page.keyboard.press('Tab')
                    page.keyboard.press('Shift+Tab')
                    expect(link).to_be_focused()
                    check(link.evaluate('(element)=>element.matches(":focus-visible")'), label + ': keyboard task-detail link has visible focus')
                    target = link.bounding_box()
                    check(target['width'] >= 24 and target['height'] >= 24, label + ': detail action meets 24px target minimum')
                    page.keyboard.press('Enter')
                    page.wait_for_url(lambda url: parse_qs(urlparse(url).query).get('taskId') == ['1'], wait_until='networkidle')
                    detail = page.locator('[data-testid="task-detail-1"]')
                    expect(detail).to_be_visible()
                    check(page.locator('[data-testid^="task-detail-"]').count() == 1, label + ': focused task shows one detail card')
                    check(query(page).get('teamId') == ['1'], label + ': focused task keeps team filter')
                    check(page.get_by_text('COMMENT_FULL_TEXT_ONLY_IN_DETAIL:', exact=False).count() == 0, label + ': task detail keeps comments behind submission detail')
                    check('PUBLIC_FULL_TEXT_ONLY_IN_DETAIL:' not in page.content() and 'COMMENT_FULL_TEXT_ONLY_IN_DETAIL:' not in page.content(), label + ': task-summary payload omits full submission and comments')
                    expect(detail.locator('[data-testid="submission-summary-1"]')).to_be_visible()
                    note_form = detail.locator('form:has([name="taskStatus"])')
                    choose(note_form, 'taskStatus', 'done')
                    note = note_form.locator('[name="note"]')
                    check(not note.evaluate('(element)=>element.required'), label + ': direct-completion note stays optional')
                    choose(note_form, 'taskStatus', 'blocked')
                    check(note.evaluate('(element)=>element.required'), label + ': blocked state requires note')
                    described = note.get_attribute('aria-describedby')
                    check(bool(described) and all(page.locator('[id="' + item + '"]').count() == 1 for item in described.split()), label + ': state note helper is programmatically associated')
                    note_form.get_by_role('button', name='상태 저장', exact=True).click()
                    expect(note).to_have_attribute('aria-invalid', 'true')
                    check(note.input_value() == '', label + ': blank blocked reason is rejected and associated error is exposed')
                    choose(note_form, 'taskStatus', 'planned')
                    detail.get_by_role('button', name='수정', exact=True).click()
                    edit = detail.locator('form:has([name="title"])')
                    check(edit.locator('[name="title"]').evaluate('(element)=>element.required'), label + ': edit title is immediately required')
                    title_input = edit.locator('[name="title"]')
                    expect(title_input).to_be_focused()
                    original_title = title_input.input_value()
                    if (width, theme) in [(360, 'light'), (1440, 'dark')]:
                        assignee_select = edit.locator('[name="assigneeId"]').locator('..').get_by_role('combobox')
                        assignee_select.click()
                        option = page.locator('[role="option"][data-value="2"]')
                        expect(option).to_be_visible()
                        screenshot(page, label + '-assignee-options')
                        option_metrics = option.evaluate('(element)=>({scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,whiteSpace:getComputedStyle(element).whiteSpace})')
                        geometry.append({'label': label + '-assignee-option', **option_metrics})
                        check(option_metrics['scrollWidth'] <= option_metrics['clientWidth'] + 1, label + ': long assignee option does not require horizontal scrolling')
                        page.keyboard.press('Escape')
                        expect(assignee_select).to_be_focused()
                        check(True, label + ': assignee menu Escape restores selection focus')
                    title_input.fill('')
                    edit.get_by_role('button', name='저장', exact=True).click()
                    expect(title_input).to_have_attribute('aria-invalid', 'true')
                    check(bool(title_input.get_attribute('aria-describedby')), label + ': missing title error is connected to field')
                    title_input.fill(original_title)
                    end_date = edit.locator('[name="endDate"]')
                    end_date.fill('2025-12-31')
                    end_date.press('Tab')
                    expect(end_date).to_have_attribute('aria-invalid', 'true')
                    check(end_date.get_attribute('min') == edit.locator('[name="startDate"]').input_value(), label + ': end-date minimum and error follow current start date')
                    check(not edit.locator('[name="deliverable"]').evaluate('(element)=>element.required') and not edit.locator('[name="definitionOfDone"]').evaluate('(element)=>element.required'), label + ': outcome and done criteria permit empty drafts')
                    screenshot(page, label + '-validation-error')
                    edit.get_by_role('button', name='취소', exact=True).click()
                    check(detail.locator('form:has([name="title"])').count() == 0, label + ': edit cancel leaves original view')
                    expect(detail.get_by_role('button', name='수정', exact=True)).to_be_focused()
                    delete_trigger = detail.get_by_role('button', name='작업 삭제…', exact=True)
                    delete_trigger.click()
                    confirmation = page.locator('[data-testid="task-delete-confirm-1"]')
                    expect(confirmation).to_be_visible()
                    check(confirmation.evaluate('(element)=>element.contains(document.activeElement)'), label + ': destructive dialog contains keyboard focus')
                    page.keyboard.press('Escape')
                    expect(confirmation).not_to_be_visible()
                    expect(delete_trigger).to_be_focused()
                    check(True, label + ': destructive dialog Escape restores trigger focus')
                    delete_trigger.click()
                    expect(confirmation).to_be_visible()
                    screenshot(page, label + '-delete-confirm')
                    box = confirmation.locator('input[type="checkbox"]')
                    check(not box.is_checked() and box.evaluate('(element)=>element.required') and confirmation.get_by_role('button', name='영구 삭제', exact=True).is_disabled(), label + ': destructive confirmation requires explicit unchecked consent')
                    # Inspect enabled destructive colors without submitting or deleting any row.
                    destructive = confirmation.get_by_role('button', name='영구 삭제', exact=True)
                    box.check()
                    expect(destructive).to_be_enabled()
                    page.mouse.move(0, 0)
                    page.wait_for_timeout(250)
                    measure_contrast(page, label + '-delete-enabled')
                    destructive.hover()
                    page.wait_for_timeout(250)
                    measure_contrast(page, label + '-delete-enabled-hover')
                    box.uncheck()
                    confirmation.get_by_role('button', name='삭제 취소', exact=True).click()
                    expect(confirmation).to_have_count(0)
                    check(True, label + ': delete cancel preserves task')
                    screenshot(page, label + '-task-detail')
                    detail.get_by_role('button', name='제출물 등록…', exact=True).click()
                    create_submission = detail.locator('form').filter(has=page.get_by_role('button', name='제출 등록', exact=True))
                    expect(create_submission.locator('[name="content"]')).to_be_visible()
                    check(create_submission.locator('[name="content"]').evaluate('(element)=>element.required'), label + ': optional submission path still requires body when opened')
                    create_submission.locator('[name="content"]').fill('합성 임시 등록 내용: 취소 후 서버에 저장되지 않습니다.')
                    if width in [360, 390]:
                        picker_trigger = create_submission.get_by_role('button', name='파일 선택', exact=True)
                    else:
                        picker_trigger = create_submission.get_by_role('button', name='첨부파일 선택', exact=True)
                    with page.expect_file_chooser() as chooser:
                        picker_trigger.focus()
                        page.keyboard.press('Enter')
                    chooser.value.set_files({'name': settings['filename'], 'mimeType': 'text/plain', 'buffer': b'SYNTHETIC UNSAVED UX PREVIEW'})
                    expect(create_submission.get_by_text(settings['filename'], exact=False)).to_be_visible()
                    screenshot(page, label + '-registration-draft')
                    create_submission.get_by_role('button', name='등록 취소', exact=True).click()
                    check(detail.locator('form').filter(has=page.get_by_role('button', name='제출 등록', exact=True)).count() == 0, label + ': registration cancel removes unsaved form and file selection')

                    submission_link = detail.locator('[data-testid="submission-summary-1"]').get_by_role('link', name='제출 상세·댓글', exact=True)
                    if width in [360, 390]:
                        submission_link.tap()
                    else:
                        submission_link.click()
                    page.wait_for_url(lambda url: parse_qs(urlparse(url).query).get('submissionId') == ['1'], wait_until='networkidle')
                    selected = page.locator('[data-testid="submission-detail-1"]')
                    expect(selected).to_be_visible()
                    check('PRIVATE_OTHER_AUTHOR_NOT_VISIBLE_TO_MEMBER' not in page.content(), label + ': selected submission payload excludes other submission body')
                    check(page.get_by_text('COMMENT_FULL_TEXT_ONLY_IN_DETAIL:', exact=False).count() > 0, label + ': submission detail reveals relevant comments')
                    check(selected.locator('a[href^="/api/submission-attachments/"]').count() == 1, label + ': long attachment filename remains accessible')
                    download = selected.locator('a[href^="/api/submission-attachments/"]').first
                    response = context.request.get(root + download.get_attribute('href'))
                    check(response.status == 200 and response.body() == b'SYNTHETIC PROJECT UX FILE', label + ': selected synthetic file downloads exact bytes')
                    screenshot(page, label + '-submission-detail')
                    for error_label in ['첨부 제외…', '댓글 삭제…', '제출물 삭제…']:
                        selected.get_by_role('button', name=error_label, exact=True).hover()
                        page.wait_for_timeout(250)
                        measure_contrast(page, label + '-error-hover-' + error_label)
                    if (width, theme) in [(360, 'light'), (1440, 'dark')]:
                        queue_return = '/my-work?scope=mine&status=all&overdue=0&page=1&taskId=1#work-1'
                        go(page, '/tasks?projectId=1&taskId=1&submissionId=1&teamId=1&returnTo=%2Fmy-work%3Fscope%3Dmine%26status%3Dall%26overdue%3D0%26page%3D1%26taskId%3D1%23work-1')
                        selected.get_by_role('link', name='버전·검토 이력', exact=True).click()
                        page.wait_for_url(lambda url: urlparse(url).path == '/submissions/1', wait_until='networkidle')
                        check(query(page).get('teamId') == ['1'] and query(page).get('returnTo') == [queue_return], label + ': version history retains team and personal-queue context')
                        screenshot(page, label + '-version-history')
                        page.get_by_role('link', name='제출 상세로 돌아가기', exact=True).click()
                        page.wait_for_url(lambda url: urlparse(url).path == '/tasks' and parse_qs(urlparse(url).query).get('submissionId') == ['1'], wait_until='networkidle')
                        check(query(page).get('teamId') == ['1'] and query(page).get('returnTo') == [queue_return], label + ': version history back restores selected submission, team, and queue')

                    page.get_by_role('link', name='업무 상세로 돌아가기', exact=True).click()
                    page.wait_for_url(lambda url: 'submissionId' not in parse_qs(urlparse(url).query), wait_until='networkidle')
                    check(query(page).get('taskId') == ['1'] and query(page).get('teamId') == ['1'], label + ': submission back restores task and team context')
                    page.get_by_role('link', name='업무 목록으로 돌아가기', exact=True).click()
                    page.wait_for_url(lambda url: 'taskId' not in parse_qs(urlparse(url).query), wait_until='networkidle')
                    check(query(page).get('teamId') == ['1'], label + ': list back preserves team filter')
                    page.go_back(wait_until='networkidle')
                    expect(page.locator('[data-testid="task-detail-1"]')).to_be_visible()
                    check(query(page).get('teamId') == ['1'], label + ': browser Back restores focused task and filter')
                    if (width, theme) in [(360, 'light'), (1440, 'dark')]:
                        go(page, '/tasks?projectId=1&taskId=2&teamId=1')
                        reopened = page.locator('[data-testid="task-detail-2"] form:has([name="taskStatus"])')
                        choose(reopened, 'taskStatus', 'in_progress')
                        check(reopened.locator('[name="note"]').evaluate('(element)=>element.required'), label + ': reopening a completed direct task requires reason')
                        go(page, '/tasks?projectId=1&taskId=3&teamId=2')
                        required = page.locator('[data-testid="task-detail-3"] form:has([name="taskStatus"])')
                        choose(required, 'taskStatus', 'done')
                        check(required.locator('[name="note"]').evaluate('(element)=>element.required'), label + ': submission-required completion requires reason')
                        go(page, '/tasks?projectId=1&taskId=4')
                        reviewed = page.locator('[data-testid="task-detail-4"] form:has([name="taskStatus"])')
                        reviewed.locator('[name="taskStatus"]').locator('..').get_by_role('combobox').click()
                        check(page.locator('[role="option"][data-value="done"]').count() == 0, label + ': review-required task does not expose manual completion')
                        page.keyboard.press('Escape')
                        approved_task = 601 if width == 360 else 602
                        go(page, f'/tasks?projectId=2&taskId={approved_task}')
                        approved = page.locator(f'[data-testid="task-detail-{approved_task}"] form:has([name="taskStatus"])')
                        status_trigger = approved.locator('[name="taskStatus"]').locator('..').get_by_role('combobox')
                        check(approved.locator('[name="taskStatus"]').input_value() == 'done' and '완료' in status_trigger.inner_text(), label + ': approved review task displays its current completed state')
                        status_trigger.click()
                        approved_done = page.locator('[role="option"][data-value="done"]')
                        expect(approved_done).to_have_attribute('aria-disabled', 'true')
                        check(True, label + ': approved completion is display-only and cannot be manually reselected')
                        page.locator('[role="option"][data-value="in_progress"]').click()
                        approved_note = approved.locator('[name="note"]')
                        check(approved_note.evaluate('(element)=>element.required'), label + ': approved review completion requires reason to reopen')
                        approved.get_by_role('button', name='상태 저장', exact=True).click()
                        expect(approved_note).to_have_attribute('aria-invalid', 'true')
                        approved_note.fill(f'QA reviewed reopen {label}')
                        action(approved, '상태 저장')
                        check(page.locator(f'[data-testid="task-detail-{approved_task}"] [name="taskStatus"]').input_value() == 'in_progress', label + ': approved review task reasoned reopen persists after reload')
                    go(page, '/tasks?projectId=3')
                    check(page.locator('[data-testid^="task-summary-"]').count() == 0 and page.locator('[data-testid^="task-detail-"]').count() == 0, label + ': real empty project has no phantom tasks')
                    screenshot(page, label + '-empty')
                    if (width, theme) in [(360, 'light'), (1440, 'dark')]:
                        go(page, '/search')
                        inspect_option(page.locator('form:has([name="q"])'), 'projectId', 1, label + '-project-options')
                        go(page, '/tasks?projectId=2')
                        create = page.locator('form:has([name="title"]):not(:has([name="taskId"]))')
                        if not create.is_visible():
                            page.locator('summary').filter(has_text='새 업무 추가').click()
                        title = f'QA UX 빈초안 {label}'
                        create.locator('[name="title"]').fill(title)
                        create.locator('[name="deliverable"]').fill('')
                        create.locator('[name="definitionOfDone"]').fill('')
                        with page.expect_response(lambda response: response.request.method == 'POST' and response.url.startswith(root + '/'), timeout=30000) as pending:
                            create.get_by_role('button', name='작업 생성', exact=True).click(click_count=2, delay=30)
                        check(pending.value.status in [200, 303], label + ': repeated create click receives valid action response')
                        page.wait_for_url(lambda url: parse_qs(urlparse(url).query).get('status') == ['success'], wait_until='networkidle')
                        page.reload(wait_until='networkidle')
                        check(page.get_by_text(title, exact=True).count() > 0, label + ': empty outcome/criteria draft persists after repeated click')
                    check(not errors, label + ': no uncaught page or console errors')
                    cases.append({'width': width, 'theme': theme, 'touch': width in [360, 390]})
                except Exception:
                    page.screenshot(path=str(output / (label + '-failure.png')), full_page=True)
                    (output / (label + '-failure.html')).write_text(page.content())
                    raise
                context.close()
        binding = binding_acceptance(browser)
        browser.close()
    check(all('ERR_ABORTED' in (request['failure'] or '') for request in requests_failed), 'no failed requests except navigation cancellation')
    output.joinpath('result.json').write_text(json.dumps({'complete': True, 'checks': len(checks), 'cases': cases, 'binding': binding, 'labels': checks}, ensure_ascii=False, indent=2))
finally:
    output.joinpath('execution-progress.json').write_text(json.dumps({'completedChecks': len(checks), 'completedCases': cases, 'labels': checks}, ensure_ascii=False, indent=2))
    output.joinpath('console.json').write_text(json.dumps(console, ensure_ascii=False, indent=2))
    output.joinpath('errors.json').write_text(json.dumps(errors, ensure_ascii=False, indent=2))
    output.joinpath('failed-requests.json').write_text(json.dumps(requests_failed, ensure_ascii=False, indent=2))
    output.joinpath('geometry.json').write_text(json.dumps(geometry, ensure_ascii=False, indent=2))
    output.joinpath('contrast.json').write_text(json.dumps(contrast, ensure_ascii=False, indent=2))
    if 'page' in globals() and not page.is_closed():
        try:
            page.screenshot(path=str(output / 'failure.png'), full_page=True)
        except Exception:
            pass

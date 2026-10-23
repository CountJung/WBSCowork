"""Focused hydrated preview QA. No identities or bytes leave the loopback fixture."""
import hashlib,json,os,sys
from pathlib import Path
from urllib.parse import parse_qs,urlparse,unquote
from playwright.sync_api import expect,sync_playwright
from sites_test_network import validate_origin

settings=json.load(sys.stdin)
root=validate_origin(settings['url'],local_only=True)
output=Path(settings['output']).resolve()
assert output.is_relative_to(Path('.test-artifacts/attachment-preview').resolve())
output.mkdir(parents=True,exist_ok=True)
files={item['kind']:item for item in settings['files']}
checks=0
widths=[]
console=[]
errors=[]
failed=[]
responses=[]
external=[]
preview_requests=[]
expected_failures={4006:415,4007:422,4010:422,4016:413,4019:422,4020:422}


def check(value,label):
    global checks
    assert value,label
    checks+=1
    print('PASS '+label,flush=True)


def file_url(file):return f'/api/submission-attachments/{file["id"]}'


def preview_url(path):return path+('&' if '?' in path else '?')+'preview=1'


def page_for(context,path):
    page=context.new_page()
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('requestfailed',lambda request:failed.append({'path':urlparse(request.url).path,'failure':request.failure}))
    page.on('request',lambda request:preview_requests.append(request.url) if parse_qs(urlparse(request.url).query).get('preview')==['1'] else None)
    page.on('response',lambda response:responses.append({'url':response.url,'status':response.status,'method':response.request.method}) if response.status>=400 else None)
    page.on('console',lambda message:console.append({'type':message.type,'text':message.text[:1200],'location':message.location}) if message.type in ['error','warning'] else None)
    response=page.goto(root+path,wait_until='networkidle')
    assert response.status==200,'Synthetic page did not load'
    return page


def row(page,file):
    return page.get_by_test_id('attachment-file').filter(has=page.locator(f'a[href="{file_url(file)}"]'))


def selected_page(context,submission):
    return page_for(context,f'/tasks?projectId=1001&taskId=2001&submissionId={submission}')


def safe_headers(response,label):
    headers=response.headers
    check('private' in headers.get('cache-control','') and 'no-store' in headers.get('cache-control',''),label+': private no-store')
    check(headers.get('x-content-type-options')=='nosniff' and 'sandbox' in headers.get('content-security-policy','') and "default-src 'none'" in headers.get('content-security-policy',''),label+': nosniff and sandbox CSP')


def open_preview(page,element,path,status=200,keyboard=False):
    with page.expect_response(lambda response:response.request.method=='GET' and response.url==root+preview_url(path),timeout=30000) as pending:
        trigger=element.get_by_role('button',name='미리보기',exact=True)
        if keyboard:
            trigger.focus();page.keyboard.press('Enter')
        else:trigger.click()
    response=pending.value
    assert response.status==status,'Preview returned unexpected HTTP status'
    region=element.get_by_role('region')
    expect(region).to_be_visible()
    return region,response


def close_preview(element):
    element.get_by_role('button',name='미리보기 닫기',exact=True).click()
    expect(element.get_by_role('region')).to_have_count(0)


def screenshot(page,label):
    page.screenshot(path=str(output/(label+'.png')),full_page=True)
    check(page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),label+': no page horizontal overflow')


def text_preview(page,file,label,expected_text=None,keyboard=False):
    element=row(page,file)
    region,response=open_preview(page,element,file_url(file),keyboard=keyboard)
    data=response.json()
    check(data.get('kind')=='text' and data.get('encoding')=='utf-8' and data.get('fileSize')==file['size'],label+': bounded UTF-8 JSON schema and actual file size')
    safe_headers(response,label)
    if expected_text is not None:check(data['text']==expected_text,label+': exact expected text without executing markup')
    if file['kind']=='empty':
        expect(region.get_by_text('빈 텍스트 파일입니다.',exact=True)).to_be_visible()
        check(data['text']=='' and data['previewBytes']==0,label+': empty text handled explicitly')
    else:
        pre=region.locator('pre[aria-label="파일 텍스트"]')
        expect(pre).to_be_visible()
        check(pre.text_content()==data['text'],label+': text is rendered literally')
        check(region.get_by_role('checkbox',name='줄바꿈',exact=True).is_checked() and pre.evaluate('(e)=>getComputedStyle(e).whiteSpace')=='pre-wrap',label+': safe wrapping enabled by default')
    check(region.locator('script,iframe,object,embed').count()==0 and not page.evaluate('Boolean(globalThis.__PREVIEW_EXECUTED__)'),label+': active HTML SVG and code execution absent')
    return element,region,data


def download(context,file,label):
    response=context.request.get(root+file_url(file))
    check(response.status==200 and hashlib.sha256(response.body()).hexdigest()==file['sha256'],label+': original download exact bytes')
    check(response.headers.get('content-disposition','').startswith('attachment;'),label+': original download disposition preserved')


def api_status(context,path,status,label):
    response=context.request.get(root+path)
    check(response.status==status,label)
    check('no-store' in response.headers.get('cache-control',''),label+': denial is not cached')
    return response


with sync_playwright() as playwright:
    profile=(output/'chrome-config').resolve();profile.mkdir(exist_ok=True)
    browser=playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,chromium_sandbox=True,env={**os.environ,'XDG_CONFIG_HOME':str(profile)})
    contexts=[]
    def context_for(actor,width=1280):
        context=browser.new_context(viewport={'width':width,'height':950},has_touch=width==390,accept_downloads=True)
        contexts.append(context)
        if actor is not None:context.add_cookies([{'name':'next-auth.session-token','value':settings['tokens'][str(actor)],'url':root,'httpOnly':True,'sameSite':'Lax'}])
        def route(request):
            if not request.request.url.startswith(root+'/'):
                external.append(urlparse(request.request.url).scheme+'://'+urlparse(request.request.url).netloc);request.abort();return
            if settings['runtime']=='worker':
                assets=Path('dist/client').resolve()
                target=(assets/unquote(urlparse(request.request.url).path).lstrip('/')).resolve()
                if target.is_relative_to(assets) and target.is_file():
                    request.fulfill(path=str(target));return
            request.continue_()
        context.route('**/*',route)
        context.add_init_script("""(() => { const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);globalThis.__qaPreviewUrls={created:[],revoked:[]};URL.createObjectURL=value=>{const url=create(value);globalThis.__qaPreviewUrls.created.push(url);return url;};URL.revokeObjectURL=url=>{globalThis.__qaPreviewUrls.revoked.push(url);return revoke(url);};})();""")
        return context
    try:
        for width in [390,1280]:
            context=context_for(2,width)
            before=len(preview_requests)
            page=selected_page(context,3001)
            label=f'{width}'
            check('PREVIEW_UTF8_한글' not in page.content() and 'LARGE_PREVIEW_START' not in page.content(),label+': file bodies omitted from initial HTML and RSC')
            check(before==len(preview_requests),label+': page load does not automatically fetch previews')
            element,region,data=text_preview(page,files['utf8'],label+' UTF8',settings['text'],keyboard=width==390)
            screenshot(page,label+'-utf8')
            close_preview(element)
            requests_before=len(preview_requests)
            element,region,data=text_preview(page,files['utf8'],label+' reopen',settings['text'])
            check(len(preview_requests)>requests_before,label+': reopening performs a fresh authorized request')
            close_preview(element)
            element,region,data=text_preview(page,files['bom'],label+' BOM','BOM_한글_정상');close_preview(element)
            element,region,data=text_preview(page,files['longline'],label+' longline')
            toggle=region.get_by_role('checkbox',name='줄바꿈',exact=True)
            toggle.uncheck()
            pre=region.locator('pre')
            check(pre.evaluate('(e)=>getComputedStyle(e).whiteSpace')=='pre' and pre.evaluate('(e)=>e.scrollWidth>e.clientWidth'),label+': optional no-wrap scroll stays inside preview')
            screenshot(page,label+'-longline')
            close_preview(element)
            element,region,data=text_preview(page,files['empty'],label+' empty');close_preview(element)
            element,region,data=text_preview(page,files['large'],label+' truncated')
            check(data['truncated'] is True and data['previewBytes']==262144 and len(data['text'].encode('utf-8'))<=262144 and '\ufffd' not in data['text'] and 'LARGE_PREVIEW_END' not in data['text'],label+': large UTF-8 prefix truncates without replacement characters')
            expect(region.get_by_role('alert')).to_be_visible()
            check(region.locator('pre').evaluate('(e)=>e.clientHeight<=480'),label+': large text preview height is bounded')
            screenshot(page,label+'-truncated')
            download(context,files['large'],label+' large')
            close_preview(element)
            page.goto(root+'/tasks?projectId=1001&taskId=2001&submissionId=3002',wait_until='networkidle')
            for kind in ['html','svg','markdown','code']:
                element,region,data=text_preview(page,files[kind],label+' raw '+kind)
                check(region.locator('a').count()==0,label+' raw '+kind+': no active links generated from source')
                close_preview(element)
            for kind in ['invalid-encoding','invalid-utf8','binary','mime-disguised']:
                file=files[kind];element=row(page,file)
                region,response=open_preview(page,element,file_url(file),expected_failures[file['id']])
                expect(region.get_by_role('alert')).to_be_visible()
                check(region.locator('pre,img,iframe').count()==0,label+' '+kind+': rejected bytes never rendered')
                download(context,file,label+' '+kind)
                close_preview(element)
            file=files['unsupported'];element=row(page,file)
            check(element.get_by_role('button',name='미리보기',exact=True).count()==0 and element.get_by_text('미리보기 미지원 · 다운로드',exact=True).count()==1,label+': unsupported format offers download without a viewer')
            with page.expect_download() as selected_download:
                element.get_by_role('link',name=file['name'],exact=True).click()
            downloaded=selected_download.value
            check(hashlib.sha256(Path(downloaded.path()).read_bytes()).hexdigest()==file['sha256'],label+': unsupported file downloads through actual browser click')
            download(context,file,label+' ZIP')
            screenshot(page,label+'-unsupported')
            page.goto(root+'/tasks?projectId=1001&taskId=2001&submissionId=3003',wait_until='networkidle')
            file=files['image'];element=row(page,file)
            region,response=open_preview(page,element,file_url(file))
            image=region.get_by_role('img',name=file['name'],exact=True)
            expect(image).to_be_visible()
            image.evaluate('(e)=>e.decode()')
            check(image.evaluate('(e)=>e.complete&&e.naturalWidth===2&&e.naturalHeight===2'),label+': validated raster image decodes in browser')
            safe_headers(response,label+' image')
            created=page.evaluate('globalThis.__qaPreviewUrls.created.length')
            check(created>0,label+': image uses protected fetched blob')
            screenshot(page,label+'-image')
            close_preview(element)
            check(page.evaluate('globalThis.__qaPreviewUrls.revoked.length')>=created,label+': closing revokes image object URL')
            for kind in ['jpeg','gif','webp','avif']:
                file=files['image-'+kind];element=row(page,file)
                region,response=open_preview(page,element,file_url(file))
                image=region.get_by_role('img',name=file['name'],exact=True)
                expect(image).to_be_visible();image.evaluate('(e)=>e.decode()')
                check(image.evaluate('(e)=>e.complete&&e.naturalWidth===2&&e.naturalHeight===2'),label+' '+kind+': actual supported image decodes')
                safe_headers(response,label+' '+kind)
                download(context,file,label+' '+kind)
                created=page.evaluate('globalThis.__qaPreviewUrls.created.length')
                if kind=='avif':screenshot(page,label+'-raster-formats')
                close_preview(element)
                check(page.evaluate('globalThis.__qaPreviewUrls.revoked.length')>=created,label+' '+kind+': object URL revoked after close')
            file=files['broken-image'];element=row(page,file)
            region,response=open_preview(page,element,file_url(file))
            expect(region.get_by_role('alert')).to_contain_text('이미지를 표시할 수 없습니다.')
            check(region.locator('img').count()==0,label+': decoder failure recovers with download advice')
            close_preview(element)
            for kind in ['oversized-image','image-mime-mismatch']:
                file=files[kind];element=row(page,file)
                region,response=open_preview(page,element,file_url(file),expected_failures[file['id']])
                expect(region.get_by_role('alert')).to_be_visible()
                check(region.locator('img').count()==0,label+' '+kind+': invalid image never becomes a blob viewer')
                close_preview(element)
            file=files['pdf'];element=row(page,file)
            check(element.get_by_role('button',name='미리보기',exact=True).count()==0,label+': PDF remains explicit download only')
            download(context,file,label+' PDF')
            file=files['plain-octet'];element,region,data=text_preview(page,file,label+' octet text','OCTET_UTF8_한글');close_preview(element)
            check(not page.evaluate('Boolean(globalThis.__PREVIEW_EXECUTED__)'),label+': no source execution marker set')
            widths.append(width)
            page.close()

        # Current-parent AND immutable snapshot scope, with current DB roles on every read.
        author=context_for(2)
        peer=context_for(3)
        outsider=context_for(4)
        guest=context_for(5)
        assigned=context_for(6)
        unassigned=context_for(7)
        anonymous=context_for(None)
        su=context_for(1)
        paths={'public':preview_url(file_url(files['utf8'])),'private':preview_url(file_url(files['private'])),'old-private':preview_url(file_url(files['old-private'])),'current-public':preview_url(file_url(files['current-public'])),'other-project':preview_url(file_url(files['other-project'])),'legacy-current':'/api/submissions/3051/attachment?preview=1','legacy-old':'/api/submissions/3051/attachment?revision=1&preview=1'}
        for key in ['public','private','old-private','current-public','legacy-current','legacy-old']:
            api_status(author,paths[key],200,'author reads '+key)
            api_status(su,paths[key],200,'environment SU without membership reads '+key)
        su_task=selected_page(su,3021)
        check(su_task.get_by_test_id('submission-detail-3021').count()==1,'environment SU with guest DB/token reads unbound private task detail')
        detail=su_task.get_by_test_id('task-detail-2001')
        detail.get_by_role('button',name='수정',exact=True).first.click()
        edit=detail.locator('form:has([name="title"]):has(input[name="taskId"])')
        for field in ['assigneeId','reviewerId']:
            edit.locator(f'[name="{field}"]').locator('..').get_by_role('combobox').click()
            check(su_task.locator('[role="option"][data-value="1"]').count()==0,'environment SU excluded from new '+field+' candidates')
            su_task.keyboard.press('Escape')
        edit.get_by_role('button',name='취소',exact=True).click()
        su_task.goto(root+'/tasks?projectId=1001&taskId=2003',wait_until='networkidle')
        legacy_task=su_task.get_by_test_id('task-detail-2003')
        legacy_task.get_by_role('button',name='수정',exact=True).first.click()
        legacy_edit=legacy_task.locator('form:has([name="title"]):has(input[name="taskId"])')
        check(legacy_edit.locator('[name="assigneeId"]').input_value()=='1','legacy SU assignment remains current form value')
        legacy_edit.locator('[name="assigneeId"]').locator('..').get_by_role('combobox').click()
        retained=su_task.locator('[role="option"][data-value="1"]')
        check(retained.get_attribute('aria-disabled')=='true' and '기존 배정 유지' in retained.inner_text(),'legacy SU assignment is display-only retained option')
        su_task.keyboard.press('Escape')
        legacy_edit.get_by_role('button',name='취소',exact=True).click()
        su_task.close()
        for key in ['public','current-public','legacy-current']:api_status(peer,paths[key],200,'peer reads '+key)
        for key in ['private','old-private','legacy-old']:api_status(peer,paths[key],404,'peer denied '+key)
        api_status(author,paths['other-project'],404,'author denied other project')
        api_status(outsider,paths['public'],404,'other project member denied A')
        api_status(guest,paths['public'],200,'guest reads visible public preview')
        api_status(guest,paths['private'],404,'guest cannot read private preview')
        api_status(assigned,paths['private'],200,'assigned admin reads own-project private preview')
        api_status(unassigned,paths['private'],404,'unassigned admin gains no private bypass')
        api_status(anonymous,paths['public'],401,'anonymous preview requires login')
        api_status(author,'/api/submission-attachments/999999?preview=1',404,'missing preview has same denial')
        api_status(author,'/api/submissions/3051/attachment?revision=0&preview=1',400,'invalid immutable revision rejected')
        for kind in ['unsupported','pdf']:
            api_status(author,preview_url(file_url(files[kind])),415,'direct unsupported preview '+kind)

        # A real history UI changes keyed legacy files without retaining old preview content.
        history=page_for(author,'/submissions/3051')
        legacy_current=history.get_by_test_id('attachment-file').filter(has=history.locator('a[href="/api/submissions/3051/attachment?revision=2"]'))
        region,response=open_preview(history,legacy_current,'/api/submissions/3051/attachment?revision=2')
        check(response.json()['text']=='LEGACY_CURRENT_UTF8_한글','history current legacy preview is literal UTF-8')
        version_link=history.locator('a[href*="revision=1"]').first
        version_link.click();history.wait_for_url(lambda url:parse_qs(urlparse(url).query).get('revision')==['1'],wait_until='networkidle')
        check(history.get_by_role('region',name='파일 미리보기: legacy-v2.txt',exact=True).count()==0 and 'LEGACY_CURRENT_UTF8_한글' not in history.content(),'history version switch drops previous file text')
        legacy_old=history.get_by_test_id('attachment-file').filter(has=history.locator('a[href="/api/submissions/3051/attachment?revision=1"]'))
        region,response=open_preview(history,legacy_old,'/api/submissions/3051/attachment?revision=1')
        check(response.json()['text']=='LEGACY_PRIVATE_SNAPSHOT','history authorized old private legacy preview')
        screenshot(history,'history-legacy')
        history.close()

        # Keep an already rendered page, revoke only synthetic membership via real SU form,
        # then close/reopen so an old text cache cannot bypass the next server authorization.
        stale=selected_page(author,3021)
        element=row(stale,files['private']);region,response=open_preview(stale,element,file_url(files['private']))
        close_preview(element)
        admin=page_for(su,'/admin/projects')
        card=admin.get_by_test_id('project-card-1001')
        participant=card.locator('form:has(input[name="workspaceKind"][value="project_member"])').filter(has=admin.get_by_role('button',name='참여자 추가',exact=True))
        participant.locator('[name="userId"]').locator('..').get_by_role('combobox').click()
        check(admin.locator('[role="option"][data-value="1"]').count()==0,'environment SU excluded from project membership candidates')
        admin.keyboard.press('Escape')
        removal=card.locator('form:has(input[name="workspaceKind"][value="project_member"]):has(input[name="userId"][value="2"]):has(input[name="active"][value="0"])')
        with admin.expect_response(lambda response:response.request.method=='POST') as pending:removal.get_by_role('button',name='프로젝트 참여 종료',exact=True).click()
        check(pending.value.status in [200,303],'synthetic SU membership removal uses hydrated action')
        admin.wait_for_url(lambda url:parse_qs(urlparse(url).query).get('status')==['success'],wait_until='networkidle')
        region,response=open_preview(stale,element,file_url(files['private']),404)
        expect(region.get_by_role('alert')).to_contain_text('현재 접근 권한')
        check(region.locator('pre,img').count()==0,'stale page cannot reopen cached private bytes after membership removal')
        close_preview(element)
        for key in ['public','private','old-private','legacy-current','legacy-old']:api_status(author,paths[key],404,'removed author next request denied '+key)
        for path in [file_url(files['utf8']),file_url(files['private']),'/api/submissions/3051/attachment?revision=1']:
            api_status(author,path,404,'removed author original download also denied')
        api_status(outsider,paths['other-project'],200,'independent B membership remains active')
        screenshot(stale,'membership-revoked')
        check(not external,'all preview bytes and executable content stayed on loopback')
        check(not errors,'no uncaught browser page errors')
        expected_by_path={f'/api/submission-attachments/{key}':value for key,value in expected_failures.items()}
        expected_by_path[file_url(files['private'])]=404
        for message in console:
            url=message.get('location',{}).get('url','');path=urlparse(url).path
            allowed=expected_by_path.get(path)
            message['expectedDenial']=message['type']=='error' and allowed is not None and 'Failed to load resource:' in message['text'] and any(item['url']==url and item['status']==allowed and item['method']=='GET' for item in responses)
        check(not [message for message in console if not message.get('expectedDenial')],'no unexpected console warnings or errors')
        check(not [request for request in failed if request['failure']!='net::ERR_ABORTED'],'no failed requests except navigation cancellation')
        (output/'result.json').write_text(json.dumps({'complete':True,'checks':checks,'widths':widths,'runtime':settings['runtime']},indent=2))
    except Exception:
        for index,page in enumerate([page for context in contexts for page in context.pages]):
            try:page.screenshot(path=str(output/f'failure-{index}.png'),full_page=True)
            except Exception:pass
        raise
    finally:
        for name,value in [('console.json',console),('errors.json',errors),('failed-requests.json',failed),('http-errors.json',responses),('external-requests.json',external)]:
            (output/name).write_text(json.dumps(value,ensure_ascii=False,indent=2))
        for context in contexts:context.close()
        browser.close()

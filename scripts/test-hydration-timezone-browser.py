"""RED/GREEN timezone hydration proof against immutable loopback production bundles."""
import hashlib,json,os,re,sys,time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs,urlparse
from playwright.sync_api import expect,sync_playwright
from sites_test_network import validate_origin

settings=json.load(sys.stdin);root=validate_origin(settings['url'],local_only=True)
out=Path(settings['output']).resolve();assert out.is_relative_to(Path('.test-artifacts/hydration-timezone').resolve());out.mkdir(parents=True,exist_ok=True)
mode=settings['expectation'];assert mode in ['red','green']
checks=0;console=[];errors=[];failed=[];external=[];cases=[];auth_requests=[]
file=next(file for file in settings['files'] if file['kind']=='utf8')
large_size=next(file['size'] for file in settings['files'] if file['kind']=='large')
comma_bytes=f'{large_size:,} bytes';german_bytes=comma_bytes.replace(',','.')

def check(value,label):
 global checks
 assert value,label
 checks+=1;print(('OBSERVED ' if mode=='red' else 'PASS ')+label,flush=True)

def norm(text):return ' '.join(text.split())

class SsrParser(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.header=[];self.captions=[];self.visible=[]
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  target=any(a.get('data-testid') in ['submission-summary-3001','submission-detail-3001'] for _,a in self.stack) or attrs.get('data-testid') in ['submission-summary-3001','submission-detail-3001']
  if target and 'MuiTypography-caption' in attrs.get('class','').split():attrs['_caption']=len(self.captions);self.captions.append([])
  if tag not in ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']:self.stack.append((tag,attrs))
 def handle_endtag(self,tag):
  for index in range(len(self.stack)-1,-1,-1):
   if self.stack[index][0]==tag:self.stack=self.stack[:index];break
 def handle_data(self,data):
  if any(tag in ['script','style'] for tag,_ in self.stack):return
  self.visible.append(data)
  if any(tag=='header' for tag,_ in self.stack):self.header.append(data)
  for _,attrs in reversed(self.stack):
   if '_caption' in attrs:self.captions[attrs['_caption']].append(data);break
 def info(self):
  header=norm(' '.join(self.header));return {'date':norm(''.join(self.captions[0])) if self.captions else None,'headerGoogle':'Google 로그인' in header,'headerLogout':'로그아웃' in header,'commaBytes':comma_bytes in norm(' '.join(self.visible))}

def ssr(context,path):
 response=context.request.get(root+path);assert response.status==200,'SSR request failed'
 parser=SsrParser();parser.feed(response.text());return {**parser.info(),'cacheControl':response.headers.get('cache-control'),'vary':response.headers.get('vary')}

def caption(page):return norm(page.get_by_test_id('submission-detail-3001').locator('.MuiTypography-caption').first.inner_text())

def header(page):
 text=page.locator('header').text_content() or '';return {'headerGoogle':'Google 로그인' in text,'headerLogout':'로그아웃' in text}

with sync_playwright() as p:
 profile=out/'chrome-config';profile.mkdir(exist_ok=True)
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,chromium_sandbox=True,env={**os.environ,'XDG_CONFIG_HOME':str(profile)})
 contexts=[]
 def context(actor,zone='UTC',locale='en-US',width=1280,block_api=False):
  result=browser.new_context(timezone_id=zone,locale=locale,viewport={'width':width,'height':950},has_touch=width==390,accept_downloads=True);contexts.append(result)
  if actor is not None:result.add_cookies([{'name':'next-auth.session-token','value':settings['tokens'][str(actor)],'url':root,'httpOnly':True,'sameSite':'Lax'}])
  def route(request):
   url=request.request.url
   if not url.startswith(root+'/'):external.append(urlparse(url).scheme+'://'+urlparse(url).netloc);request.abort();return
   if urlparse(url).path=='/api/auth/session':
    auth_requests.append({'zone':zone,'locale':locale,'actor':actor,'mode':mode,'blocked':block_api})
    if block_api:request.fulfill(status=503,content_type='application/json',body='{"message":"synthetic unavailable initial session refresh"}')
    else:
     response=request.fetch();time.sleep(0.7);request.fulfill(response=response)
    return
   if settings['runtime']=='worker':
    target=(Path('dist/client').resolve()/urlparse(url).path.lstrip('/')).resolve();assets=Path('dist/client').resolve()
    if target.is_relative_to(assets) and target.is_file():request.fulfill(path=str(target));return
   request.continue_()
  result.route('**/*',route)
  result.add_init_script("""(() => {globalThis.__qaAuthTimeline=[];const sample=()=>{const h=document.querySelector('header');if(!h)return;const t=h.textContent||'',v={google:t.includes('Google 로그인'),logout:t.includes('로그아웃')},last=globalThis.__qaAuthTimeline.at(-1);if(!last||last.google!==v.google||last.logout!==v.logout)globalThis.__qaAuthTimeline.push(v);};new MutationObserver(sample).observe(document,{childList:true,subtree:true,characterData:true});document.addEventListener('DOMContentLoaded',sample);})();""")
  return result
 def page_for(ctx,label):
  page=ctx.new_page();page.on('console',lambda message:console.append({'case':label,'type':message.type,'text':message.text[:3000],'location':message.location}) if message.type in ['warning','error'] else None)
  page.on('pageerror',lambda error:errors.append({'case':label,'text':str(error)[:3000]}))
  page.on('requestfailed',lambda request:failed.append({'case':label,'path':urlparse(request.url).path,'failure':request.failure}))
  return page
 try:
  configurations=[('UTC','en-US',1280,1),('Asia/Seoul','ko-KR',1280,1),('America/New_York','de-DE',1280,2),('Asia/Seoul','ko-KR',390,2)]
  for zone,locale,width,actor in configurations:
   label=zone.replace('/','-')+'-'+str(width)+'-'+locale;ctx=context(actor,zone,locale,width);path='/tasks?projectId=1001&taskId=2001&submissionId=3001'
   initial=ssr(ctx,path);page=page_for(ctx,label)
   response=page.goto(root+path,wait_until='networkidle');assert response.status==200
   expect(page.get_by_test_id('submission-detail-3001')).to_be_visible()
   hydrated=caption(page);state=header(page);timeline=page.evaluate('globalThis.__qaAuthTimeline')
   check(state['headerLogout'] and not state['headerGoogle'],label+': authenticated hydrated header')
   swap=initial['date']!=hydrated;flash=initial['headerGoogle'] and state['headerLogout']
   record={'zone':zone,'locale':locale,'width':width,'actor':actor,'ssr':initial,'hydratedDate':hydrated,'hydratedHeader':state,'initialAuthTimeline':timeline,'dateChanged':swap,'authFlash':flash}
   if mode=='green':
    check(not swap and 'KST' in hydrated and ('21:12' in hydrated or '09:12' in hydrated),label+': SSR and hydrated timestamp share explicit KST')
    check(initial['headerLogout'] and not initial['headerGoogle'] and not any(s['google'] for s in timeline),label+': signed auth stable before and during hydration with delayed session response')
    size=page.get_by_test_id('attachment-file').filter(has=page.locator('a[href="/api/submission-attachments/4005"]')).inner_text()
    check(comma_bytes in norm(size) and initial['commaBytes'],label+': explicit Korean number locale matches SSR')
   else:
    check(initial['date'] is not None,label+': initial SSR date captured')
    check(flash,label+': v17 SSR signed header login flash reproduced')
    if zone!='UTC':check(swap,label+': v17 timestamp changes with browser timezone')
    if locale=='de-DE':
     size=page.get_by_test_id('attachment-file').filter(has=page.locator('a[href="/api/submission-attachments/4005"]')).inner_text();record['germanBytes']=german_bytes in norm(size)
   page.screenshot(path=str(out/(label+'-selected.png')),full_page=True)
   # Actual detail -> task -> selected submission -> immutable history -> back.
   page.get_by_role('link',name='업무 상세로 돌아가기',exact=True).click();page.wait_for_url(lambda u:parse_qs(urlparse(u).query).get('submissionId') is None,wait_until='networkidle')
   page.get_by_test_id('submission-summary-3001').get_by_role('link',name='제출 상세·댓글',exact=True).click();page.wait_for_url(lambda u:parse_qs(urlparse(u).query).get('submissionId')==['3001'],wait_until='networkidle')
   check(caption(page)==hydrated,label+': task and submission navigation preserve formatted date')
   selected=page.get_by_test_id('submission-detail-3001');selected.get_by_role('link',name='버전·검토 이력',exact=True).click();page.wait_for_url(lambda u:urlparse(u).path=='/submissions/3001',wait_until='networkidle')
   check(header(page)['headerLogout'],label+': history preserves authenticated header')
   page.get_by_role('link',name='제출 상세로 돌아가기',exact=True).click();page.wait_for_url(lambda u:parse_qs(urlparse(u).query).get('submissionId')==['3001'],wait_until='networkidle')
   check(caption(page)==hydrated,label+': history back preserves date')
   if zone=='Asia/Seoul' and width==1280:
    row=page.get_by_test_id('attachment-file').filter(has=page.locator('a[href="/api/submission-attachments/4001"]'))
    with page.expect_response(lambda r:r.url==root+'/api/submission-attachments/4001?preview=1') as pending:row.get_by_role('button',name='미리보기',exact=True).click()
    check(pending.value.status==200 and pending.value.json().get('text')==settings['text'],label+': protected UTF-8 preview regression')
    row.get_by_role('button',name='미리보기 닫기',exact=True).click()
    with page.expect_download() as downloaded:row.get_by_role('link',name=file['name'],exact=True).click()
    check(hashlib.sha256(Path(downloaded.value.path()).read_bytes()).hexdigest()==file['sha256'],label+': actual original download regression')
   page.goto(root+'/search?q=2001&kind=task&projectId=1001',wait_until='networkidle');page.get_by_role('link',name='업무 카드 열기',exact=True).first.click();page.wait_for_url(lambda u:parse_qs(urlparse(u).query).get('taskId')==['2001'],wait_until='networkidle')
   check(page.get_by_test_id('task-detail-2001').count()==1,label+': search result navigates to task')
   check(page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),label+': no horizontal overflow')
   record['finalAuthTimeline']=page.evaluate('globalThis.__qaAuthTimeline');cases.append(record);page.close()
  # Same URL cross requests must not borrow another session's rendered header.
  signed=context(1);anonymous=context(None)
  split=[ssr(signed,'/privacy'),ssr(anonymous,'/privacy'),ssr(signed,'/privacy')]
  if mode=='green':check(split[0]['headerLogout'] and split[2]['headerLogout'] and not split[0]['headerGoogle'] and not split[2]['headerGoogle'] and split[1]['headerGoogle'] and not split[1]['headerLogout'],'same URL signed/anonymous/signed SSR headers stay isolated')
  anonpage=page_for(anonymous,'anonymous');anonpage.goto(root+'/privacy',wait_until='networkidle');anon=header(anonpage)
  check(anon['headerGoogle'] and not anon['headerLogout'],'anonymous hydrated header remains anonymous')
  protected_path='/tasks?projectId=1001&taskId=2001&submissionId=3001'
  protected_statuses=[signed.request.get(root+protected_path,max_redirects=0).status,anonymous.request.get(root+protected_path,max_redirects=0).status,signed.request.get(root+protected_path,max_redirects=0).status]
  check(protected_statuses[0]==200 and protected_statuses[1] in [302,303,307,308] and protected_statuses[2]==200,'same protected URL signed/anonymous/signed remains isolated')
  if mode=='green':
   blocked=context(1,'Asia/Seoul','ko-KR',1280,block_api=True)
   blocked_ssr=ssr(blocked,'/privacy');blocked_page=page_for(blocked,'blocked-initial-refresh')
   blocked_page.goto(root+'/privacy',wait_until='networkidle')
   check(blocked_ssr['headerLogout'] and header(blocked_page)['headerLogout'] and not any(s['google'] for s in blocked_page.evaluate('globalThis.__qaAuthTimeline')),'signed first UI remains authenticated when initial session refresh endpoint is unavailable')
   check(not [r for r in auth_requests if r['blocked']],'initial SSR session needs no client refresh request')
  hydration=[item for item in console+errors if re.search(r'(?:#418|errors/418|hydration|hydrating)',item['text'],re.I)]
  other=[item for item in console+errors if item not in hydration]
  if mode=='red':check(bool(hydration),'v17 production React hydration failure reproduced (not suppressed)')
  else:check(not hydration and not other,'no hydration or other console/page failures')
  check(not other,'no unrelated console or page failures')
  check(not external,'external requests blocked and never attempted')
  check(not [item for item in failed if item['failure']!='net::ERR_ABORTED'],'no unexpected network failures')
  (out/'result.json').write_text(json.dumps({'complete':True,'expectation':mode,'checks':checks,'timezones':['UTC','Asia/Seoul','America/New_York'],'cases':cases,'authIsolationSsr':split,'authRequests':auth_requests,'protectedStatusIsolation':protected_statuses,'hydrationErrors':len(hydration),'otherErrors':len(other)},ensure_ascii=False,indent=2))
 finally:
  (out/'observations.json').write_text(json.dumps({'cases':cases,'authRequests':auth_requests},ensure_ascii=False,indent=2))
  for name,value in [('console.json',console),('errors.json',errors),('failed-requests.json',failed),('external-requests.json',external)]: (out/name).write_text(json.dumps(value,ensure_ascii=False,indent=2))
  for ctx in contexts:ctx.close()
  browser.close()

"""QLT-022 actual hydrated browser files; synthetic credentials never leave loopback."""
import json,os,sys
from pathlib import Path
from urllib.parse import unquote,urlparse
from playwright.sync_api import sync_playwright
from sites_test_network import validate_origin
settings=json.load(sys.stdin)
root=validate_origin(settings['url'],local_only=True)
assets=Path('dist/client').resolve()
output=Path('.test-artifacts/submission-upload');output.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 config=(output/'chrome-config').resolve();config.mkdir(exist_ok=True)
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,chromium_sandbox=True,env={**os.environ,'XDG_CONFIG_HOME':str(config)})
 for task,width in [(1,1280),(2,390)]:
  context=browser.new_context(viewport={'width':width,'height':1000})
  context.add_cookies([{'name':'next-auth.session-token','value':settings['token'],'url':root,'httpOnly':True,'sameSite':'Lax'}])
  failure={'mode':None}
  def route(r):
   if not r.request.url.startswith(root+'/'):r.abort();return
   target=(assets/unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
   if target.is_relative_to(assets) and target.is_file():r.fulfill(path=str(target));return
   if r.request.method=='POST' and failure['mode']:
    mode=failure['mode'];failure['mode']=None
    if mode=='network':r.abort('connectionfailed')
    else:r.fulfill(status=503,body='Synthetic upload unavailable')
    return
   r.continue_()
  context.route('**/*',route)
  page=context.new_page();errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.on('requestfailed',lambda req:print('BROWSER_REQUEST_FAILED '+json.dumps({'method':req.method,'path':urlparse(req.url).path,'failure':req.failure}),flush=True))
  page.goto(root+f'/tasks?projectId=1&taskId={task}',wait_until='networkidle')
  card=page.locator(f'#task-{task}')
  form=card.locator('form').filter(has=page.get_by_role('button',name='제출 등록',exact=True))
  form.locator('[name="content"]').wait_for(timeout=10000)
  form.locator('[name="content"]').fill(f'Synthetic file submission {width}')
  form.locator('[name="attachments"]').set_input_files({'name':'qa.txt','mimeType':'text/plain','buffer':b'SYNTHETIC QLT022 FILE'})
  form.get_by_role('button',name='제출 등록',exact=True).click()
  page.get_by_text('제출물을 등록했습니다.',exact=True).wait_for(timeout=20000)
  print(f'PASS {width}: actual hydrated create with TXT',flush=True)
  page.reload(wait_until='networkidle')
  card=page.locator(f'#task-{task}')
  link=card.locator('a[href^="/api/submission-attachments/"]').first
  response=context.request.get(root+link.get_attribute('href'))
  assert response.status==200 and response.body()==b'SYNTHETIC QLT022 FILE'
  print(f'PASS {width}: reload and exact private TXT download',flush=True)
  card.get_by_role('button',name='수정',exact=True).last.click()
  edit=card.locator('form').filter(has=page.locator('[name="expectedRevision"]'))
  edit.locator('[name="changeSummary"]').fill('Synthetic v2 with second file')
  edit.locator('[name="content"]').fill(f'Synthetic edited file submission {width}')
  edit.locator('[name="attachments"]').set_input_files({'name':'second.txt','mimeType':'text/plain','buffer':b'SYNTHETIC QLT022 SECOND FILE'})
  edit.get_by_role('button',name='저장',exact=True).click()
  page.get_by_text('새 제출 버전을 저장했습니다. 이전 버전은 보존됩니다.',exact=True).wait_for(timeout=20000)
  page.reload(wait_until='networkidle')
  card=page.locator(f'#task-{task}')
  assert card.get_by_text('버전 2',exact=True).count()==1
  downloads=card.locator('a[href^="/api/submission-attachments/"]').all()
  downloaded=[context.request.get(root+l.get_attribute('href')).body() for l in downloads]
  assert b'SYNTHETIC QLT022 FILE' in downloaded and b'SYNTHETIC QLT022 SECOND FILE' in downloaded
  print(f'PASS {width}: hydrated update, v2 reload and both exact downloads',flush=True)
  page.screenshot(path=str(output/f'updated-{width}.png'),full_page=True)
  # Match the observed fetch rejection, without changing any real Site or data.
  create=card.locator('form').filter(has=page.get_by_role('button',name='제출 등록',exact=True))
  create.locator('[name="content"]').fill(f'Synthetic retry draft {width}')
  create.locator('[name="attachments"]').set_input_files({'name':'retry.txt','mimeType':'text/plain','buffer':b'SYNTHETIC QLT022 RETRY'})
  failure['mode']='network';create.get_by_role('button',name='제출 등록',exact=True).click()
  page.get_by_role('alert').filter(has_text='입력과 첨부를 유지').wait_for(timeout=10000)
  assert create.locator('[name="content"]').input_value()==f'Synthetic retry draft {width}'
  assert create.locator('[name="attachments"]').evaluate('(e)=>e.files[0].name')=='retry.txt'
  print(f'PASS {width}: fetch rejection keeps the file draft on the page',flush=True)
  create.get_by_role('button',name='제출 등록',exact=True).click()
  page.get_by_text('제출물을 등록했습니다.',exact=True).wait_for(timeout=20000)
  page.reload(wait_until='networkidle')
  card=page.locator(f'#task-{task}')
  assert card.get_by_text(f'Synthetic retry draft {width}',exact=True).count()==1
  print(f'PASS {width}: explicit retry persists one submission',flush=True)
  original=card.get_by_text(f'Synthetic edited file submission {width}',exact=True).locator('xpath=ancestor::*[contains(@class,"MuiPaper-root")][1]')
  original.get_by_role('button',name='수정',exact=True).click()
  edit=card.locator('form').filter(has=page.locator('[name="expectedRevision"]'))
  edit.locator('[name="changeSummary"]').fill('Synthetic retry edit')
  edit.locator('[name="content"]').fill(f'Synthetic final edit {width}')
  edit.locator('[name="attachments"]').set_input_files({'name':'third.txt','mimeType':'text/plain','buffer':b'SYNTHETIC QLT022 THIRD FILE'})
  failure['mode']='network';edit.get_by_role('button',name='저장',exact=True).click()
  page.get_by_role('alert').filter(has_text='입력과 첨부를 유지').wait_for(timeout=10000)
  assert edit.locator('[name="content"]').input_value()==f'Synthetic final edit {width}'
  assert edit.locator('[name="attachments"]').evaluate('(e)=>e.files[0].name')=='third.txt'
  assert card.get_by_text('버전 2',exact=True).count()==1
  print(f'PASS {width}: failed edit keeps existing v2 and its file draft',flush=True)
  edit.get_by_role('button',name='저장',exact=True).click()
  page.get_by_text('새 제출 버전을 저장했습니다. 이전 버전은 보존됩니다.',exact=True).wait_for(timeout=20000)
  page.reload(wait_until='networkidle')
  assert page.locator(f'#task-{task}').get_by_text('버전 3',exact=True).count()==1
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  print(f'PASS {width}: explicit edit retry reaches v3, no overflow',flush=True)
  create=page.locator(f'#task-{task} form').filter(has=page.get_by_role('button',name='제출 등록',exact=True))
  create.locator('[name="content"]').fill('Synthetic HTTP failure draft')
  create.locator('[name="attachments"]').set_input_files({'name':'http-failure.txt','mimeType':'text/plain','buffer':b'SYNTHETIC HTTP FAILURE'})
  failure['mode']='server';create.get_by_role('button',name='제출 등록',exact=True).click()
  page.get_by_role('alert').filter(has_text='입력과 첨부를 유지').wait_for(timeout=10000)
  assert create.locator('[name="content"]').input_value()=='Synthetic HTTP failure draft'
  assert create.locator('[name="attachments"]').evaluate('(e)=>e.files[0].name')=='http-failure.txt'
  assert not errors,errors
  print(f'PASS {width}: HTTP503 preserves draft, no uncaught page errors',flush=True)
  page.screenshot(path=str(output/f'retry-{width}.png'),full_page=True)

  context.close()
 browser.close()

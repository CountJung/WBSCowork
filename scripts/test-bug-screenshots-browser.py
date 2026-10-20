"""Screenshot feature on the local Worker only, including desktop/mobile and failure recovery."""
import io,json,os,sys
from PIL import Image,ImageDraw
from pathlib import Path
from urllib.parse import unquote,urlparse
from playwright.sync_api import sync_playwright
from sites_test_network import validate_origin
settings=json.load(sys.stdin)
root=validate_origin(settings['url'],local_only=True)
assets=Path('dist/client').resolve()
output=Path('.test-artifacts/bug-screenshots');output.mkdir(parents=True,exist_ok=True)
fixture=Image.new('RGB',(480,240),'#eef5f2')
draw=ImageDraw.Draw(fixture);draw.rectangle((16,16,464,64),fill='#146557');draw.text((30,32),'SYNTHETIC BUG SCREENSHOT',fill='white');draw.rectangle((28,94,450,208),outline='#bb3737',width=3);draw.text((42,120),'Test data only - unexpected UI state',fill='#173b31')
png_file=io.BytesIO();fixture.save(png_file,format='PNG');png=png_file.getvalue()
checks=0
errors=[]
def check(ok,message):
 global checks
 assert ok,message
 checks+=1;print('PASS '+message,flush=True)
with sync_playwright() as p:
 config=(output/'chrome-config').resolve();config.mkdir(exist_ok=True)
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,chromium_sandbox=True,env={**os.environ,'XDG_CONFIG_HOME':str(config)})
 for width in [1280,390]:
  context=browser.new_context(viewport={'width':width,'height':844},color_scheme='light')
  context.add_cookies([{'name':'next-auth.session-token','value':settings['token'],'url':root,'httpOnly':True,'sameSite':'Lax'}])
  fail={'mode':None}
  def route(r):
   url=r.request.url
   if not url.startswith(root+'/'):r.abort();return
   target=(assets/unquote(urlparse(url).path).lstrip('/')).resolve()
   if target.is_relative_to(assets) and target.is_file():r.fulfill(path=str(target));return
   if r.request.method=='POST' and fail['mode']:
    mode=fail['mode'];fail['mode']=None
    if mode=='network':r.abort('connectionfailed')
    else:r.fulfill(status=503,body='Synthetic upload unavailable')
    return
   r.continue_()
  context.route('**/*',route)
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  response=page.goto(root+'/bugs',wait_until='networkidle');print(f'BROWSER {width} GET /bugs {response.status}',flush=True)
  (output/f'form-{width}.html').write_text(page.content())
  page.get_by_role('button',name='버그 제보 저장',exact=True).wait_for()
  title=f'Synthetic browser screenshot {width}'
  for name,value in [('title',title),('reproduction','Synthetic steps'),('expected','Expected result'),('actual','Actual result')]:page.locator(f'[name="{name}"]').fill(value)
  upload=page.get_by_label('스크린샷 선택',exact=True)
  upload.set_input_files({'name':'invalid.svg','mimeType':'image/svg+xml','buffer':b'<svg/>'})
  check(page.get_by_role('alert').filter(has_text='PNG, JPEG, WebP').count()==1,f'{width}: invalid file feedback')
  upload.set_input_files([{'name':'remove.png','mimeType':'image/png','buffer':png},{'name':'keep.png','mimeType':'image/png','buffer':png}])
  page.get_by_alt_text('첨부 미리보기 1',exact=True).wait_for()
  check(page.locator('img[alt^="첨부 미리보기"]').count()==2,f'{width}: two selected previews')
  page.get_by_role('button',name='remove.png 제거',exact=True).click()
  check(page.locator('img[alt^="첨부 미리보기"]').count()==1,f'{width}: remove before submission')
  upload.set_input_files([{'name':f'extra{i}.png','mimeType':'image/png','buffer':png}for i in range(3)])
  check(page.get_by_role('alert').filter(has_text='최대 3개').count()==1,f'{width}: count limit preserves existing selection')
  fail['mode']='server';page.get_by_role('button',name='버그 제보 저장',exact=True).click()
  page.get_by_role('alert').filter(has_text='업로드 연결이 끊겼습니다').wait_for()
  check(page.locator('[name="title"]').input_value()==title and page.locator('img[alt^="첨부 미리보기"]').count()==1,f'{width}: failed upload retains description and screenshot')
  page.screenshot(path=str(output/f'failure-{width}.png'),full_page=True)
  page.get_by_role('button',name='버그 제보 저장',exact=True).click()
  page.wait_for_url('**/bugs/*?saved=1',timeout=30000);page.wait_for_load_state('networkidle')
  check(page.get_by_role('heading',name='제보 원문',exact=True).count()==1,f'{width}: submitted description reaches detail')
  image=page.get_by_alt_text('keep.png',exact=True);image.wait_for()
  check(image.evaluate('(e)=>e.complete && e.naturalWidth>0'),f'{width}: protected screenshot decodes')
  page.reload(wait_until='networkidle');image=page.get_by_alt_text('keep.png',exact=True)
  check(image.count()==1 and page.get_by_alt_text('remove.png',exact=True).count()==0,f'{width}: refresh retains only submitted screenshot')
  check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'{width}: no horizontal overflow')
  page.screenshot(path=str(output/f'detail-{width}.png'),full_page=True)
  context.close()
 browser.close()
check(not errors,'no unhandled browser errors: '+str(errors))
print(f'Bug screenshot browser checks passed: {checks}. Synthetic loopback data only.')

"""Local cloud Chromium QA with a synthetic session supplied through stdin only."""
import json
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

settings=json.load(sys.stdin)
root=settings['url'].rstrip('/')
errors=[]
with sync_playwright() as p:
    Path('.test-artifacts/chrome-config').mkdir(parents=True,exist_ok=True)
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,chromium_sandbox=True,env={**os.environ,'XDG_CONFIG_HOME':str(Path('.test-artifacts/chrome-config').resolve())})
    for name,width,height in [('desktop',1440,1000),('mobile',390,844)]:
        context=browser.new_context(viewport={'width':width,'height':height})
        def authenticated(route):
            if not route.request.url.startswith(root+'/'):
                route.abort()
                return
            headers=dict(route.request.headers)
            headers['cookie']=settings['cookie']
            route.continue_(headers=headers)
        context.route('**/*',authenticated)
        page=context.new_page()
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(root+'/tasks?projectId=1',wait_until='networkidle',timeout=45000)
        page.get_by_text('PUBLIC_ONLY_83827',exact=True).first.wait_for()
        text=page.locator('body').inner_text()
        assert 'PRIVATE_OWNER1_83827' in text and 'PRIVATE_OWNER2_83827' not in text, 'browser private boundary'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), f'{name} horizontal overflow'
        page.screenshot(path=f'.test-artifacts/worker-{name}.png',full_page=True)
        print(f'PASS Chromium {name}: hydrated workspace, private boundary, no horizontal overflow')
        context.close()
    browser.close()
assert not errors, errors
print('PASS Chromium: no uncaught page errors')

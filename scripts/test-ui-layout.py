"""Geometry/navigation regressions on real hydrated MUI pages; synthetic data only."""
import json
import os
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

settings = json.load(sys.stdin)
root = settings['url'].rstrip('/')
assets = Path('dist/client').resolve()
baseline = '--before' in sys.argv
output = Path('.test-artifacts/layout/before' if baseline else '.test-artifacts/layout/after')
output.mkdir(parents=True, exist_ok=True)
config = (output / 'chrome-config').resolve()
config.mkdir(exist_ok=True)
results, failures, errors = [], [], []

def check(condition, message):
    if not condition:
        failures.append(message)

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
        headless=True, chromium_sandbox=True,
        env={**os.environ, 'XDG_CONFIG_HOME': str(config)},
    )
    for width in ([1699, 1280, 390] if baseline else [1920, 1699, 1440, 1280, 1024, 390]):
        cases = [('superuser', 'empty', '/tasks'), ('superuser', 'tasks', '/tasks?projectId=1'),
                 ('superuser', 'admin', '/admin'), ('superuser', 'bugs', '/bugs'),
                 ('superuser', 'review', '/admin/bugs'), ('long', 'long-name', '/tasks?projectId=1')]
        # Include all role-dependent navigation variants and login state at both transitions.
        if baseline:
            cases = [case for case in cases if case[1] in ['empty', 'long-name']]
        elif width in [1699, 1024, 390]:
            cases += [(actor, f'role-{actor}', '/' if actor == 'anonymous' else '/tasks?projectId=1') for actor in ['guest', 'member', 'admin', 'anonymous']]
        for actor, name, route in cases:
            context = browser.new_context(viewport={'width': width, 'height': 844 if width == 390 else 900})
            if actor != 'anonymous':
                token = settings['cookies'][actor].split(';')[0].split('=', 1)[1]
                context.add_cookies([
                    {'name': 'next-auth.session-token', 'value': token, 'url': root, 'httpOnly': True, 'sameSite': 'Lax'},
                ])

            def authenticated(request_route):
                url = request_route.request.url
                if not url.startswith(root + '/'):
                    request_route.abort()
                    return
                # Miniflare's standalone Worker dispatch does not route static files.
                # Serve the unmodified production bundle, including CSS/fonts, locally.
                asset = (assets / unquote(urlparse(url).path).lstrip('/')).resolve()
                if asset.is_relative_to(assets) and asset.is_file():
                    request_route.fulfill(path=str(asset))
                    return
                if name == 'empty' and url == root + '/tasks' and request_route.request.is_navigation_request():
                    request_route.fulfill(status=200, content_type='text/html', body=settings['emptyHtml'])
                    return
                request_route.continue_()

            context.route('**/*', authenticated)
            page = context.new_page()
            page.on('response', lambda response: print(f'HTTP {response.status} {response.url}', flush=True) if response.status >= 400 else None)
            page.on('requestfailed', lambda request: print(f'REQUEST FAILED {request.url} {request.failure}', flush=True))
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
            page.goto(root + route, wait_until='networkidle', timeout=60000)
            if name == 'empty':
                (output / 'empty.html').write_text(page.content())
            page.get_by_role('banner').wait_for()
            if actor != 'anonymous':
                # Hidden drawer still holds its authenticated button after the session fetch.
                try:
                    page.locator('button').filter(has_text='로그아웃').first.wait_for(state='attached', timeout=15000)
                except Exception:
                    page.screenshot(path=str(output / 'session-failure.png'))
                    print(json.dumps({'errors': errors, 'text': page.locator('body').inner_text()[:1200]}, ensure_ascii=False), flush=True)
                    raise
            if width >= 900:
                page.get_by_role('navigation', name='주 메뉴').wait_for() if not baseline else None
            page.evaluate('document.fonts.ready')
            label = f'{width}/{name}'
            geometry = page.evaluate('''() => {
              const header = document.querySelector('header .MuiContainer-root');
              const main = document.querySelector('main.MuiContainer-root');
              const box = el => { const b=el.getBoundingClientRect(); return {x:b.x,right:b.right,width:b.width,height:b.height}; };
              const visible = el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
              const controls = [...document.querySelectorAll('header a.MuiButton-root,header button.MuiButton-root')].filter(visible).map(el => {
                const range=document.createRange(); range.selectNodeContents(el);
                const lines=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0);
                return {text:el.textContent, ...box(el), lines:new Set(lines.map(r=>Math.round(r.y))).size, clipped:el.scrollWidth>el.clientWidth+1};
              });
              const cards=[...document.querySelectorAll('main .MuiPaper-root')].map(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius));
              const brand=[...header.querySelectorAll('a,p')].filter(el=>el.textContent==='WBSCowork'||el.textContent==='Task 기반 WBS 협업 시스템').filter(visible).map(el=>({text:el.textContent,...box(el),clipped:el.scrollWidth>el.clientWidth+1}));
              const splitWords=[];
              for(const el of document.querySelectorAll('header .MuiTypography-root, main .MuiTypography-root')) {
                if(!visible(el)) continue;
                const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
                while(walker.nextNode()) {
                  for(const match of walker.currentNode.textContent.matchAll(/[가-힣]{2,}/g)) {
                    // Unbroken user-generated names may deliberately use anywhere
                    // wrapping. Ordinary Korean words must stay together.
                    if(match[0].length>15) continue;
                    const range=document.createRange(); range.setStart(walker.currentNode,match.index); range.setEnd(walker.currentNode,match.index+match[0].length);
                    const lines=new Set([...range.getClientRects()].filter(r=>r.width>0).map(r=>Math.round(r.y)));
                    if(lines.size>1) splitWords.push(match[0]);
                  }
                }
              }
              return {scroll:document.documentElement.scrollWidth, viewport:innerWidth, header:{...box(header),padding:parseFloat(getComputedStyle(header).paddingLeft)}, main:main?box(main):null,controls,cards,brand,splitWords};
            }''')
            results.append({'case': label, **geometry})
            check(geometry['scroll'] <= width + 1, f'{label}: horizontal overflow ({geometry["scroll"]})')
            if geometry['main']:
                check(abs(geometry['header']['x'] - geometry['main']['x']) <= 1 and abs(geometry['header']['width'] - geometry['main']['width']) <= 1, f'{label}: header/main width mismatch')
            for control in geometry['controls']:
                check(control['lines'] == 1, f'{label}: wrapped control {control["text"]}')
                check(not control['clipped'] and control['x'] >= 0 and control['right'] <= width + 1, f'{label}: clipped control {control["text"]}')
                check(control['x'] >= geometry['header']['x'] + geometry['header']['padding'] - 1 and control['right'] <= geometry['header']['right'] - geometry['header']['padding'] + 1, f'{label}: control outside header container {control["text"]}')
            for brand in geometry['brand']:
                check(not brand['clipped'], f'{label}: clipped brand {brand["text"]}')
            check(all(radius <= 24 for radius in geometry['cards']), f'{label}: inflated panel radius')
            check(not geometry['splitWords'], f'{label}: Korean words split across lines {geometry["splitWords"]}')
            if width >= 900:
                check(page.get_by_role('link', name='버그 제보', exact=True).first.is_visible(), f'{label}: missing desktop navigation')
                if actor in ['admin', 'superuser', 'long'] and not baseline:
                    page.get_by_role('button', name='관리자', exact=True).first.click()
                    check(page.get_by_role('menuitem', name='버그 리뷰', exact=True).is_visible(), f'{label}: missing admin menu')
                    page.keyboard.press('Escape')
            else:
                page.get_by_role('button', name='메뉴 열기').click()
                drawer = page.locator('.MuiDrawer-paper')
                page.wait_for_function("""() => {
                    const panel=document.querySelector('.MuiDrawer-paper');
                    return panel && Math.abs(panel.getBoundingClientRect().x) < 1;
                }""")
                check(drawer.get_by_role('link', name='버그 제보', exact=True).is_visible(), f'{label}: missing mobile navigation')
                if actor in ['admin', 'superuser', 'long']:
                    check(drawer.get_by_role('link', name='버그 리뷰', exact=True).is_visible(), f'{label}: missing mobile admin navigation')
                check(drawer.evaluate('(el) => el.scrollWidth <= el.clientWidth + 1'), f'{label}: drawer overflow')
                check(drawer.evaluate('(el) => el.getBoundingClientRect().right <= innerWidth'), f'{label}: drawer outside viewport')
                page.screenshot(path=str(output / f'{width}-{name}-drawer.png'), animations='disabled')
                page.keyboard.press('Escape')
                drawer.wait_for(state='hidden')
            if name == 'long-name':
                chip = page.locator('.MuiChip-root[title]').first
                if width >= 1200:
                    check(chip.is_visible() and len(chip.get_attribute('title')) > 80, f'{label}: long-name full title unavailable')
            page.screenshot(path=str(output / f'{width}-{name}.png'), full_page=name in ['empty', 'bugs'])
            print(f'CHECK {label}', flush=True)
            context.close()
    # Explicit dark-mode layout sample using the same fixture and no production preference change.
    context = browser.new_context(viewport={'width': 1699, 'height': 900}, color_scheme='dark')
    token = settings['cookies']['superuser'].split(';')[0].split('=', 1)[1]
    context.add_cookies([{'name': 'next-auth.session-token', 'value': token, 'url': root}])
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    page.goto(root + '/tasks?projectId=1', wait_until='networkidle')
    check(page.evaluate("document.documentElement.getAttribute('data-mui-color-scheme') === 'dark'"), 'dark system preference applied')
    check(page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'dark sample horizontal overflow')
    page.screenshot(path=str(output / '1699-dark.png'))
    page.get_by_role('button', name='Light', exact=True).first.click()
    page.wait_for_function("document.documentElement.getAttribute('data-mui-color-scheme') === 'light'")
    context.close()
    browser.close()

check(not errors, f'uncaught browser errors: {errors}')
(output / 'results.json').write_text(json.dumps({'cases': results, 'failures': failures, 'errors': errors}, ensure_ascii=False, indent=2))
print(json.dumps({'cases': len(results), 'failures': failures, 'errors': errors}, ensure_ascii=False, indent=2))
sys.exit(1 if failures else 0)

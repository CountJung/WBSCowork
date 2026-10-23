"""Hydrated Native home links on synthetic loopback data only."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from sites_test_network import validate_origin

settings = json.load(sys.stdin)
root = validate_origin(settings['url'], local_only=True)
output = Path(settings['output']).resolve()
assert output.is_relative_to(Path('.test-artifacts/native-home').resolve())
checks = []
errors = []
console = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    try:
        for width in [390, 1280]:
            context = browser.new_context(viewport={'width': width, 'height': 900}, timezone_id='Asia/Seoul')
            context.add_cookies([{'name': 'next-auth.session-token', 'value': settings['token'], 'url': root}])
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda message: console.append({'type': message.type, 'text': message.text}) if message.type in ['error', 'warning'] else None)
            response = page.goto(root + '/?projectId=1', wait_until='networkidle')
            assert response.status == 200
            expect(page.get_by_test_id('project-overview')).to_contain_text('HOME_VISIBLE_PROJECT')
            expect(page.get_by_test_id('task-summary-1')).to_contain_text('HOME_VISIBLE_TASK')
            page.screenshot(path=str(output / f'home-{width}.png'), full_page=True)
            page.get_by_role('link', name='HOME_EMPTY_PROJECT', exact=True).click()
            expect(page.get_by_text('아직 업무가 없습니다.', exact=False)).to_be_visible()
            expect(page).to_have_url(root + '/?projectId=3')
            checks.append(f'{width}: project selection reaches the selected empty project')
            page.get_by_role('link', name='HOME_VISIBLE_PROJECT', exact=True).click()
            page.get_by_role('link', name='프로젝트 작업 공간', exact=True).click()
            expect(page).to_have_url(root + '/tasks?projectId=1')
            expect(page.get_by_test_id('task-summary-1')).to_be_visible()
            checks.append(f'{width}: workspace CTA preserves selected project')
            page.goto(root + '/?projectId=1', wait_until='networkidle')
            page.get_by_test_id('task-summary-1').get_by_role('link', name='업무 상세', exact=True).click()
            expect(page.get_by_test_id('task-detail-1')).to_be_visible()
            assert 'taskId=1' in page.url
            checks.append(f'{width}: task summary link opens focused task detail')
            page.go_back(wait_until='networkidle')
            expect(page.get_by_test_id('project-overview')).to_be_visible()
            checks.append(f'{width}: browser back returns to home')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            checks.append(f'{width}: home fits viewport')
            context.close()
    finally:
        browser.close()
assert not errors, errors
assert not console, console
(output / 'browser-result.json').write_text(json.dumps({'checks': len(checks), 'assertions': checks, 'errors': errors, 'console': console}, ensure_ascii=False, indent=2))
print(f'PASS Native home hydrated browser: {len(checks)} conditions; errors0 console0')

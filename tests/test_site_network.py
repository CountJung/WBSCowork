"""Synthetic network contracts; no production requests or network configuration changes."""
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import subprocess
import sys
import threading
import unittest
import urllib.error
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from sites_test_network import (NoRedirect, environment_summary, main, policy_summary,
                                probe_proxy, run, safe_error, smoke_http, validate_origin)


@contextmanager
def proxy_fixture():
    class Handler(BaseHTTPRequestHandler):
        def do_CONNECT(self):
            self.server.targets.append(self.path)
            self.server.target_host = self.headers.get('Host')
            self.server.authorization = self.headers.get('Proxy-Authorization')
            body = b'Domain forbidden'
            self.send_response(403)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Server', 'synthetic-user:synthetic-password')
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    server.targets = []
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


class Response(io.BytesIO):
    def __init__(self, code, body, headers):
        super().__init__(body)
        self.code, self.headers = code, headers


class Opener:
    def __init__(self, bad_route=None, transport_route=None):
        self.requests = []
        self.bad_route, self.transport_route = bad_route, transport_route

    def open(self, request, timeout):
        from urllib.parse import urlsplit
        route = urlsplit(request.full_url).path
        self.requests.append(request)
        if route == self.transport_route:
            raise urllib.error.URLError(OSError('Tunnel connection failed: 403 Forbidden'))
        if route == self.bad_route:
            raise urllib.error.HTTPError(request.full_url, 403, 'Forbidden', {}, io.BytesIO(b'private response must not be logged'))
        if route in ['/tasks', '/admin', '/bugs']:
            raise urllib.error.HTTPError(request.full_url, 307, 'Redirect', {'Location': '/api/auth/signin?callbackUrl=private-value'}, io.BytesIO())
        return Response(200, b'{}' if route == '/api/auth/session' else b'<html><body>Fixture</body></html>',
                        {'Content-Type': 'application/json' if route == '/api/auth/session' else 'text/html'})


class SitesNetworkTests(unittest.TestCase):
    def test_real_loopback_http_contract_and_redirects_without_proxy_changes(self):
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.server.paths.append(self.path)
                if self.path in ['/tasks', '/admin', '/bugs']:
                    self.send_response(307)
                    self.send_header('Location', '/api/auth/signin?callbackUrl=not-followed')
                    self.end_headers()
                    return
                body = b'{}' if self.path == '/api/auth/session' else b'<html><body>synthetic</body></html>'
                self.send_response(200)
                self.send_header('Content-Type', 'application/json' if self.path == '/api/auth/session' else 'text/html')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_args):
                pass

        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        server.paths = []
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            report = run(f'http://127.0.0.1:{server.server_port}', policy_path='/missing')
            self.assertEqual(report['result'], 'passed')
            self.assertEqual(report['mode'], 'loopback_http_fixture')
            self.assertTrue(report['http_checks_completed'])
            self.assertFalse(report['live_http_completed'])
            self.assertEqual(server.paths, ['/', '/privacy', '/api/auth/session', '/tasks', '/admin', '/bugs'])
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_synthetic_session_guard_rejects_all_non_loopback_origins(self):
        for origin in ['https://production.example.test', 'http://127.0.0.1.evil.test', 'http://10.0.0.1',
                       'http://localhost@production.example.test', 'https://example.test/?token=secret']:
            with self.subTest(origin=origin), self.assertRaises(ValueError):
                validate_origin(origin, local_only=True)
        for origin in ['http://127.0.0.1:8412', 'http://[::1]:8412/', 'http://localhost:8412']:
            self.assertTrue(validate_origin(origin, local_only=True))

    def test_live_origin_never_accepts_credentials_or_nonlocal_http(self):
        for origin in ['http://production.example.test', 'https://user:password@example.test',
                       'https://example.test/path', 'https://example.test/#fragment']:
            with self.subTest(origin=origin), self.assertRaises(ValueError):
                validate_origin(origin)

    def test_policy_read_is_target_specific_and_missing_is_unknown(self):
        with patch('sites_test_network.Path.read_text', return_value=json.dumps({
            'http_network_policy': {'type': 'restricted', 'egress_rules': [{'host': 'git.example.test'}]}})):
            self.assertFalse(policy_summary('production.example.test', '/fixture/policy.json')['target_rule_present'])
            self.assertTrue(policy_summary('git.example.test', '/fixture/policy.json')['target_rule_present'])
        with patch('sites_test_network.Path.read_text', side_effect=FileNotFoundError):
            self.assertIsNone(policy_summary('example.test', '/missing')['target_rule_present'])

    def test_actual_connect_denial_is_identified_without_logging_proxy_credentials(self):
        with proxy_fixture() as server:
            proxy = f'http://synthetic-user:synthetic-password@127.0.0.1:{server.server_port}'
            result = probe_proxy('https://production.example.test', proxy)
            self.assertEqual(server.targets, ['production.example.test:443'])
            self.assertEqual(server.target_host, 'production.example.test:443')
            self.assertIsNotNone(server.authorization)
            self.assertEqual(result['stage'], 'proxy_connect')
            self.assertEqual(result['status'], 403)
            self.assertEqual(result['policy_message'], 'Domain forbidden')
            serialized = json.dumps(result)
            self.assertNotIn('synthetic-password', serialized)
            self.assertNotIn('synthetic-user', serialized)
            self.assertNotIn('authorization', serialized.lower())

    def test_environment_output_contains_no_proxy_userinfo(self):
        proxies = {'https': 'http://synthetic-user:synthetic-password@proxy.example.test:8080'}
        with patch('sites_test_network.urllib.request.proxy_bypass', return_value=False):
            result = environment_summary('https://production.example.test', proxies, '/missing')
        self.assertNotIn('synthetic-password', json.dumps(result))
        self.assertNotIn('synthetic-user', json.dumps(result))
        error = safe_error(OSError(proxies['https']), proxies)
        self.assertNotIn('synthetic-password', error)

    def test_proxy_refusal_is_failure_not_skip_and_does_not_attempt_site_http(self):
        with patch('sites_test_network.urllib.request.getproxies', return_value={'https': 'http://proxy:8080'}), \
             patch('sites_test_network.urllib.request.proxy_bypass', return_value=False), \
             patch('sites_test_network.probe_proxy', return_value={'status': 403, 'reason': 'Forbidden', 'policy_message': 'Domain forbidden'}), \
             patch('sites_test_network.smoke_http') as smoke:
            result = run('https://production.example.test', policy_path='/missing')
        self.assertEqual(result['result'], 'failed')
        self.assertEqual(result['failure_stage'], 'proxy_connect')
        self.assertFalse(result['live_http_completed'])
        smoke.assert_not_called()

    def test_cli_exits_nonzero_for_network_denial(self):
        with patch('sites_test_network.run', return_value={'result': 'failed', 'failure_stage': 'proxy_connect'}), \
             patch('sites_test_network.Path.mkdir'), patch('sites_test_network.Path.write_text'), \
             patch('builtins.print'):
            self.assertEqual(main(['--url', 'https://production.example.test']), 1)

    def test_anonymous_smoke_uses_only_get_and_does_not_follow_login_redirects(self):
        opener = Opener()
        records = smoke_http('https://production.example.test', opener)
        self.assertEqual(len(records), 6)
        self.assertTrue(all(record['passed'] for record in records))
        self.assertTrue(all(request.get_method() == 'GET' and not request.has_header('Cookie')
                            and not request.has_header('Authorization') for request in opener.requests))
        self.assertNotIn('private-value', json.dumps(records))
        self.assertIsNone(NoRedirect().redirect_request(None, None, 307, '', {}, 'https://accounts.example.test'))

    def test_site_403_is_not_mislabeled_as_proxy_denial_or_logged_body(self):
        records = smoke_http('https://production.example.test', Opener(bad_route='/privacy'))
        failure = next(record for record in records if record['route'] == '/privacy')
        self.assertEqual(failure['stage'], 'site_http')
        self.assertEqual(failure['status'], 403)
        self.assertFalse(failure['passed'])
        self.assertNotIn('private response', json.dumps(records))

    def test_partial_success_is_preserved_if_later_connection_fails(self):
        records = []
        with self.assertRaises(urllib.error.URLError):
            smoke_http('https://production.example.test', Opener(transport_route='/privacy'), records=records)
        self.assertEqual(len(records), 1)
        self.assertTrue(records[0]['passed'])

    def test_existing_browser_commands_reject_production_before_browser_launch(self):
        for script in ['test-ui-layout.py', 'test-sites-browser.py']:
            process = subprocess.run([sys.executable, str(Path(__file__).resolve().parents[1] / 'scripts' / script)],
                input=json.dumps({'url': 'https://production.example.test', 'cookie': 'synthetic-only'}),
                text=True, capture_output=True)
            self.assertNotEqual(process.returncode, 0)
            self.assertIn('Synthetic sessions are restricted to loopback', process.stderr)
            self.assertNotIn('BrowserType.launch', process.stderr)


if __name__ == '__main__':
    unittest.main()

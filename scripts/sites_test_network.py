"""Read-only Sites smoke and proxy diagnostics. Never changes network policy."""
import argparse
import base64
import fnmatch
import hashlib
import http.client
import ipaddress
import json
import os
from pathlib import Path
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request


def is_loopback(host):
    if host == 'localhost':
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def validate_origin(value, local_only=False):
    url = urllib.parse.urlsplit(value)
    if (not url.hostname or url.username is not None or url.password is not None
            or url.query or url.fragment or url.path not in ['', '/']):
        raise ValueError('Use an origin without credentials, query, fragment or path')
    if url.scheme != 'https' and not (url.scheme == 'http' and is_loopback(url.hostname)):
        raise ValueError('HTTPS is required except for a loopback fixture')
    if local_only and not is_loopback(url.hostname):
        raise ValueError('Synthetic sessions are restricted to loopback fixtures; use test:sites:live for production')
    return value.rstrip('/')


def proxy_summary(value):
    if not value:
        return None
    parsed = urllib.parse.urlsplit(value)
    return {'scheme': parsed.scheme, 'host': parsed.hostname, 'port': parsed.port,
            'has_credentials': parsed.username is not None or parsed.password is not None}


def safe_error(error, proxies):
    text = str(error)
    for raw in proxies.values():
        if not isinstance(raw, str):
            continue
        parsed = urllib.parse.urlsplit(raw)
        if parsed.username is not None or parsed.password is not None:
            text = text.replace(raw, '[proxy endpoint redacted]')
            for secret in [parsed.username, parsed.password]:
                if secret:
                    text = text.replace(secret, '[redacted]').replace(urllib.parse.unquote(secret), '[redacted]')
    return re.sub(r'(?i)\b(Bearer|Basic)\s+\S+', r'\1 [redacted]', text)[:1000]


def policy_summary(host, path):
    result = {'path': str(path), 'readable': False, 'type': 'unknown', 'target_rule_present': None}
    try:
        policy = json.loads(Path(path).read_text())['http_network_policy']
        rules = policy.get('egress_rules', [])
        result.update(readable=True, type=policy.get('type', 'unknown'),
                      target_rule_present=any(fnmatch.fnmatchcase(host, rule.get('host', '')) for rule in rules))
    except (OSError, ValueError, KeyError, TypeError):
        pass  # An unavailable policy is unknown, never proof of network access.
    return result


def environment_summary(origin, proxies, policy_path):
    target = urllib.parse.urlsplit(origin)
    raw_proxy = proxies.get(target.scheme)
    bypass = urllib.request.proxy_bypass(target.hostname)
    pairs = [('HTTP_PROXY', 'http_proxy'), ('HTTPS_PROXY', 'https_proxy'), ('NO_PROXY', 'no_proxy')]
    return {
        'target': origin,
        'effective_proxy': proxy_summary(raw_proxy),
        'uses_existing_no_proxy': bypass,
        'proxy_variable_conflicts': [upper for upper, lower in pairs
                                     if upper in os.environ and lower in os.environ and os.environ[upper] != os.environ[lower]],
        'policy': policy_summary(target.hostname, policy_path),
    }


def probe_proxy(origin, raw_proxy, timeout=15):
    """Use the configured proxy's ordinary CONNECT path; do not bypass it."""
    target, proxy = urllib.parse.urlsplit(origin), urllib.parse.urlsplit(raw_proxy)
    if proxy.scheme not in ['http', 'https']:
        raise ValueError('Unsupported proxy scheme; preserve it and ask the platform administrator')
    connection_type = http.client.HTTPSConnection if proxy.scheme == 'https' else http.client.HTTPConnection
    connection = connection_type(proxy.hostname, proxy.port, timeout=timeout)
    headers = {}
    if proxy.username is not None:
        user = urllib.parse.unquote(proxy.username)
        password = urllib.parse.unquote(proxy.password or '')
        headers['Proxy-Authorization'] = 'Basic ' + base64.b64encode(f'{user}:{password}'.encode()).decode()
    host = f'[{target.hostname}]' if ':' in target.hostname else target.hostname
    authority = f'{host}:{target.port or 443}'
    headers['Host'] = authority
    try:
        connection.request('CONNECT', authority, headers=headers)
        response = connection.getresponse()
        safe_headers = {key.lower(): safe_error(value, {'proxy': raw_proxy}) for key, value in response.getheaders()
                        if key.lower() in ['server', 'content-type', 'content-length']}
        # Never print arbitrary error bodies: they can contain credentials or private URLs.
        body = response.read(2048) if response.status != 200 else b''
        message = body.decode('utf-8', 'replace').strip()
        return {'stage': 'proxy_connect', 'status': response.status,
                'reason': safe_error(response.reason, {'proxy': raw_proxy}), 'safe_headers': safe_headers,
                'policy_message': message if message in ['Domain forbidden', 'Access denied', 'Proxy Authentication Required'] else None,
                'body_sha256': hashlib.sha256(body).hexdigest() if body else None}
    finally:
        connection.close()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def smoke_http(origin, opener, timeout=15, records=None):
    records = records if records is not None else []
    for route in ['/', '/privacy', '/api/auth/session', '/tasks', '/admin', '/bugs']:
        request = urllib.request.Request(origin + route, headers={'User-Agent': 'WBSCowork-read-only-smoke/1'})
        try:
            response = opener.open(request, timeout=timeout)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            status = response.code
            record = {'route': route, 'status': status, 'stage': 'site_http', 'passed': False}
            if route in ['/tasks', '/admin', '/bugs']:
                location = urllib.parse.urlsplit(urllib.parse.urljoin(origin, response.headers.get('Location', '')))
                same_origin = (location.scheme, location.netloc) == (urllib.parse.urlsplit(origin).scheme, urllib.parse.urlsplit(origin).netloc)
                record.update(location_path=location.path,
                              passed=status in [302, 303, 307, 308] and same_origin
                              and location.path.startswith('/api/auth/signin'))
            else:
                body = response.read(2 * 1024 * 1024 + 1)
                bounded = len(body) <= 2 * 1024 * 1024
                if route == '/api/auth/session':
                    try:
                        record['passed'] = status == 200 and bounded and json.loads(body) == {}
                    except (ValueError, UnicodeDecodeError):
                        pass
                else:
                    record['passed'] = (status == 200 and bounded and 'text/html' in response.headers.get('Content-Type', '')
                                        and b'<html' in body.lower())
            records.append(record)
    return records


def run(origin, diagnose_only=False, policy_path='/etc/codex/network-policy.json', timeout=15):
    origin = validate_origin(origin)
    proxies = urllib.request.getproxies()
    environment = environment_summary(origin, proxies, policy_path)
    loopback = is_loopback(urllib.parse.urlsplit(origin).hostname)
    report = {'schema_version': 1,
              'mode': 'network_diagnostic' if diagnose_only else 'loopback_http_fixture' if loopback else 'live_anonymous_http',
              'result': 'failed', 'http_checks_completed': False, 'live_http_completed': False,
              'environment': environment, 'checks': []}
    try:
        proxy = proxies.get(urllib.parse.urlsplit(origin).scheme)
        if proxy and not environment['uses_existing_no_proxy'] and origin.startswith('https:'):
            report['proxy_probe'] = probe_proxy(origin, proxy, timeout)
            if report['proxy_probe']['status'] != 200:
                report.update(failure_stage='proxy_connect', failure_message=f"CONNECT {report['proxy_probe']['status']} {report['proxy_probe']['reason']}")
                report['next_action'] = ('Ask the platform network-policy owner to approve the exact target host; '
                                         'do not change proxy variables, NO_PROXY, certificates or application access settings.')
                if environment['policy']['type'] == 'restricted' and environment['policy']['target_rule_present'] is False:
                    report['proposed_admin_change'] = {'setting': 'http_network_policy.egress_rules',
                        'current_target_rule': 'absent', 'proposed_entry': {'host': urllib.parse.urlsplit(origin).hostname},
                        'applied': False, 'approval_required': True}
                return report
        if diagnose_only:
            report['result'] = 'diagnostic_completed'
            return report
        opener = urllib.request.build_opener(NoRedirect())
        smoke_http(origin, opener, timeout, report['checks'])
        report['http_checks_completed'] = True
        report['live_http_completed'] = not loopback
        if all(check['passed'] for check in report['checks']):
            report['result'] = 'passed'
        else:
            report.update(failure_stage='site_http', failure_message='One or more site HTTP contracts failed; inspect checks')
    except (OSError, ValueError, urllib.error.URLError) as error:
        message = safe_error(error, proxies)
        cause = getattr(error, 'reason', error)
        stage = 'proxy_connect' if 'Tunnel connection failed:' in message else 'tls' if isinstance(cause, ssl.SSLError) else 'transport'
        report.update(failure_stage=stage, failure_message=message)
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True, help='HTTPS Site origin; HTTP is allowed only for loopback test fixtures')
    parser.add_argument('--diagnose', action='store_true', help='Read policy and probe existing proxy; does not test the Site HTTP contract')
    parser.add_argument('--output', default='.test-artifacts/sites-live/results.json')
    args = parser.parse_args(argv)
    try:
        report = run(args.url, args.diagnose)
    except ValueError as error:
        parser.error(str(error))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report['result'] in ['passed', 'diagnostic_completed'] else 1

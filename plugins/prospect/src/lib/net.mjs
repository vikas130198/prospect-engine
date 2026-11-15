// Safe HTTP fetching: only public http(s) hosts, size + time limits, checked redirects (SSRF protection).
import dns from 'node:dns/promises';
import net from 'node:net';
import { UserError } from './util.mjs';

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blocked.addSubnet(addr, prefix, 'ipv4');
for (const [addr, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]) blocked.addSubnet(addr, prefix, 'ipv6');

function isBlockedIp(ip) {
  const fam = net.isIPv6(ip) ? 'ipv6' : 'ipv4';
  const mapped = fam === 'ipv6' && ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return blocked.check(mapped[1], 'ipv4');
  return blocked.check(ip, fam);
}

export function normalizeUrl(input) {
  let s = String(input || '').trim();
  if (!s) throw new UserError('No URL given.');
  if (!/^[a-z]+:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new UserError(`"${input}" is not a valid web address.`);
  }
  if (!['http:', 'https:'].includes(u.protocol)) throw new UserError('Only http and https web addresses can be checked.');
  if (u.username || u.password) throw new UserError('Web addresses with embedded usernames or passwords are not allowed.');
  u.hash = '';
  return u;
}

export async function assertPublicHost(u) {
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new UserError(`${host} is a private address and cannot be checked.`);
  let addrs;
  if (net.isIP(host)) addrs = [{ address: host }];
  else {
    try {
      addrs = await dns.lookup(host, { all: true, verbatim: true });
    } catch {
      const err = new UserError(`The website ${host} could not be found (DNS lookup failed).`, 'Check the address is spelled correctly. The site may no longer exist.');
      err.dns = true;
      throw err;
    }
  }
  if (!addrs.length || addrs.some((a) => isBlockedIp(a.address))) throw new UserError(`${host} points to a private network address and cannot be checked.`);
}

const UA = 'Mozilla/5.0 (compatible; ProspectEngineAudit/1.0; website quality review)';

/**
 * Fetch a public URL. Returns { url, finalUrl, status, headers, body, bytes, ms, redirects, truncated }.
 * Network failures are returned as { error } instead of throwing, so audits can report them.
 */
export async function safeFetch(input, { method = 'GET', timeoutMs = 15000, maxBytes = 3_000_000, maxRedirects = 5, accept } = {}) {
  let u = normalizeUrl(input);
  const redirects = [];
  const started = Date.now();
  for (let hop = 0; hop <= maxRedirects; hop++) {
    try {
      await assertPublicHost(u);
    } catch (e) {
      // A domain that no longer resolves is an audit finding, not a crash. Private addresses still throw.
      if (e.dns) return { url: String(input), finalUrl: u.href, error: 'domain does not resolve (DNS lookup failed) — the site may have expired', ms: Date.now() - started, redirects };
      throw e;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(u, {
        method,
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'user-agent': UA, accept: accept || 'text/html,application/xhtml+xml,*/*;q=0.8', 'accept-language': 'en' },
      });
    } catch (e) {
      clearTimeout(timer);
      const msg = e.name === 'AbortError' ? `timed out after ${timeoutMs / 1000}s` : e.cause?.code === 'CERT_HAS_EXPIRED' || /certificate|SSL|TLS/i.test(String(e.cause?.message || e.message)) ? `SSL/certificate problem (${e.cause?.code || e.cause?.message || e.message})` : e.cause?.code || e.message;
      return { url: String(input), finalUrl: u.href, error: msg, ms: Date.now() - started, redirects };
    }
    if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.get('location')) {
      clearTimeout(timer);
      const next = new URL(res.headers.get('location'), u);
      redirects.push({ from: u.href, to: next.href, status: res.status });
      if (!['http:', 'https:'].includes(next.protocol)) return { url: String(input), finalUrl: next.href, error: 'redirected to a non-web address', redirects };
      u = next;
      continue;
    }
    let body = '';
    let bytes = 0;
    let truncated = false;
    if (method !== 'HEAD' && res.body) {
      const reader = res.body.getReader();
      const chunks = [];
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > maxBytes) {
            truncated = true;
            ctrl.abort();
            break;
          }
          chunks.push(value);
        }
      } catch (e) {
        if (!truncated) {
          clearTimeout(timer);
          return { url: String(input), finalUrl: u.href, status: res.status, error: `connection dropped while reading (${e.message})`, ms: Date.now() - started, redirects };
        }
      }
      body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
    }
    clearTimeout(timer);
    return {
      url: String(input),
      finalUrl: u.href,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body,
      bytes,
      truncated,
      ms: Date.now() - started,
      redirects,
    };
  }
  return { url: String(input), finalUrl: u.href, error: `too many redirects (more than ${maxRedirects})`, redirects };
}

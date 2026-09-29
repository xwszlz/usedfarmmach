/**
 * Neon 连接引导器 —— 绕过 Clash fake-ip 劫持
 *
 * 【为什么需要】
 * 本机 Clash 开启 fake-ip 模式（规则/全局模式**都**劫持 DNS），所有域名被解析成
 * 198.18.x.x 保留网段，导致 postgres 客户端连 5432 时约 5 秒超时
 * （"Connection terminated unexpectedly"，耗时恒定不变）。
 *
 * 实测必须同时满足：
 *   ① DNS 拿到 Neon 真实 IP（本模块劫持 dns.lookup 实现）
 *   ② 流量走 Clash 隧道（HTTPS_PROXY=http://127.0.0.1:7890 或 1599，两者皆可）
 *
 * 【🔴 重要限制 —— 只对 pg 驱动有效】
 * Prisma 的 query engine 是 Rust 二进制，自带 DNS 解析器，**绕过 Node 的 dns.lookup**，
 * 因此本补丁对 Prisma 完全无效（传 datasources.url=<真IP> 也无效）。
 * 在 fake-ip 环境下，所有 DB 操作请改用 `pg` 驱动。
 * 现成范例：scripts/import-articles-pg.js
 *
 * 【用法 A —— 异步推荐（确保拿到活 IP）】
 *   const { bootstrapAsync } = require('./lib/neon-connect');
 *   await bootstrapAsync();                    // 在 new pg.Client() 之前
 *   const { Client } = require('pg');
 *
 * 【用法 B —— 同步兼容（旧脚本，用快照，可能导致首连失败）】
 *   require('./lib/neon-connect').bootstrap();
 *
 * 【2026-09-15 重写要点】
 *   - 原版「先返回旧快照、后台异步刷新」→ 首次连接若快照失配必挂，且报错恒定 5s，极难排查。
 *   - 现改为启动时**实际取 IP 并逐个 TCP 探活**，只把能连通的填进池。
 *   - DoH 用系统 curl 调用（避开 Node https 在 fake-ip 下的诡异时序），三源互备。
 */
'use strict';

const dns = require('dns');
const net = require('net');
const tls = require('tls');
const { execFileSync } = require('child_process');

// 兜底快照（ap-southeast-1），真值由 DoH 动态获取
const IP_SNAPSHOT = ['13.251.17.193', '3.0.167.45', '18.138.49.39'];

const DOH_SOURCES = [
  (h) => `https://dns.alidns.com/resolve?name=${encodeURIComponent(h)}&type=A`,
  (h) => `https://doh.pub/dns-query?name=${encodeURIComponent(h)}&type=A`,
  (h) => `https://dns.google/resolve?name=${encodeURIComponent(h)}&type=A`,
];

let _patched = false;
let _ips = IP_SNAPSHOT.slice();
let _target = null;
let _ready = null;

/** 用系统 curl 做 DoH 查询（同步、快、避开 Node https 问题） */
function dohSync(url) {
  try {
    const out = execFileSync('curl', ['-s', '--max-time', '8', '-H', 'accept: application/dns-json', url], {
      encoding: 'utf8', timeout: 10000, windowsHide: true,
    });
    const j = JSON.parse(out);
    return (j.Answer || []).filter((a) => a.type === 1).map((a) => a.data);
  } catch (_) {
    return [];
  }
}

/** TCP 探活（异步，快） */
function probeTcp(ip, port, timeoutMs) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let done = false;
    const finish = (ok, ms) => {
      if (done) return;
      done = true;
      try { s.destroy(); } catch (_) {}
      resolve({ ip, ok, ms });
    };
    s.setTimeout(timeoutMs);
    s.on('connect', () => finish(true, 0));
    s.on('timeout', () => finish(false, timeoutMs));
    s.on('error', () => finish(false, 0));
    try { s.connect(port, ip); } catch (_) { finish(false, 0); }
  });
}

/**
 * 原生 DNS + TLS 可达性探测（2026-09-29 新增）。
 *
 * 【为什么需要】Clash TUN 的 fake-ip 并非"DNS 坏掉"——Node `lookup` 拿到 198.18.x.x，
 * 但 TUN 会按**域名**把该地址回映射到真实端点，TLS 的 SNI 仍是主机名 ⇒ 原生链路可用。
 * 而把主机名强钉成 DoH 查到的**裸 IP**后，Clash 失去域名信息 ⇒ TCP 探活虽通、
 * PostgreSQL/TLS 握手必失败（`Connection terminated unexpectedly`）。
 * ⇒ 先试原生；能通就不劫持，只在原生确实不通时才退回劫持（保留原兜底能力）。
 */
function probeNativeTls(target, port, timeoutMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let done = false;
    let s;
    const fin = (ok, why) => {
      if (done) return;
      done = true;
      try { if (s) s.destroy(); } catch (_) {}
      resolve({ ok, ms: Date.now() - t0, why });
    };
    try {
      s = tls.connect({ host: target, port, servername: target, rejectUnauthorized: false },
        () => fin(true, 'ok'));
    } catch (e) { return fin(false, e.code || String(e)); }
    s.setTimeout(timeoutMs);
    s.on('timeout', () => fin(false, 'timeout'));
    s.on('error', (e) => fin(false, e.code || String(e)));
  });
}

/** 收集候选 IP：DoH 多源 + 快照，去重 */
function gatherIps(host) {
  const found = [];
  for (const mk of DOH_SOURCES) {
    const ips = dohSync(mk(host));
    if (ips.length) {
      for (const ip of ips) if (!found.includes(ip)) found.push(ip);
      break;
    }
  }
  for (const ip of IP_SNAPSHOT) if (!found.includes(ip)) found.push(ip);
  return found;
}

/** 从 env 推断目标 host */
function resolveTarget(host) {
  if (host) return host;
  const conn = process.env.DATABASE_URL || process.env.DATABASE_URL_CN || '';
  if (!conn) return null;
  try { return new URL(conn).hostname; } catch (_) { return null; }
}

/** 安装 dns.lookup 劫持 */
function installHijack() {
  if (!_target) return;
  const origLookup = dns.lookup;
  dns.lookup = function (hostname, o, cb) {
    if (hostname === _target) {
      if (typeof o === 'function') { cb = o; o = {}; }
      const ip = _ips[Math.floor(Math.random() * _ips.length)];
      if (o && o.all) return process.nextTick(() => cb(null, [{ address: ip, family: 4 }]));
      return process.nextTick(() => cb(null, ip, 4));
    }
    return origLookup.apply(this, arguments);
  };
}

/**
 * 异步引导（推荐）：取真 IP → 探活 → 装劫持。
 * 返回最终使用的 IP 列表。
 */
async function bootstrapAsync(host, opts) {
  if (_ready) return _ready;
  const opt = opts || {};
  const port = opt.port || 5432;
  const verbose = opt.verbose !== false;

  _target = resolveTarget(host);
  if (!_target) {
    _ips = IP_SNAPSHOT.slice();
    _ready = Promise.resolve(_ips);
    return _ready;
  }

  _ready = (async () => {
    // 先试原生链路（fake-ip + TUN 场景下按域名回映射，通常可用且更正确）
    if (process.env.NEON_FORCE_HIJACK !== '1') {
      const nat = await probeNativeTls(_target, port, opt.nativeTimeout || 6000);
      if (verbose) {
        console.log('[neon-connect] 原生 DNS+TLS: ' + (nat.ok ? '✅ 可达' : '❌ ' + nat.why)
          + ' (' + nat.ms + 'ms)');
      }
      if (nat.ok) {
        if (verbose) console.log('[neon-connect] ⇒ 跳过 DNS 劫持（强钉裸 IP 会让 Clash 丢失域名信息而握手失败）');
        _ips = [_target];
        return _ips;
      }
    }
    const cands = gatherIps(_target);
    if (verbose) console.log('[neon-connect] 候选 IP = ' + cands.join(', '));
    const results = await Promise.all(cands.map((ip) => probeTcp(ip, port, 3000)));
    const live = results.filter((r) => r.ok).map((r) => r.ip);
    if (live.length) {
      _ips = live;
      if (verbose) console.log('[neon-connect] ✅ 可用 IP = ' + live.join(', '));
    } else {
      _ips = cands.length ? cands : IP_SNAPSHOT.slice();
      if (verbose) console.log('[neon-connect] ⚠️ 探活全失败，回落 = ' + _ips.join(', '));
    }
    installHijack();
    return _ips;
  })();

  return _ready;
}

/** 同步引导（兼容旧脚本）：用快照装劫持，不探活 */
function bootstrap(host, opts) {
  if (_patched) return _ips;
  _patched = true;
  _target = resolveTarget(host);
  if (!_target) return _ips;
  if (process.env.NEON_NO_HIJACK === '1') {
    if (!opts || opts.verbose !== false) {
      console.log('[neon-connect] NEON_NO_HIJACK=1 ⇒ 不劫持 DNS，直接用主机名（' + _target + '）');
    }
    _ips = [_target];
    return _ips;
  }
  _ips = IP_SNAPSHOT.slice();
  installHijack();
  return _ips;
}

module.exports = { bootstrap, bootstrapAsync, gatherIps, IP_SNAPSHOT };

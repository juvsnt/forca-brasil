import { isIP } from 'node:net';
import { ranking } from './ranking.mjs';

export function normalizeIP(value) {
  if (!value || !isIP(value)) return null;
  if (isIP(value) === 4) return value;
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  // IPv4 mapeado para IPv6 representa o mesmo endereço IPv4.
  const mapped = canonical.match(/^::ffff:([0-9a-f]+):([0-9a-f]+)$/);
  if (mapped) {
    return mapped.slice(1).flatMap(part => {
      const n = parseInt(part, 16);
      return [n >> 8, n & 255];
    }).join('.');
  }
  return canonical;
}

export default {
  async fetch(request, env) {
    const headers = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    };
    const reply = (body, status = 200) => Response.json(body, { status, headers });
    const path = new URL(request.url).pathname;
    if (!['/visits', '/ranking'].includes(path)) return reply({ error: 'Not found' }, 404);
    if (request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return reply({ error: 'Forbidden' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'Method not allowed' }, 405);
    try {
      if (path === '/ranking') return await ranking(request, env, reply);
      if (request.method === 'GET') {
        const result = await env.DB.prepare('SELECT count FROM totals WHERE id = 1').first();
        return reply({ count: result.count });
      }
      // O IP vem da borda Cloudflare; não aceitamos um IP enviado no corpo ou na URL.
      const ip = normalizeIP(request.headers.get('CF-Connecting-IP'));
      if (!ip) return reply({ error: 'Client address unavailable' }, 400);
      if (!env.IP_HASH_SECRET || env.IP_HASH_SECRET.length < 32) throw new Error('Missing secret');
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(env.IP_HASH_SECRET),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(ip));
      const hash = [...new Uint8Array(signature)].map(x => x.toString(16).padStart(2, '0')).join('');
      // Restrição UNIQUE + gatilho e transação: acessos simultâneos não duplicam IPs.
      const result = await env.DB.batch([
        env.DB.prepare('INSERT OR IGNORE INTO visitors (ip_hash) VALUES (?)').bind(hash),
        env.DB.prepare('SELECT count FROM totals WHERE id = 1')
      ]);
      return reply({ count: result[1].results[0].count });
    } catch {
      return reply({ error: 'Counter temporarily unavailable' }, 503);
    }
  }
};

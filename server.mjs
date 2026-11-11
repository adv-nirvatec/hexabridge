import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';

const root = dirname(fileURLToPath(import.meta.url));
const interests = new Set(['Payments & collections', 'Digital government', 'Enterprise applications', 'Systems integration', 'Cloud & managed services', 'Data & automation', 'Partner platform demo', 'Other / exploring options']);
const publicFiles = new Set(['/index.html', '/styles.css', '/script.js']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf' };
const mailbox = 'inquire@hexabridge.com';

export function validateInquiry(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const result = {};
  for (const [field, min, max] of [['name', 2, 100], ['email', 3, 254], ['organization', 2, 150], ['phone', 0, 40], ['message', 20, 4000]]) {
    const value = input[field] ?? '';
    if (typeof value !== 'string') return null;
    const cleaned = value.trim();
    if (cleaned.length < min || cleaned.length > max || cleaned.includes('\0')) return null;
    if (field !== 'message' && /[\r\n]/.test(cleaned)) return null;
    result[field] = cleaned;
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(result.email)) return null;
  if (!interests.has(input.interest) || input.consent !== 'yes') return null;
  result.interest = input.interest;
  return result;
}

function mailDelivery(env) {
  if (!env.SMTP_HOST || !env.SMTP_FROM) return null;
  const port = Number(env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST, port, secure: port === 465,
    requireTLS: port !== 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    disableFileAccess: true, disableUrlAccess: true
  });
  return async inquiry => {
    const result = await transport.sendMail({
      from: env.SMTP_FROM, to: mailbox,
      replyTo: { name: inquiry.name, address: inquiry.email },
      subject: `HexaBridge website inquiry: ${inquiry.interest}`,
      text: [
        'New HexaBridge project inquiry', '',
        `Name: ${inquiry.name}`, `Email: ${inquiry.email}`,
        `Organization: ${inquiry.organization}`, `Phone: ${inquiry.phone || 'Not provided'}`,
        `Interest: ${inquiry.interest}`, '', inquiry.message, '',
        'The sender consented to use of these details to respond to this inquiry.'
      ].join('\n')
    });
    if (!result.accepted?.some(address => String(address).toLowerCase() === mailbox)) {
      throw new Error('Recipient not accepted');
    }
  };
}

export function createApp({ env = process.env, deliver = mailDelivery(env) } = {}) {
  const attempts = new Map();
  const windowMs = 15 * 60 * 1000;
  function json(res, code, body) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { return json(res, 400, { message: 'Invalid request.' }); }

    if (pathname === '/api/inquiries') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { message: 'Use the inquiry form to send your request.' });
      }
      const origin = req.headers.origin;
      const expectedOrigin = env.PUBLIC_ORIGIN || `http://${req.headers.host}`;
      if (origin && origin !== expectedOrigin) return json(res, 403, { message: 'Please submit your inquiry from the HexaBridge website.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { message: 'Please use the website inquiry form.' });
      const now = Date.now();
      for (const [key, entry] of attempts) if (now > entry.reset) attempts.delete(key);
      // Trust forwarded IP only behind the documented, loopback-only reverse proxy.
      const ip = env.TRUST_PROXY === '1' ? String(req.headers['x-real-ip'] || req.socket.remoteAddress) : req.socket.remoteAddress;
      const attempt = attempts.get(ip) || { count: 0, reset: now + windowMs };
      if (++attempt.count > 5) {
        res.setHeader('Retry-After', String(Math.ceil((attempt.reset - now) / 1000)));
        return json(res, 429, { message: 'Too many attempts. Please try again later or email inquire@hexabridge.com.' });
      }
      attempts.set(ip, attempt);
      let bytes = 0;
      const chunks = [];
      try {
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 20000) {
            json(res, 413, { message: 'Your inquiry is too long. Please shorten it and try again.' });
            return;
          }
          chunks.push(chunk);
        }
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (input && typeof input.website === 'string' && input.website.trim()) return json(res, 400, { message: 'Please leave the website field empty.' });
        const inquiry = validateInquiry(input);
        if (!inquiry) return json(res, 400, { message: 'Please check the required fields, email address and consent checkbox.' });
        if (!deliver) return json(res, 503, { message: 'The inquiry form is not yet connected. Please email inquire@hexabridge.com directly.' });
        try {
          await deliver(inquiry);
          return json(res, 200, { sent: true });
        } catch {
          // Never log inquiry content, credentials or SMTP provider responses.
          console.error('Inquiry delivery failed. Check SMTP configuration and provider delivery logs.');
          return json(res, 502, { message: 'We couldn’t deliver your inquiry. Please email inquire@hexabridge.com directly.' });
        }
      } catch {
        return json(res, 400, { message: 'Your inquiry could not be read. Please try again.' });
      }
    }

    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return json(res, 405, { message: 'Method not allowed.' });
    }
    if (pathname === '/') pathname = '/index.html';
    // Explicit public allowlist keeps .env, source, dependencies and Git inaccessible.
    if (!publicFiles.has(pathname) && !/^\/assets\/[a-zA-Z0-9._-]+$/.test(pathname)) return json(res, 404, { message: 'Page not found.' });
    const file = resolve(root, '.' + pathname);
    if (!file.startsWith(root + sep)) return json(res, 404, { message: 'Page not found.' });
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error('Not a file');
      const body = req.method === 'HEAD' ? undefined : await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=3600' : 'no-cache' });
      res.end(body);
    } catch { json(res, 404, { message: 'Page not found.' }); }
  });
  server.requestTimeout = 45000;
  server.headersTimeout = 15000;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  const host = process.env.HOST || '127.0.0.1';
  createApp().listen(port, host, () => {
    console.log(`HexaBridge preview: http://${host}:${port}`);
    console.log(process.env.SMTP_HOST && process.env.SMTP_FROM ? 'Inquiry mail transport configured.' : 'Inquiry mail awaits deployment configuration. No emails will be sent.');
  });
}

export class HttpError extends Error {
  constructor(status, message, code, extra) {
    super(message);
    this.status = status;
    this.code = code || 'ERROR';
    this.extra = extra;
  }
}

export function corsHeaders(request) {
  // Auth uses a bearer token (no cookies), so reflecting the caller's origin is safe.
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export async function readJson(request, maxBytes = 8 * 1024 * 1024) {
  const len = +(request.headers.get('Content-Length') || 0);
  if (len > maxBytes) throw new HttpError(413, 'Request too large', 'TOO_LARGE');
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body', 'BAD_JSON');
  }
}

export function str(v, max = 1000) {
  if (v == null || v === '') return null;
  return String(v).slice(0, max);
}

import { get, list, put } from '@vercel/blob';

const ROOT = 'bead-house-progress/v1';
const ACCESS = 'private';

export function cloudAvailable() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN));
}

export function cloudPath(kind, id) {
  const safeKind = String(kind || 'misc').replace(/[^a-z0-9_-]/gi, '-').slice(0, 48);
  const safeId = String(id || 'default').replace(/[^a-z0-9_.-]/gi, '-').slice(0, 128);
  return `${ROOT}/${safeKind}/${safeId}.json`;
}

export async function readCloudJson(pathname) {
  if (!cloudAvailable()) return null;
  const result = await get(pathname, { access: ACCESS, useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const text = await new Response(result.stream).text();
  return JSON.parse(text);
}

export async function writeCloudJson(pathname, value) {
  if (!cloudAvailable()) return false;
  await put(pathname, JSON.stringify(value), {
    access: ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: 60
  });
  return true;
}

export async function listCloudJson(prefix) {
  if (!cloudAvailable()) return [];
  const pathPrefix = `${ROOT}/${String(prefix).replace(/[^a-z0-9_\/-]/gi, '-').replace(/^\/+|\/+$/g, '')}/`;
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: pathPrefix, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const values = [];
  for (let offset = 0; offset < blobs.length; offset += 24) {
    const batch = blobs.slice(offset, offset + 24);
    const loaded = await Promise.all(batch.map(blob => readCloudJson(blob.pathname).catch(() => null)));
    for (const value of loaded) if (value) values.push(value);
  }
  return values;
}

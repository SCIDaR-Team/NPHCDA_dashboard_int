/**
 * Minimal ODK Central OData client. ODK exposes each form at
 *   {baseUrl}/v1/projects/{id}/forms/{form}.svc
 * and each entity (e.g. `Submissions`) as an OData collection with server-side
 * paging via `@odata.nextLink`. Auth is HTTP Basic (email:password).
 */

/** Fetch every row of an OData entity, following nextLink paging. */
export async function fetchAllOData(serviceUrl, entity, credentials, { pageSize = 250 } = {}) {
  const auth = 'Basic ' + Buffer.from(credentials).toString('base64');
  const headers = { Authorization: auth, Accept: 'application/json' };

  const base = serviceUrl.endsWith('/') ? serviceUrl : serviceUrl + '/';
  let url = `${base}${entity}?$top=${pageSize}&$count=true`;
  const rows = [];
  let total = null;
  let pages = 0;

  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`OData ${res.status} ${res.statusText} at ${url}`);
    }
    const json = await res.json();
    if (total == null && typeof json['@odata.count'] === 'number') total = json['@odata.count'];
    if (Array.isArray(json.value)) rows.push(...json.value);
    pages++;

    const next = json['@odata.nextLink'];
    url = next ? (/^https?:/i.test(next) ? next : new URL(next, base).href) : null;
    if (pages > 10000) break; // safety valve
  }

  return { rows, total: total ?? rows.length };
}

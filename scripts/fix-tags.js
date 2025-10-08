/*
 Try to (1) set color on tag `mcp-demo-wsxp40`,
 (2) create a new tag with color if update not allowed, and
 (3) attach tags to the workflow by ID.
 Prints detailed results (no secrets).
*/
const base = process.env.N8N_BASE_URL?.replace(/\/$/, "");
const key = process.env.N8N_API_KEY;
if (!base || !key) {
  console.error(JSON.stringify({ error: "Missing envs" }));
  process.exit(1);
}

const HEADERS = { "X-N8N-API-KEY": key, "Content-Type": "application/json" };
const S = { startedAt: new Date().toISOString() };

async function req(method, path, data) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { method, headers: HEADERS, body: data ? JSON.stringify(data) : undefined });
    const ct = res.headers.get("content-type") || "";
    let body;
    if (ct.includes("application/json")) {
      body = await res.json().catch(() => ({}));
    } else {
      body = await res.text().catch(() => "");
    }
    return { ok: res.ok, status: res.status, data: body };
  } catch (e) {
    return { ok: false, status: e?.code || "ERR", data: String(e) };
  }
}

function unwrapList(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (Array.isArray(x.data)) return x.data;
  return [];
}

async function main() {
  // List tags (prefer v1)
  let tagsEndpoint = "/api/v1/tags";
  let tr = await req("GET", tagsEndpoint);
  if (!tr.ok) {
    tagsEndpoint = "/rest/tags";
    tr = await req("GET", tagsEndpoint);
  }
  S.tagsEndpoint = tagsEndpoint;
  const tags = unwrapList(tr.data);
  const wantName = "mcp-demo-wsxp40";
  let tag = tags.find((t) => t?.name === wantName);

  // Try updating color on existing tag
  if (tag) {
    const attempts = [
      { method: "PATCH", path: `${tagsEndpoint}/${tag.id}`, body: { color: "#00bcd4" } },
      { method: "PUT", path: `${tagsEndpoint}/${tag.id}`, body: { name: tag.name, color: "#00bcd4" } },
      { method: "PATCH", path: `/rest/tags/${tag.id}`, body: { color: "#00bcd4" } },
      { method: "PUT", path: `/rest/tags/${tag.id}`, body: { name: tag.name, color: "#00bcd4" } },
    ];
    for (const a of attempts) {
      const r = await req(a.method, a.path, a.body);
      if (r.ok) { S.tagColorSet = { id: tag.id, color: "#00bcd4", via: a }; break; }
      else { (S.tagColorErrors ||= []).push({ via: a, status: r.status, data: r.data }); }
    }
  } else {
    S.tagMissing = wantName;
  }

  // If color not set, try creating a new colored tag
  if (!S.tagColorSet) {
    const newName = `mcp-demo-colored-${Date.now().toString(36)}`;
    const cr = await req("POST", tagsEndpoint, { name: newName, color: "#00bcd4" });
    if (cr.ok) S.createdColoredTag = cr.data?.data ?? cr.data; else S.createColoredTagError = { status: cr.status, data: cr.data };
  }

  // Try to reach workflow
  const wfCandidates = [
    { id: "c1Ct6IhoBEBiky3U" },
    { id: 2 },
  ];
  let wf;
  for (const c of wfCandidates) {
    // Try v1 first
    let r = await req("GET", `/api/v1/workflows/${c.id}`);
    if (!r.ok) r = await req("GET", `/rest/workflows/${c.id}`);
    if (r.ok) { wf = r.data; break; }
    (S.workflowGetErrors ||= []).push({ id: c.id, status: r.status, data: r.data });
  }

  if (!wf) {
    S.workflow = "not-accessible-with-current-key";
    console.log(JSON.stringify(S));
    return;
  }

  const wfId = wf?.id ?? wf?.numericId;
  S.workflow = { id: wfId, name: wf?.name, active: wf?.active };

  // Determine tagIds to attach
  const currentTagsList = unwrapList(tr.data);
  const needed = ["example", "webhook", "api", "mcp-demo", wantName];
  const tagIds = needed.map((n) => currentTagsList.find((t) => t?.name === n)?.id).filter(Boolean);
  if (S.createdColoredTag?.id) tagIds.push(S.createdColoredTag.id);

  // Try attaching via v1 POST tags endpoint
  let ar = await req("POST", `/api/v1/workflows/${wfId}/tags`, { tagIds });
  if (!ar.ok) (S.attachErrors ||= []).push({ method: "POST", path: `/api/v1/workflows/${wfId}/tags`, status: ar.status, data: ar.data });
  else S.tagsAttached = true;

  // Try rest PATCH with names and ids
  if (!S.tagsAttached) {
    ar = await req("PATCH", `/rest/workflows/${wfId}`, { tags: needed });
    if (!ar.ok) (S.attachErrors ||= []).push({ method: "PATCH", path: `/rest/workflows/${wfId}`, status: ar.status, data: ar.data });
    else S.tagsAttached = true;
  }
  if (!S.tagsAttached) {
    ar = await req("PATCH", `/rest/workflows/${wfId}`, { tags: tagIds });
    if (!ar.ok) (S.attachErrors ||= []).push({ method: "PATCH", path: `/rest/workflows/${wfId}`, status: ar.status, data: ar.data });
    else S.tagsAttached = true;
  }

  // Verify
  const vr = await req("GET", `/api/v1/workflows/${wfId}`);
  if (vr.ok) S.workflowAfter = vr.data; else S.verifyError = { status: vr.status };

  console.log(JSON.stringify(S));
}

main().catch((e) => { console.error(JSON.stringify({ error: String(e) })); process.exit(1); });

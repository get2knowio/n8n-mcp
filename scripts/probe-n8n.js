/*
 Probe n8n tags + workflows API to (1) detect endpoints, (2) set tag color, (3) attach tags to a workflow.
 Prints a compact JSON summary to stdout. No secrets are logged.
*/

const base = process.env.N8N_BASE_URL?.replace(/\/$/, "");
const key = process.env.N8N_API_KEY;

if (!base || !key) {
  console.error(JSON.stringify({ error: "Missing envs" }));
  process.exit(1);
}

const HEADERS = {
  "X-N8N-API-KEY": key,
  "Content-Type": "application/json",
};

const S = { startedAt: new Date().toISOString() };

async function req(method, path, data) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: HEADERS,
      body: data ? JSON.stringify(data) : undefined,
    });
    const ct = res.headers.get("content-type") || "";
    let body;
    if (ct.includes("application/json")) {
      body = await res.json().catch(() => ({}));
    } else {
      body = await res.text().catch(() => "");
    }
    if (!res.ok) return { ok: false, status: res.status, data: body };
    return { ok: true, status: res.status, data: body };
  } catch (e) {
    return { ok: false, status: e?.code || "ERR", data: String(e) };
  }
}

function pickWorkflowId(wf) {
  return wf?.id ?? wf?.workflowId ?? wf?.numericId;
}

// Normalize arrays that may be under { data: [] }
function unwrapList(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (Array.isArray(x.data)) return x.data;
  return [];
}

async function main() {
  // 1) Discover tags endpoint
  let tagsEndpoint = "/rest/tags";
  let tags = [];
  let r = await req("GET", "/rest/tags");
  if (!r.ok) {
    const r2 = await req("GET", "/api/v1/tags");
    if (r2.ok) {
      tagsEndpoint = "/api/v1/tags";
      tags = unwrapList(r2.data) || [];
      S.tagsEndpoint = tagsEndpoint;
    } else {
      S.tagsEndpointError = { rest: r.status, v1: r2.status };
    }
  } else {
    tags = unwrapList(r.data) || [];
    S.tagsEndpoint = tagsEndpoint;
  }

  // Ensure demo tag exists
  const wantTagName = "mcp-demo-wsxp40";
  let demoTag = tags.find((t) => t?.name === wantTagName);
  if (!demoTag) {
    const cr = await req("POST", tagsEndpoint, { name: wantTagName });
    if (cr.ok) {
      demoTag = cr.data?.data ?? cr.data;
    } else {
      S.createTagError = cr.status;
    }
  }
  if (demoTag) S.demoTag = { id: demoTag.id, name: demoTag.name };

  // 2) Attempt to set color on the tag
  if (demoTag) {
    const colorCandidates = ["#00bcd4", "#00BCD4", "00bcd4"];
    const paths = [
      (id) => `/rest/tags/${id}`,
      (id) => `/api/v1/tags/${id}`,
    ];
    let colorSet = false;
    const colorErrors = [];

    for (const path of paths) {
      for (const color of colorCandidates) {
        // Try PATCH
        const pr = await req("PATCH", path(demoTag.id), { color });
        if (pr.ok) {
          colorSet = true;
          S.tagColorSet = color;
          break;
        } else {
          colorErrors.push({ method: "PATCH", path: path("") + "{id}", status: pr.status });
        }
        // Try PUT with name+color
        const ur = await req("PUT", path(demoTag.id), { name: demoTag.name, color });
        if (ur.ok) {
          colorSet = true;
          S.tagColorSet = color;
          break;
        } else {
          colorErrors.push({ method: "PUT", path: path("") + "{id}", status: ur.status });
        }
      }
      if (colorSet) break;
    }
    if (!colorSet) S.tagColorErrors = colorErrors;
  }

  // 3) Find the workflow and attach tags
  const wfName = "MCP Demo Workflow 2025-10-08T01:15:21.616Z wsxp40 v2";
  let workflows = [];
  let wr = await req("GET", "/rest/workflows");
  if (!wr.ok) wr = await req("GET", "/api/v1/workflows");
  if (wr.ok) workflows = unwrapList(wr.data);

  let wf =
    workflows.find((w) => w?.name === wfName) ||
    workflows.find((w) => w?.numericId === 2) ||
    workflows.find((w) => w?.id === "c1Ct6IhoBEBiky3U");

  if (!wf) {
    S.workflowError = "not-found";
    console.log(JSON.stringify(S));
    return;
  }

  const wfId = pickWorkflowId(wf);
  S.workflow = { id: wfId, name: wf?.name, active: !!wf?.active };

  // Refresh tags list to ensure ids
  if (!tags.length) {
    const tr = await req("GET", tagsEndpoint);
    if (tr.ok) tags = unwrapList(tr.data);
  }

  const neededNames = ["example", "webhook", "api", "mcp-demo", wantTagName];
  const tagIds = neededNames
    .map((n) => tags.find((t) => t?.name === n)?.id)
    .filter(Boolean);

  let attachOk = false;
  const attachErrors = [];

  // Variant A: PATCH /rest/workflows/{id} with names
  let ar = await req("PATCH", `/rest/workflows/${wfId}`, { tags: neededNames });
  if (ar.ok) attachOk = true;

  // Variant B: PATCH /rest/workflows/{id} with IDs
  if (!attachOk) {
    ar = await req("PATCH", `/rest/workflows/${wfId}`, { tags: tagIds });
    if (ar.ok) attachOk = true; else attachErrors.push({ restPatch: ar.status });
  }

  // Variant C: POST /api/v1/workflows/{id}/tags { tagIds }
  if (!attachOk) {
    const pr = await req("POST", `/api/v1/workflows/${wfId}/tags`, { tagIds });
    if (pr.ok) attachOk = true; else attachErrors.push({ v1Post: pr.status });
  }

  S.tagsAttached = attachOk;
  if (!attachOk) S.attachErrors = attachErrors;

  // Verify tags on workflow
  const v = await req("GET", `/rest/workflows/${wfId}`);
  if (v.ok) {
    S.workflowTags = v.data?.tags || [];
  }

  S.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(S));
}

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e) }));
  process.exit(1);
});

const RANGE_MS = {
  "1h": 1 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const ALLOWED_TABLES = ["room_monitor", "esp32_monitor", "presence_events"];

const INSIGHTS_FIELDS = {
  room_monitor: "motion,temperature,humidity,created_at",
  esp32_monitor: "motion,temperature,humidity,pressure,air_quality,light_value,is_home,created_at",
};

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function json(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin),
  });
}

function getOrigin(request) {
  return request.headers.get("Origin") || "*";
}

function resolveTable(url, fallback) {
  const t = url.searchParams.get("table");
  if (!t) return fallback;
  if (!ALLOWED_TABLES.includes(t)) return null;
  return t;
}

async function querySupabaseTable(env, table, query) {
  const baseUrl = `${env.SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(`${baseUrl}?${query.toString()}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error (${res.status}): ${text}`);
  }
  return res.json();
}

function ensureEnv(env) {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_TABLE"];
  const missing = required.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(", ")}`);
}

export default {
  async fetch(request, env) {
    const origin = getOrigin(request);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405, origin);
    }

    try {
      ensureEnv(env);
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "");

      if (path === "/health") {
        return json({ ok: true }, 200, origin);
      }

      if (path === "/range") {
        const table = resolveTable(url, env.SUPABASE_TABLE);
        if (!table) return json({ error: "Invalid table" }, 400, origin);
        const range = url.searchParams.get("range") || "6h";
        const ms = RANGE_MS[range] || RANGE_MS["6h"];
        const since = new Date(Date.now() - ms).toISOString();
        const query = new URLSearchParams({
          select: "*",
          "created_at": `gte.${since}`,
          order: "created_at.asc",
          limit: "10000",
        });
        const data = await querySupabaseTable(env, table, query);
        return json({ data }, 200, origin);
      }

      if (path === "/latest") {
        const table = resolveTable(url, env.SUPABASE_TABLE);
        if (!table) return json({ error: "Invalid table" }, 400, origin);
        const query = new URLSearchParams({
          select: "*",
          order: "created_at.desc",
          limit: "1",
        });
        const data = await querySupabaseTable(env, table, query);
        return json({ data: data[0] || null }, 200, origin);
      }

      if (path === "/insights") {
        const table = resolveTable(url, env.SUPABASE_TABLE);
        if (!table) return json({ error: "Invalid table" }, 400, origin);
        const days = Number(url.searchParams.get("days") || "7");
        const safeDays = Number.isFinite(days) ? Math.min(Math.max(days, 1), 30) : 7;
        const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
        const fields = INSIGHTS_FIELDS[table] || "motion,temperature,humidity,created_at";
        const query = new URLSearchParams({
          select: fields,
          "created_at": `gte.${since}`,
          order: "created_at.asc",
          limit: "100000",
        });
        const data = await querySupabaseTable(env, table, query);
        return json({ data }, 200, origin);
      }

      if (path === "/presence") {
        const days = Number(url.searchParams.get("days") || "7");
        const safeDays = Number.isFinite(days) ? Math.min(Math.max(days, 1), 30) : 7;
        const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
        const query = new URLSearchParams({
          select: "event_type,person,created_at",
          "created_at": `gte.${since}`,
          order: "created_at.desc",
          limit: "1000",
        });
        const data = await querySupabaseTable(env, "presence_events", query);
        return json({ data }, 200, origin);
      }

      if (path === "/combined") {
        const q1 = new URLSearchParams({ select: "*", order: "created_at.desc", limit: "1" });
        const q2 = new URLSearchParams({ select: "*", order: "created_at.desc", limit: "1" });
        const [r1, r2] = await Promise.all([
          querySupabaseTable(env, "room_monitor", q1),
          querySupabaseTable(env, "esp32_monitor", q2),
        ]);
        return json({ room1: r1[0] || null, room2: r2[0] || null }, 200, origin);
      }

      return json({ error: "Not found" }, 404, origin);
    } catch (err) {
      return json({ error: err.message || "Internal server error" }, 500, origin);
    }
  },
};

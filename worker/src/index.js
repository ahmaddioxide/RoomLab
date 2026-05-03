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

        // Bucket sizes that keep point count well under 1000 for any logging frequency
        const BUCKET_SEC = { '1h': 30, '6h': 180, '24h': 600, '7d': 3600, '30d': 10800 };
        const bucketSec = BUCKET_SEC[range] || 180;
        const rpcName = table === "esp32_monitor" ? "get_esp32_range_bucketed" : "get_room1_range_bucketed";
        const rpcUrl = `${env.SUPABASE_URL}/rest/v1/rpc/${rpcName}`;
        const rpcRes = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ p_since: since, p_bucket_sec: bucketSec }),
        });
        if (!rpcRes.ok) {
          const errText = await rpcRes.text();
          return json({ error: `RPC error: ${errText}` }, 500, origin);
        }
        const data = await rpcRes.json();
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
          order: "created_at.desc",
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

      if (path === "/range-dates") {
        const table = resolveTable(url, env.SUPABASE_TABLE);
        if (!table) return json({ error: "Invalid table" }, 400, origin);
        const start = url.searchParams.get("start");
        const end = url.searchParams.get("end");
        if (!start || !end) return json({ error: "start and end are required" }, 400, origin);
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
          return json({ error: "Invalid date format. Use ISO 8601." }, 400, origin);
        const diffMs = endDate.getTime() - startDate.getTime();
        if (diffMs < 0 || diffMs > 7 * 24 * 60 * 60 * 1000)
          return json({ error: "Date range must be between 0 and 7 days" }, 400, origin);
        const query = new URLSearchParams();
        query.set("select", "*");
        query.append("created_at", `gte.${startDate.toISOString()}`);
        query.append("created_at", `lte.${endDate.toISOString()}`);
        query.set("order", "created_at.asc");
        query.set("limit", "50000");
        const data = await querySupabaseTable(env, table, query);
        return json({ data }, 200, origin);
      }

      if (path === "/daily-stats") {
        const table = resolveTable(url, env.SUPABASE_TABLE);
        if (!table || table === "presence_events") return json({ error: "Invalid table" }, 400, origin);
        // Support explicit start/end dates OR fall back to "last N days"
        const startParam = url.searchParams.get("start");
        const endParam = url.searchParams.get("end");
        let since, until;
        if (startParam && endParam) {
          const s = new Date(startParam), e = new Date(endParam);
          if (isNaN(s.getTime()) || isNaN(e.getTime())) return json({ error: "Invalid date" }, 400, origin);
          const rangeDays = (e - s) / 86400000;
          if (rangeDays > 365) return json({ error: "Range too large (max 365 days)" }, 400, origin);
          since = s.toISOString();
          until = new Date(e.getTime() + 86400000).toISOString();
        } else {
          const days = Number(url.searchParams.get("days") || "30");
          const safeDays = Number.isFinite(days) ? Math.min(Math.max(days, 1), 365) : 30;
          since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
          until = new Date(Date.now() + 86400000).toISOString();
        }
        // Use RPC for aggregation — avoids Supabase's 1000-row-per-request cap
        const rpcName = table === "esp32_monitor" ? "get_esp32_daily_stats" : "get_room1_daily_stats";
        const rpcUrl = `${env.SUPABASE_URL}/rest/v1/rpc/${rpcName}`;
        const rpcRes = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Prefer": "return=representation",
          },
          body: JSON.stringify({ p_start: since, p_end: until }),
        });
        if (!rpcRes.ok) {
          const errText = await rpcRes.text();
          return json({ error: `RPC error: ${errText}` }, 500, origin);
        }
        const data = await rpcRes.json();
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

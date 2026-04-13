const RANGE_MS = {
  "1h": 1 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
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

async function querySupabase(env, query) {
  const baseUrl = `${env.SUPABASE_URL}/rest/v1/${env.SUPABASE_TABLE}`;
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
        const range = url.searchParams.get("range") || "6h";
        const ms = RANGE_MS[range] || RANGE_MS["6h"];
        const since = new Date(Date.now() - ms).toISOString();
        const query = new URLSearchParams({
          select: "*",
          "created_at": `gte.${since}`,
          order: "created_at.asc",
          limit: "10000",
        });
        const data = await querySupabase(env, query);
        return json({ data }, 200, origin);
      }

      if (path === "/latest") {
        const query = new URLSearchParams({
          select: "*",
          order: "created_at.desc",
          limit: "1",
        });
        const data = await querySupabase(env, query);
        return json({ data: data[0] || null }, 200, origin);
      }

      if (path === "/insights") {
        const days = Number(url.searchParams.get("days") || "7");
        const safeDays = Number.isFinite(days) ? Math.min(Math.max(days, 1), 30) : 7;
        const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
        const query = new URLSearchParams({
          select: "motion,temperature,humidity,created_at",
          "created_at": `gte.${since}`,
          order: "created_at.asc",
          limit: "100000",
        });
        const data = await querySupabase(env, query);
        return json({ data }, 200, origin);
      }

      return json({ error: "Not found" }, 404, origin);
    } catch (err) {
      return json({ error: err.message || "Internal server error" }, 500, origin);
    }
  },
};

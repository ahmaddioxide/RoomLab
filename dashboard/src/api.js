import { API_BASE } from './config';

export async function apiGet(path, params = {}) {
  const url = new URL(path, API_BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null) url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString());
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export async function fetchRangeDates(table, start, end) {
  return apiGet('/range-dates', { table, start, end });
}

export async function fetchDailyStats(table, days = 30) {
  return apiGet('/daily-stats', { table, days });
}

export async function fetchDailyStatsRange(table, start, end) {
  return apiGet('/daily-stats', { table, start, end });
}

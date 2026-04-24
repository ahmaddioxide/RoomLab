import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../api';
import { RANGES, ROOM_CONFIG } from '../config';
import { bucketize } from '../utils';
import { useInterval } from './useInterval';

export function useRoomData(room, range) {
  const cfg = ROOM_CONFIG[room];
  const [rangeData, setRangeData] = useState([]);
  const [bucketed, setBucketed] = useState([]);
  const [latest, setLatest] = useState(null);
  const [insights7d, setInsights7d] = useState([]);
  const [insights30d, setInsights30d] = useState([]);
  const [compRows, setCompRows] = useState([]);
  const [presence, setPresence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRange = useCallback(async () => {
    try {
      const rcfg = RANGES[range];
      const resp = await apiGet('/range', { range, table: cfg.table });
      const data = resp.data || [];
      setRangeData(data);
      setBucketed(bucketize(data, rcfg.bucketMin, cfg.gasField));
      if (data.length) setLatest(data[data.length - 1]);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [range, cfg.table, cfg.gasField]);

  const loadInsights = useCallback(async () => {
    try {
      const [i7, i30, r24] = await Promise.all([
        apiGet('/insights', { days: 7, table: cfg.table }),
        apiGet('/insights', { days: 30, table: cfg.table }),
        apiGet('/range', { range: '24h', table: cfg.table }),
      ]);
      setInsights7d(i7.data || []);
      setInsights30d(i30.data || []);
      // Merge for comparison chart
      const mm = new Map();
      for (const r of (i7.data || [])) mm.set(r.created_at, r);
      for (const r of (r24.data || [])) mm.set(r.created_at, r);
      setCompRows([...mm.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    } catch (_) {}
  }, [cfg.table]);

  const loadPresence = useCallback(async () => {
    if (room !== 'room2') return;
    try {
      const resp = await apiGet('/presence', { days: 7 });
      setPresence(resp.data || []);
    } catch (_) {}
  }, [room]);

  const fetchLatest = useCallback(async () => {
    try {
      const resp = await apiGet('/latest', { table: cfg.table });
      if (resp.data) setLatest(resp.data);
    } catch (_) {}
  }, [cfg.table]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([loadRange(), loadInsights(), loadPresence()])
      .finally(() => setLoading(false));
  }, [loadRange, loadInsights, loadPresence]);

  // Reload range when range changes
  useEffect(() => { loadRange(); }, [loadRange]);

  // Poll latest every 30s
  useInterval(fetchLatest, 30000);

  // Refetch range for short ranges every 45s
  useInterval(() => {
    if (range === '1h' || range === '6h') loadRange();
  }, 45000);

  return { rangeData, bucketed, latest, insights7d, insights30d, compRows, presence, loading, error };
}

export function useCombinedData(range) {
  const [room1, setRoom1] = useState(null);
  const [room2, setRoom2] = useState(null);
  const [r1Range, setR1Range] = useState([]);
  const [r2Range, setR2Range] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const rcfg = RANGES[range];
      const [comb, r1, r2] = await Promise.all([
        apiGet('/combined'),
        apiGet('/range', { range, table: 'room_monitor' }),
        apiGet('/range', { range, table: 'esp32_monitor' }),
      ]);
      setRoom1(comb.room1);
      setRoom2(comb.room2);
      setR1Range(bucketize(r1.data || [], rcfg.bucketMin, 'gas_level'));
      setR2Range(bucketize(r2.data || [], rcfg.bucketMin, 'air_quality'));
    } catch (_) {}
    setLoading(false);
  }, [range]);

  useEffect(() => { load(); }, [load]);
  useInterval(load, 45000);

  return { room1, room2, r1Range, r2Range, loading };
}

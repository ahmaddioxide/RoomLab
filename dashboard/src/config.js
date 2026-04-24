export const API_BASE = 'https://home-lab-api.ahmadmahmood296.workers.dev';

export const RANGES = {
  '1h':  { ms: 1*60*60*1000,     bucketMin: 0,   label: 'last hour' },
  '6h':  { ms: 6*60*60*1000,     bucketMin: 0,   label: 'last 6 hours' },
  '24h': { ms: 24*60*60*1000,    bucketMin: 5,   label: 'last 24 hours' },
  '7d':  { ms: 7*24*60*60*1000,  bucketMin: 30,  label: 'last 7 days' },
  '30d': { ms: 30*24*60*60*1000, bucketMin: 180, label: 'last 30 days' },
};

export const GAS_BREAKPOINTS = [
  { gas: 0, score: 100 }, { gas: 100, score: 90 }, { gas: 300, score: 60 },
  { gas: 500, score: 40 }, { gas: 700, score: 20 }, { gas: 1024, score: 0 },
];

export const MOTION_OCCUPIED_MS = 2 * 60 * 1000;

export const CHART_TOOLTIP = {
  backgroundColor: 'oklch(0.16 0.012 55)',
  borderColor: 'oklch(0.28 0.012 55)',
  borderWidth: 1,
  titleColor: 'oklch(0.93 0.01 75)',
  bodyColor: 'oklch(0.93 0.01 75)',
  padding: 10,
  titleFont: { family: 'Nunito Variable, Geist Variable, sans-serif', size: 12, weight: '700' },
  bodyFont: { family: 'Geist Variable, sans-serif', size: 12 },
};

export const ROOM_CONFIG = {
  room1: { table: 'room_monitor', gasField: 'gas_level', accent: '190,140,70', color: 'oklch(0.72 0.12 70)', name: 'Room 1' },
  room2: { table: 'esp32_monitor', gasField: 'air_quality', accent: '120,170,110', color: 'oklch(0.68 0.10 155)', name: 'Room 2' },
};

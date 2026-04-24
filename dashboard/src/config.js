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
  backgroundColor: '#0a0e14',
  borderColor: '#2a323e',
  borderWidth: 1,
  titleColor: '#e6edf3',
  bodyColor: '#e6edf3',
  padding: 10,
  titleFont: { family: 'Inter', size: 12, weight: '600' },
  bodyFont: { family: 'JetBrains Mono', size: 12 },
};

export const ROOM_CONFIG = {
  room1: { table: 'room_monitor', gasField: 'gas_level', accent: '45,212,191', color: '#2dd4bf', name: 'Room 1' },
  room2: { table: 'esp32_monitor', gasField: 'air_quality', accent: '167,139,250', color: '#a78bfa', name: 'Room 2' },
};

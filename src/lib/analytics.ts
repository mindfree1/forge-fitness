import { database } from './db';
import type { PersonalBest } from './types';

export type ProgressRange = '7D' | '30D' | '12W' | '1Y';
export type StrengthMetric = 'e1rm' | 'maxWeight' | 'volume';

export type ConsistencyBucket = {
  key: string;
  label: string;
  value: number;
};

export type TrainingConsistency = {
  buckets: ConsistencyBucket[];
  totalSessions: number;
  sessionsPerWeek: number;
};

export type StrengthExerciseOption = {
  slug: string;
  name: string;
  lastTrainedAt: string;
  sessionCount: number;
};

export type StrengthSeriesPoint = {
  workoutId: number;
  date: string;
  value: number;
};

export type BodyweightSeries = {
  points: Array<{ id: number; date: string; value: number }>;
  latestKnown: { id: number; date: string; value: number } | null;
};

export type RecentAchievement = {
  id: number;
  exerciseSlug: string;
  exerciseName: string;
  metric: PersonalBest['metric'];
  value: number;
  previousValue: number | null;
  achievedAt: string;
};

export type MuscleVolumeRow = {
  muscle: string;
  volumeKg: number;
};

const RANGE_DAYS: Record<ProgressRange, number> = {
  '7D': 7,
  '30D': 30,
  '12W': 84,
  '1Y': 365,
};

export const progressRanges: ProgressRange[] = ['7D', '30D', '12W', '1Y'];

function startOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function localDayKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localMonthKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function shortDate(value: Date) {
  return value.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function shortMonth(value: Date) {
  return value.toLocaleDateString('en-AU', { month: 'short' });
}

export function getProgressWindow(range: ProgressRange, now = new Date()) {
  const days = RANGE_DAYS[range];
  const end = new Date(now);
  const start = addDays(startOfLocalDay(end), -(days - 1));
  return { start, end, days, startIso: start.toISOString(), endIso: end.toISOString() };
}

export function getRangeDescriptor(range: ProgressRange) {
  switch (range) {
    case '7D': return 'Last 7 days';
    case '30D': return 'Last 30 days';
    case '12W': return 'Last 12 weeks';
    case '1Y': return 'Last year';
  }
}

export function getStrengthMetricLabel(metric: StrengthMetric) {
  switch (metric) {
    case 'e1rm': return 'e1RM';
    case 'maxWeight': return 'Max Weight';
    case 'volume': return 'Volume';
  }
}

export async function getTrainingSpanSummary() {
  const db = await database();
  const row = await db.getFirstAsync<{ first_completed_at: string | null; total: number }>(
    `SELECT MIN(completed_at) AS first_completed_at, COUNT(*) AS total
     FROM workouts
     WHERE completed_at IS NOT NULL`,
  );

  if (!row?.total || !row.first_completed_at) return 'Start training to build your trends';

  const first = startOfLocalDay(new Date(row.first_completed_at));
  const today = startOfLocalDay(new Date());
  const days = Math.max(1, Math.floor((today.getTime() - first.getTime()) / 86_400_000) + 1);
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'} of training`;
  const weeks = Math.max(2, Math.ceil(days / 7));
  return `${weeks} weeks of training`;
}

export async function getTrainingConsistency(range: ProgressRange): Promise<TrainingConsistency> {
  const db = await database();
  const window = getProgressWindow(range);
  const rows = await db.getAllAsync<{ completed_at: string }>(
    `SELECT completed_at
     FROM workouts
     WHERE completed_at IS NOT NULL AND completed_at >= ? AND completed_at <= ?
     ORDER BY completed_at ASC`,
    window.startIso,
    window.endIso,
  );

  const completedDates = rows.map((row) => new Date(row.completed_at));
  const buckets: ConsistencyBucket[] = [];

  if (range === '7D') {
    for (let i = 0; i < 7; i += 1) {
      const date = addDays(window.start, i);
      const key = localDayKey(date);
      buckets.push({
        key,
        label: date.toLocaleDateString('en-AU', { weekday: 'short' }).slice(0, 1),
        value: completedDates.filter((item) => localDayKey(item) === key).length,
      });
    }
  } else if (range === '1Y') {
    const cursor = new Date(window.start.getFullYear(), window.start.getMonth(), 1);
    const last = new Date(window.end.getFullYear(), window.end.getMonth(), 1);
    while (cursor <= last) {
      const key = localMonthKey(cursor);
      buckets.push({
        key,
        label: shortMonth(cursor),
        value: completedDates.filter((item) => localMonthKey(item) === key).length,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    const bucketCount = range === '12W' ? 12 : Math.ceil(window.days / 7);
    for (let i = 0; i < bucketCount; i += 1) {
      const bucketStart = addDays(window.start, i * 7);
      const bucketEnd = addDays(bucketStart, 7);
      const value = completedDates.filter((date) => date >= bucketStart && date < bucketEnd && date <= window.end).length;
      buckets.push({ key: localDayKey(bucketStart), label: shortDate(bucketStart), value });
    }
  }

  const totalSessions = rows.length;
  return {
    buckets,
    totalSessions,
    sessionsPerWeek: Math.round((totalSessions / (window.days / 7)) * 10) / 10,
  };
}

export async function getStrengthExerciseOptions(): Promise<StrengthExerciseOption[]> {
  const db = await database();
  const rows = await db.getAllAsync<{
    slug: string;
    name: string;
    last_trained_at: string;
    session_count: number;
  }>(
    `SELECT e.slug, e.name, MAX(w.completed_at) AS last_trained_at,
            COUNT(DISTINCT w.id) AS session_count
     FROM workout_sets ws
     JOIN workouts w ON w.id = ws.workout_id
     JOIN exercises e ON e.id = ws.exercise_id
     WHERE w.completed_at IS NOT NULL
       AND ws.completed = 1
       AND ws.weight_kg IS NOT NULL AND ws.weight_kg > 0
       AND ws.reps IS NOT NULL AND ws.reps > 0
     GROUP BY e.id, e.slug, e.name
     ORDER BY last_trained_at DESC, session_count DESC, e.name ASC`,
  );

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    lastTrainedAt: row.last_trained_at,
    sessionCount: row.session_count,
  }));
}

export async function getStrengthSeries(
  exerciseSlug: string,
  metric: StrengthMetric,
  range: ProgressRange,
): Promise<StrengthSeriesPoint[]> {
  const db = await database();
  const window = getProgressWindow(range);
  const expression = metric === 'e1rm'
    ? 'MAX(ws.weight_kg * (1.0 + ws.reps / 30.0))'
    : metric === 'maxWeight'
      ? 'MAX(ws.weight_kg)'
      : 'SUM(ws.weight_kg * ws.reps)';

  const rows = await db.getAllAsync<{ workout_id: number; completed_at: string; metric_value: number }>(
    `SELECT w.id AS workout_id, w.completed_at, ${expression} AS metric_value
     FROM workout_sets ws
     JOIN workouts w ON w.id = ws.workout_id
     JOIN exercises e ON e.id = ws.exercise_id
     WHERE e.slug = ?
       AND w.completed_at IS NOT NULL
       AND w.completed_at >= ? AND w.completed_at <= ?
       AND ws.completed = 1
       AND ws.weight_kg IS NOT NULL AND ws.weight_kg > 0
       AND ws.reps IS NOT NULL AND ws.reps > 0
     GROUP BY w.id, w.completed_at
     ORDER BY w.completed_at ASC`,
    exerciseSlug,
    window.startIso,
    window.endIso,
  );

  return rows
    .filter((row) => Number.isFinite(row.metric_value) && row.metric_value > 0)
    .map((row) => ({ workoutId: row.workout_id, date: row.completed_at, value: row.metric_value }));
}

export async function getBodyweightSeries(range: ProgressRange): Promise<BodyweightSeries> {
  const db = await database();
  const window = getProgressWindow(range);
  const [rows, latest] = await Promise.all([
    db.getAllAsync<{ id: number; weight_kg: number; recorded_at: string }>(
      `SELECT id, weight_kg, recorded_at
       FROM weight_entries
       WHERE weight_kg > 0 AND recorded_at >= ? AND recorded_at <= ?
       ORDER BY recorded_at ASC, id ASC`,
      window.startIso,
      window.endIso,
    ),
    db.getFirstAsync<{ id: number; weight_kg: number; recorded_at: string }>(
      `SELECT id, weight_kg, recorded_at
       FROM weight_entries
       WHERE weight_kg > 0
       ORDER BY recorded_at DESC, id DESC
       LIMIT 1`,
    ),
  ]);

  return {
    points: rows.map((row) => ({ id: row.id, date: row.recorded_at, value: row.weight_kg })),
    latestKnown: latest ? { id: latest.id, date: latest.recorded_at, value: latest.weight_kg } : null,
  };
}

const metricPriority: Record<PersonalBest['metric'], number> = {
  weight: 0,
  e1rm: 1,
  volume: 2,
  reps: 3,
};

export async function getRecentAchievements(range: ProgressRange, limit = 6): Promise<RecentAchievement[]> {
  const db = await database();
  const window = getProgressWindow(range);
  const rows = await db.getAllAsync<{
    id: number;
    exercise_slug: string;
    exercise_name: string;
    metric: PersonalBest['metric'];
    value: number;
    achieved_at: string;
    previous_value: number | null;
  }>(
    `SELECT pb.id,
            e.slug AS exercise_slug,
            e.name AS exercise_name,
            pb.metric,
            pb.value,
            pb.achieved_at,
            (
              SELECT prior.value
              FROM personal_bests prior
              WHERE prior.exercise_id = pb.exercise_id
                AND prior.metric = pb.metric
                AND (prior.achieved_at < pb.achieved_at OR (prior.achieved_at = pb.achieved_at AND prior.id < pb.id))
              ORDER BY prior.achieved_at DESC, prior.id DESC
              LIMIT 1
            ) AS previous_value
     FROM personal_bests pb
     JOIN exercises e ON e.id = pb.exercise_id
     WHERE pb.achieved_at >= ? AND pb.achieved_at <= ?
     ORDER BY pb.achieved_at DESC, pb.id DESC
     LIMIT 80`,
    window.startIso,
    window.endIso,
  );

  const grouped = new Map<string, typeof rows[number]>();
  for (const row of rows) {
    const dayKey = localDayKey(new Date(row.achieved_at));
    const key = `${row.exercise_slug}:${dayKey}`;
    const existing = grouped.get(key);
    if (!existing || metricPriority[row.metric] < metricPriority[existing.metric]) grouped.set(key, row);
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.achieved_at.localeCompare(a.achieved_at) || b.id - a.id)
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      exerciseSlug: row.exercise_slug,
      exerciseName: row.exercise_name,
      metric: row.metric,
      value: row.value,
      previousValue: row.previous_value,
      achievedAt: row.achieved_at,
    }));
}

function normalizeMuscleGroup(raw: string) {
  const value = raw.toLowerCase();
  if (value.includes('chest')) return 'Chest';
  if (value.includes('lat') || value.includes('back')) return 'Back';
  if (value.includes('shoulder') || value.includes('delt')) return 'Shoulders';
  if (value.includes('bicep') || value.includes('tricep') || value.includes('arm')) return 'Arms';
  if (value.includes('quad') || value.includes('hamstring') || value.includes('glute') || value.includes('calf') || value.includes('leg')) return 'Legs';
  if (value.includes('core') || value.includes('ab')) return 'Core';
  return raw.trim() || 'Other';
}

export async function getMuscleGroupVolume(range: ProgressRange): Promise<MuscleVolumeRow[]> {
  const db = await database();
  const window = getProgressWindow(range);
  const rows = await db.getAllAsync<{ muscle_group: string; volume_kg: number }>(
    `SELECT e.muscle_group, SUM(ws.weight_kg * ws.reps) AS volume_kg
     FROM workout_sets ws
     JOIN workouts w ON w.id = ws.workout_id
     JOIN exercises e ON e.id = ws.exercise_id
     WHERE w.completed_at IS NOT NULL
       AND w.completed_at >= ? AND w.completed_at <= ?
       AND ws.completed = 1
       AND ws.weight_kg IS NOT NULL AND ws.weight_kg > 0
       AND ws.reps IS NOT NULL AND ws.reps > 0
     GROUP BY e.muscle_group`,
    window.startIso,
    window.endIso,
  );

  const totals = new Map<string, number>();
  for (const row of rows) {
    const group = normalizeMuscleGroup(row.muscle_group);
    totals.set(group, (totals.get(group) ?? 0) + row.volume_kg);
  }

  return Array.from(totals.entries())
    .map(([muscle, volumeKg]) => ({ muscle, volumeKg }))
    .filter((row) => row.volumeKg > 0)
    .sort((a, b) => b.volumeKg - a.volumeKg);
}

import * as SQLite from 'expo-sqlite';
import { todayWorkout } from './seed';
import type { Goal, PersonalBest, WeightEntry, WorkoutSession, WorkoutSet } from './types';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function database() {
  if (!databasePromise) databasePromise = SQLite.openDatabaseAsync('forge.db');
  return databasePromise;
}

export async function initialiseDatabase() {
  const db = await database();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS weight_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight_kg REAL NOT NULL,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      current_value REAL NOT NULL DEFAULT 0,
      target_value REAL NOT NULL,
      unit TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      equipment TEXT
    );

    CREATE TABLE IF NOT EXISTS workout_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      weight_kg REAL,
      reps INTEGER,
      completed INTEGER NOT NULL DEFAULT 0
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_set_unique
      ON workout_sets(workout_id, exercise_id, set_number);

    CREATE TABLE IF NOT EXISTS personal_bests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      achieved_at TEXT NOT NULL
    );
  `);

  for (const exercise of todayWorkout.exercises) {
    await db.runAsync(
      `INSERT OR IGNORE INTO exercises (slug, name, muscle_group, equipment)
       VALUES (?, ?, ?, ?)`,
      exercise.id,
      exercise.name,
      exercise.muscle,
      exercise.equipment,
    );
  }

  const weightCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM weight_entries');
  if (!weightCount?.count) {
    const values = [73.8, 73.5, 73.6, 73.2, 73.0, 72.9, 72.8];
    const dates = ['2026-07-13', '2026-07-20', '2026-07-27', '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24'];
    for (let i = 0; i < values.length; i += 1) {
      await db.runAsync('INSERT INTO weight_entries (weight_kg, recorded_at) VALUES (?, ?)', values[i], dates[i]);
    }
  }

  const goalCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM goals');
  if (!goalCount?.count) {
    const goals = [
      ['Dumbbell bench × 10', 'strength', 15, 20, 'kg'],
      ['Body weight', 'body', 72.8, 75, 'kg'],
      ['Strict pull-ups', 'strength', 4, 10, 'reps'],
      ['Training consistency', 'consistency', 3, 4, 'sessions/wk'],
      ['Daily steps average', 'steps', 8421, 10000, 'steps'],
    ];
    for (const goal of goals) {
      await db.runAsync(
        'INSERT INTO goals (title, category, current_value, target_value, unit) VALUES (?, ?, ?, ?, ?)',
        goal,
      );
    }
  }
}

export async function getWeights(): Promise<WeightEntry[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ id: number; weight_kg: number; recorded_at: string }>(
    'SELECT * FROM weight_entries ORDER BY recorded_at ASC, id ASC',
  );
  return rows.map((row) => ({ id: row.id, weightKg: row.weight_kg, recordedAt: row.recorded_at }));
}

export async function addWeight(weightKg: number) {
  const db = await database();
  await db.runAsync(
    'INSERT INTO weight_entries (weight_kg, recorded_at) VALUES (?, ?)',
    weightKg,
    new Date().toISOString(),
  );
}

export async function getGoals(): Promise<Goal[]> {
  const db = await database();
  const rows = await db.getAllAsync<{
    id: number;
    title: string;
    category: Goal['category'];
    current_value: number;
    target_value: number;
    unit: string;
    is_completed: number;
  }>('SELECT * FROM goals ORDER BY id ASC');
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    currentValue: row.current_value,
    targetValue: row.target_value,
    unit: row.unit,
    isCompleted: Boolean(row.is_completed),
  }));
}

export async function toggleGoal(id: number, completed: boolean) {
  const db = await database();
  await db.runAsync('UPDATE goals SET is_completed = ? WHERE id = ?', completed ? 1 : 0, id);
}

export async function getActiveWorkout(): Promise<WorkoutSession | null> {
  const db = await database();
  const row = await db.getFirstAsync<{
    id: number;
    name: string;
    started_at: string;
    completed_at: string | null;
  }>(`SELECT id, name, started_at, completed_at
      FROM workouts
      WHERE completed_at IS NULL AND started_at IS NOT NULL
      ORDER BY started_at DESC
      LIMIT 1`);
  if (!row) return null;
  return { id: row.id, name: row.name, startedAt: row.started_at, completedAt: row.completed_at };
}

export async function startWorkout(name: string): Promise<WorkoutSession> {
  const existing = await getActiveWorkout();
  if (existing) return existing;

  const db = await database();
  const startedAt = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO workouts (name, started_at) VALUES (?, ?)',
    name,
    startedAt,
  );
  return { id: Number(result.lastInsertRowId), name, startedAt, completedAt: null };
}

export async function finishWorkout(workoutId: number) {
  const db = await database();
  await db.runAsync(
    'UPDATE workouts SET completed_at = ? WHERE id = ?',
    new Date().toISOString(),
    workoutId,
  );
}

async function exerciseIdForSlug(slug: string) {
  const db = await database();
  const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE slug = ?', slug);
  if (!row) throw new Error(`Unknown exercise: ${slug}`);
  return row.id;
}

export async function getWorkoutSets(workoutId: number, exerciseSlug: string): Promise<WorkoutSet[]> {
  const db = await database();
  const exerciseId = await exerciseIdForSlug(exerciseSlug);
  const rows = await db.getAllAsync<{
    id: number;
    set_number: number;
    weight_kg: number | null;
    reps: number | null;
    completed: number;
  }>(
    `SELECT id, set_number, weight_kg, reps, completed
     FROM workout_sets
     WHERE workout_id = ? AND exercise_id = ?
     ORDER BY set_number ASC`,
    workoutId,
    exerciseId,
  );
  return rows.map((row) => ({
    id: row.id,
    workoutId,
    exerciseSlug,
    setNumber: row.set_number,
    weightKg: row.weight_kg,
    reps: row.reps,
    completed: Boolean(row.completed),
  }));
}

export async function saveWorkoutSet(set: WorkoutSet): Promise<PersonalBest['metric'][]> {
  const db = await database();
  const exerciseId = await exerciseIdForSlug(set.exerciseSlug);
  await db.runAsync(
    `INSERT INTO workout_sets (workout_id, exercise_id, set_number, weight_kg, reps, completed)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(workout_id, exercise_id, set_number)
     DO UPDATE SET weight_kg = excluded.weight_kg, reps = excluded.reps, completed = excluded.completed`,
    set.workoutId,
    exerciseId,
    set.setNumber,
    set.weightKg,
    set.reps,
    set.completed ? 1 : 0,
  );

  if (!set.completed || !set.weightKg || !set.reps) return [];

  const metrics: Array<[PersonalBest['metric'], number]> = [
    ['weight', set.weightKg],
    ['reps', set.reps],
    ['e1rm', set.weightKg * (1 + set.reps / 30)],
    ['volume', set.weightKg * set.reps],
  ];
  const achieved: PersonalBest['metric'][] = [];
  const achievedAt = new Date().toISOString();

  for (const [metric, value] of metrics) {
    const current = await db.getFirstAsync<{ value: number }>(
      `SELECT value FROM personal_bests
       WHERE exercise_id = ? AND metric = ?
       ORDER BY value DESC
       LIMIT 1`,
      exerciseId,
      metric,
    );
    if (!current || value > current.value) {
      await db.runAsync(
        'INSERT INTO personal_bests (exercise_id, metric, value, achieved_at) VALUES (?, ?, ?, ?)',
        exerciseId,
        metric,
        value,
        achievedAt,
      );
      achieved.push(metric);
    }
  }
  return achieved;
}

export async function getPersonalBests(exerciseSlug: string): Promise<PersonalBest[]> {
  const db = await database();
  const exerciseId = await exerciseIdForSlug(exerciseSlug);
  const rows = await db.getAllAsync<{
    metric: PersonalBest['metric'];
    value: number;
    achieved_at: string;
  }>(
    `SELECT pb.metric, pb.value, pb.achieved_at
     FROM personal_bests pb
     INNER JOIN (
       SELECT metric, MAX(value) AS max_value
       FROM personal_bests
       WHERE exercise_id = ?
       GROUP BY metric
     ) best ON best.metric = pb.metric AND best.max_value = pb.value
     WHERE pb.exercise_id = ?
     GROUP BY pb.metric
     ORDER BY pb.metric ASC`,
    exerciseId,
    exerciseId,
  );
  return rows.map((row) => ({ metric: row.metric, value: row.value, achievedAt: row.achieved_at }));
}

export async function getWorkoutHistory(limit = 10): Promise<WorkoutSession[]> {
  const db = await database();
  const rows = await db.getAllAsync<{
    id: number;
    name: string;
    started_at: string;
    completed_at: string | null;
  }>(
    `SELECT id, name, started_at, completed_at
     FROM workouts
     WHERE started_at IS NOT NULL
     ORDER BY started_at DESC
     LIMIT ?`,
    limit,
  );
  return rows.map((row) => ({ id: row.id, name: row.name, startedAt: row.started_at, completedAt: row.completed_at }));
}

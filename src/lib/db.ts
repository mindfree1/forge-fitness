import * as SQLite from 'expo-sqlite';
import type { Goal, WeightEntry } from './types';

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

    CREATE TABLE IF NOT EXISTS personal_bests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      achieved_at TEXT NOT NULL
    );
  `);

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

import { database } from './db';
import type { Goal } from './types';

export type GoalInput = Pick<Goal, 'title' | 'category' | 'currentValue' | 'targetValue' | 'unit'>;

const legacySeedGoals = [
  { id: 1, title: 'Dumbbell bench × 10', category: 'strength', targetValue: 20, unit: 'kg' },
  { id: 2, title: 'Body weight', category: 'body', targetValue: 75, unit: 'kg' },
  { id: 3, title: 'Strict pull-ups', category: 'strength', targetValue: 10, unit: 'reps' },
  { id: 4, title: 'Training consistency', category: 'consistency', targetValue: 4, unit: 'sessions/wk' },
  { id: 5, title: 'Daily steps average', category: 'steps', targetValue: 10000, unit: 'steps' },
] as const;

function normalize(input: GoalInput): GoalInput {
  return {
    title: input.title.trim() || 'New goal',
    category: input.category,
    currentValue: Number.isFinite(input.currentValue) ? Math.max(0, input.currentValue) : 0,
    targetValue: Number.isFinite(input.targetValue) ? Math.max(0.01, input.targetValue) : 1,
    unit: input.unit.trim() || 'units',
  };
}

export async function getPersonalGoals(): Promise<Goal[]> {
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

  return rows
    .filter((row) => !legacySeedGoals.some((seed) =>
      row.id === seed.id
      && row.title === seed.title
      && row.category === seed.category
      && row.target_value === seed.targetValue
      && row.unit === seed.unit
    ))
    .map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      currentValue: row.current_value,
      targetValue: row.target_value,
      unit: row.unit,
      isCompleted: Boolean(row.is_completed),
    }));
}

export async function createGoal(input: GoalInput) {
  const db = await database();
  const goal = normalize(input);
  const result = await db.runAsync(
    `INSERT INTO goals (title, category, current_value, target_value, unit, is_completed)
     VALUES (?, ?, ?, ?, ?, 0)`,
    goal.title,
    goal.category,
    goal.currentValue,
    goal.targetValue,
    goal.unit,
  );
  return Number(result.lastInsertRowId);
}

export async function updateGoal(id: number, input: GoalInput) {
  const db = await database();
  const goal = normalize(input);
  await db.runAsync(
    `UPDATE goals
     SET title = ?, category = ?, current_value = ?, target_value = ?, unit = ?
     WHERE id = ?`,
    goal.title,
    goal.category,
    goal.currentValue,
    goal.targetValue,
    goal.unit,
    id,
  );
}

export async function deleteGoal(id: number) {
  const db = await database();
  await db.runAsync('DELETE FROM goals WHERE id = ?', id);
}

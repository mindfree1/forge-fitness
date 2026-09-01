import { database } from './db';
import type { Goal } from './types';

export type GoalInput = Pick<Goal, 'title' | 'category' | 'currentValue' | 'targetValue' | 'unit'>;

function normalize(input: GoalInput): GoalInput {
  return {
    title: input.title.trim() || 'New goal',
    category: input.category,
    currentValue: Number.isFinite(input.currentValue) ? Math.max(0, input.currentValue) : 0,
    targetValue: Number.isFinite(input.targetValue) ? Math.max(0.01, input.targetValue) : 1,
    unit: input.unit.trim() || 'units',
  };
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

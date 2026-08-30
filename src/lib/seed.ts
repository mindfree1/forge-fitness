import type { Exercise } from './types';

export const todayWorkout = {
  title: 'Push Strength',
  subtitle: 'Chest · Shoulders · Triceps',
  duration: '55 min',
  exercises: [
    {
      id: 'dumbbell-bench-press',
      name: 'Dumbbell Bench Press',
      muscle: 'Chest',
      equipment: 'Dumbbells',
      target: '4 × 8–10',
      previous: ['15 × 10', '15 × 9', '15 × 8', '15 × 8'],
    },
    {
      id: 'incline-dumbbell-press',
      name: 'Incline Dumbbell Press',
      muscle: 'Upper chest',
      equipment: 'Dumbbells',
      target: '3 × 10',
      previous: ['12.5 × 10', '12.5 × 10', '12.5 × 9'],
    },
    {
      id: 'seated-shoulder-press',
      name: 'Seated Shoulder Press',
      muscle: 'Shoulders',
      equipment: 'Dumbbells',
      target: '3 × 8–10',
      previous: ['10 × 10', '10 × 9', '10 × 8'],
    },
    {
      id: 'cable-lateral-raise',
      name: 'Cable Lateral Raise',
      muscle: 'Side delts',
      equipment: 'Cable',
      target: '3 × 12–15',
      previous: ['5 × 15', '5 × 14', '5 × 12'],
    },
    {
      id: 'rope-pushdown',
      name: 'Rope Triceps Pushdown',
      muscle: 'Triceps',
      equipment: 'Cable',
      target: '3 × 10–12',
      previous: ['20 × 12', '20 × 11', '20 × 10'],
    },
  ] satisfies Exercise[],
};

export const weekActivity = [
  { day: 'M', done: true },
  { day: 'T', done: false },
  { day: 'W', done: true },
  { day: 'T', done: true },
  { day: 'F', done: false },
  { day: 'S', done: true },
  { day: 'S', done: false, today: true },
];

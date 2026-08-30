export type WeightEntry = {
  id: number;
  weightKg: number;
  recordedAt: string;
};

export type Goal = {
  id: number;
  title: string;
  category: 'strength' | 'body' | 'consistency' | 'steps';
  currentValue: number;
  targetValue: number;
  unit: string;
  isCompleted: boolean;
};

export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  target: string;
  previous: string[];
};

export type WorkoutSession = {
  id: number;
  name: string;
  startedAt: string;
  completedAt: string | null;
};

export type WorkoutSet = {
  id?: number;
  workoutId: number;
  exerciseSlug: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
};

export type PersonalBest = {
  metric: 'weight' | 'reps' | 'e1rm' | 'volume';
  value: number;
  achievedAt: string;
};

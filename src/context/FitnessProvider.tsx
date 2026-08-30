import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { addWeight as persistWeight, getGoals, getWeights, initialiseDatabase, toggleGoal as persistGoal } from '@/lib/db';
import type { Goal, WeightEntry } from '@/lib/types';

type FitnessContextValue = {
  ready: boolean;
  weights: WeightEntry[];
  goals: Goal[];
  latestWeight?: WeightEntry;
  addWeight: (value: number) => Promise<void>;
  toggleGoal: (id: number, completed: boolean) => Promise<void>;
};

const FitnessContext = createContext<FitnessContextValue | null>(null);

export function FitnessProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  async function refresh() {
    const [nextWeights, nextGoals] = await Promise.all([getWeights(), getGoals()]);
    setWeights(nextWeights);
    setGoals(nextGoals);
  }

  useEffect(() => {
    initialiseDatabase()
      .then(refresh)
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<FitnessContextValue>(() => ({
    ready,
    weights,
    goals,
    latestWeight: weights.at(-1),
    addWeight: async (weight) => {
      await persistWeight(weight);
      await refresh();
    },
    toggleGoal: async (id, completed) => {
      await persistGoal(id, completed);
      await refresh();
    },
  }), [ready, weights, goals]);

  return <FitnessContext.Provider value={value}>{children}</FitnessContext.Provider>;
}

export function useFitness() {
  const value = useContext(FitnessContext);
  if (!value) throw new Error('useFitness must be used within FitnessProvider');
  return value;
}

# Forge Training Guidance v5 — progressive overload, goal modes, and RIR

## Status
Draft implementation specification. This branch must remain unmerged until Progress v4 is stable on-device and V5 has passed real gym QA.

## Branch / PR contract
- Head: `feature/training-guidance-v5`
- Base: `feature/progress-v4`
- Do not recreate this work from `main`.
- V5 builds on the real workout history and analytics foundation introduced in V4.
- Keep the PR **draft** until physical-device QA confirms recommendations are sensible, explainable, and non-disruptive during an actual workout.

## Product goal
Move Forge from simply recording and visualising training to helping the user decide **what to do next**.

V5 should use the user's own completed-set history to generate conservative, explainable progressive-overload recommendations for each exercise while allowing the user to choose a training emphasis:
- **Strength**
- **Muscle**
- **Balanced**

The core experience should answer a practical gym question:

> Based on what I have actually lifted recently, what weight and rep target should I attempt today?

Forge must never invent history or present a recommendation with more certainty than the available data supports.

## Product principles
1. **Real history only.** Recommendations come from completed SQLite workout/set history.
2. **Explain every recommendation.** The user should be able to see why Forge suggested increasing, holding, or reducing load.
3. **Conservative progression.** One good or bad set should not cause a dramatic recommendation.
4. **Effort matters.** Rep performance alone is incomplete; V5 adds an easy post-set effort/RIR capture.
5. **Goal-aware, not goal-obsessed.** Strength, Muscle, and Balanced adjust progression logic without turning the program into a completely different app.
6. **Gym-speed UX.** Capturing effort must take roughly one tap and never block the workout.
7. **No fake precision.** If Forge does not know the user's available dumbbell/machine increment, say so rather than inventing an exact plate jump.
8. **Recommendations are guidance, not commands.** The user can always override the suggested load/reps.

## V4 foundation this depends on
V4 provides:
- real completed workout history
- completed working sets with weight and reps
- e1RM trends
- max-weight trends
- volume trends
- exercise metadata
- template target sets and rep ranges
- range-aware analytics
- physical-device gym QA workflow

V5 should reuse that foundation rather than creating a second analytics pipeline.

---

# 1. Training focus

## Options
Add a training-focus control with three values:

### Strength
Prioritises progressive load and strength performance.

Primary signals:
- e1RM trend
- completed-set load
- rep completion
- RIR / effort
- recent session consistency

Behaviour:
- favour smaller rep targets within the programmed range where appropriate;
- progress load once required reps are achieved with sufficient reserve;
- avoid unnecessary volume increases when load progression is available;
- do not recommend frequent max-effort lifting.

### Muscle
Prioritises hypertrophy-oriented double progression.

Primary signals:
- completed reps across all working sets
- weighted training volume
- RIR / effort
- consistency across recent sessions
- load progression secondarily

Behaviour:
- first progress reps through the configured range;
- once the user can repeatedly reach the top of the rep range at an appropriate effort, increase load;
- after a load increase, allow reps to fall back toward the bottom of the range;
- avoid encouraging every set to failure.

### Balanced
Default.

Combines load progression with sufficient rep/volume progression.

Behaviour:
- use the programmed rep range as the anchor;
- progress weight when the user demonstrates repeatable control near the upper half/top of that range;
- use e1RM and RIR to avoid progressing based on reps alone.

## Persistence
Preferred schema:
- add `training_focus` to the active `programs` record;
- allowed values: `strength`, `muscle`, `balanced`;
- default existing programs to `balanced` through an additive migration.

This should be program-level rather than global so a future user can maintain different programs with different goals.

## UI placement
Expose training focus in:
- My Program / program settings as the persistent source of truth;
- optionally a compact read-only badge on Train / recommendation surfaces;
- do not require changing focus before every workout.

---

# 2. RIR / post-set effort capture

## UX
Immediately after a working set is marked complete and weight + reps have been entered, show a compact modal/sheet:

**How hard was that set?**

Options:
- **Easy** — plenty left
- **Good** — challenging but controlled
- **Hard** — about one rep left
- **Max** — no reps left
- **Skip**

This is deliberately simpler than asking a casual user to type an exact RIR number.

The modal must:
- appear after completing a working set, not while editing weight/reps;
- take one tap to answer;
- dismiss immediately after selection;
- allow Skip;
- never prevent continuing the workout;
- not appear for an incomplete set;
- be easy to disable later if users dislike it.

## Approximate RIR mapping
Store a numeric estimate so recommendation logic is straightforward:
- Easy → `4` RIR (meaning approximately 4+)
- Good → `2` RIR (approximately 2–3)
- Hard → `1` RIR
- Max → `0` RIR
- Skip → `NULL`

The UI should continue showing the friendly labels rather than pretending the coarse mapping is more precise than it is.

## Persistence
Add nullable field to `workout_sets`:
- `rir INTEGER NULL`

Optional future field if needed:
- `effort_source TEXT` (`quick_scale`, `exact_rir`, etc.)

V5 does not need exact-RIR entry unless it becomes necessary during testing.

---

# 3. Load semantics — prerequisite for trustworthy recommendations

Forge must know what a logged weight means.

Examples:
- dumbbell bench `17.5 kg` normally means **17.5 kg per hand**;
- barbell bench `60 kg` normally means total bar load;
- cable/machine values are the displayed stack load;
- bodyweight movements may not have an external load.

Without this distinction, recommendation and comparison language can become misleading.

## Suggested exercise metadata
Add additive exercise metadata such as:
- `load_semantics`: `per_hand | total | machine | bodyweight | other`
- optional `load_increment_kg` nullable

Seed known Forge exercises appropriately.

For dumbbells, display recommendations as:
- `20 kg each hand`

Do not silently double the logged value for e1RM. Continue treating the user-entered load consistently per exercise; the UI explains its meaning.

---

# 4. Progressive overload recommendation engine

## Recommendation outputs
For a selected exercise, Forge should return one of:
- **Increase load**
- **Repeat load**
- **Build reps**
- **Reduce slightly**
- **Need more data**

Recommended payload should include:
- recommended weight, when safely calculable;
- target set count;
- target rep range or next-session rep target;
- training focus;
- confidence: `low | medium | high`;
- concise reason(s);
- optional caution when recent performance is inconsistent.

Example:

> **Recommended today: 20 kg each hand**  
> Target: 3 × 8–10  
> You reached 17.5 kg × 10/10/10 last session with Good effort and your e1RM has improved across three sessions.

Or:

> **Stay at 20 kg**  
> Target: build toward 3 × 8  
> Last session was 8/6/5 and the final two sets were Hard/Max.

## Historical window
Default recommendation history:
- last 3–5 completed sessions for the same exercise;
- only completed working sets;
- prioritize recent sessions while retaining enough history to identify trend;
- do not use in-progress workouts as historical evidence.

## Minimum data
With no prior valid session:
- do not invent a starting weight;
- show the configured program prescription and ask the user to choose a sensible starting load.

With one prior valid session:
- recommendation may suggest repeating/building reps;
- confidence must remain low;
- no aggressive load increase from a single data point unless the user explicitly overrides.

With 2–3+ consistent sessions:
- normal progression logic can activate.

---

# 5. Recommendation calculations

## Core set metrics
For every valid completed set:
- load = `weight_kg`
- reps = `reps`
- e1RM = `weight_kg * (1 + reps / 30)`
- volume = `weight_kg * reps`
- RIR = nullable user effort estimate

Per exercise session derive:
- max load
- best e1RM
- total weighted volume
- completed working sets
- min/average/max reps
- average RIR when available
- count of sets at `0–1 RIR`
- count of sets meeting programmed rep range

## Progress readiness score
Do not expose an opaque magic score as the primary UI, but internally combine signals into deterministic rules.

Signals should include:
- all/most prescribed sets completed;
- reps relative to min/max target;
- average RIR;
- e1RM trend across recent sessions;
- whether performance improved, held, or regressed;
- whether recent sessions were consistent rather than one-off spikes.

Prefer explicit rule branches over an inscrutable weighted ML score for V5.

---

# 6. Goal-specific progression rules

## Muscle — double progression
Default approach:
1. Hold load while the user works upward through the programmed rep range.
2. When all or nearly all prescribed sets reach the top of the range with controlled effort, recommend the next load increment.
3. At the new load, allow reps to return toward the lower end of the range.
4. Repeat.

Strong signal to increase:
- all prescribed work sets completed;
- all sets at/near top of rep range;
- average RIR roughly 1–3, not repeated `Max` sets;
- performance achieved on at least one strong session and preferably supported by the recent trend.

Example:
- target `3 × 8–10`
- 17.5 kg: `10 / 9 / 8` → Repeat / build reps
- 17.5 kg: `10 / 10 / 9` → Repeat / build final set
- 17.5 kg: `10 / 10 / 10`, Good/Good/Hard → Ready to increase

## Strength
Bias more toward load/e1RM progression.

Increase-load signal may occur before every set reaches the very top of a broad hypertrophy-oriented rep range if:
- minimum prescribed reps are comfortably achieved;
- RIR indicates reserve;
- e1RM is stable or improving;
- recent performance supports the jump.

Do not turn Strength into repeated 0-RIR/max-effort testing.

A conservative default load jump is approximately **2–5%**, then rounded to an available increment when known.

## Balanced
Use a hybrid threshold:
- prescribed sets completed;
- most sets in upper half of rep range;
- average effort Good/Hard rather than repeated Max;
- stable/improving e1RM;
- increase load conservatively.

Balanced should feel like the sensible default for a user who wants both a stronger and more muscular physique.

---

# 7. Exact recommended weight

## Available increment
The best exact recommendation depends on what weights the gym actually provides.

Use, in order:
1. user-configured `load_increment_kg` for that exercise;
2. infer a common historical increment only when repeated history makes it unambiguous;
3. otherwise calculate a target load and label it as approximate / next available increment.

Example when increment is known:
- current = 17.5 kg per hand
- dumbbell increment = 2.5 kg
- readiness = increase
- recommendation = `20 kg each hand`

Example when unknown:
- target progression = ~3%
- raw target = 61.8 kg
- UI = `Try the next available increment (target ~62 kg)`

Never recommend impossible precision such as `17.84 kg`.

## Upper jump guardrail
Unless the user explicitly overrides:
- do not recommend large jumps based on one session;
- cap ordinary automated progression to a conservative percentage band;
- require stronger evidence for larger increases.

---

# 8. Fatigue / regression handling

Forge should not interpret every poor session as lost strength.

If one session underperforms:
- normally recommend Repeat load;
- explain that the trend is still being assessed.

If multiple recent sessions regress and RIR is repeatedly Max/near-Max:
- recommend holding or a small reduction;
- avoid medical/injury diagnosis language.

Example:

> **Repeat 20 kg next time**  
> Your last session was below your recent average. One session is not enough to change the progression target.

Or after a persistent pattern:

> **Consider 17.5 kg next session**  
> Two recent sessions fell below the target reps at Hard/Max effort. Rebuild the rep target before progressing again.

---

# 9. Recommendation UI

## Exercise screen
Place a compact recommendation panel near the working-set prescription:

**Recommended today**
- recommended weight
- target reps/sets
- focus badge
- confidence indicator
- `Why?` disclosure

The recommendation must not replace editable set inputs.

Tapping the recommendation can prefill the first set weight, but only through an explicit user action.

## Why this recommendation?
Expandable explanation using real metrics, e.g.:
- `3/3 sets reached 10 reps last session`
- `Average effort: Good`
- `e1RM +5.4% over 3 sessions`
- `Ready for the next 2.5 kg increment`

This explainability is a major product requirement.

## Post-set effort modal
Trigger after set completion.

Suggested layout:
- title: `How hard was that set?`
- four large tap targets: Easy / Good / Hard / Max
- secondary `Skip`
- one-line helper on first use explaining reps-in-reserve

Do not use a fiddly numeric slider in the main flow.

---

# 10. Recommendation history / feedback loop

Store enough context to QA whether Forge's advice was useful.

Preferred V5 fields or lightweight event table:
- exercise
- recommendation generated at
- recommended load
- recommended rep target
- focus mode
- reason code(s)
- confidence
- whether user accepted/prefilled it

This history should not become a user-facing social score.

It exists so we can answer:
- Did users follow the recommendation?
- Did their next performance improve?
- Are we recommending increases too quickly?

If adding a new table feels too heavy for the first implementation, log deterministic recommendation inputs/results in development first and add persistence before final V5 sign-off.

---

# 11. Suggested code architecture

Suggested modules:
- `src/lib/trainingGuidance.ts`
- `src/lib/progression.ts`
- `src/components/training/TrainingFocusSelector.tsx`
- `src/components/training/RecommendationCard.tsx`
- `src/components/training/EffortModal.tsx`
- optional `src/components/training/RecommendationWhy.tsx`

Suggested types:
- `TrainingFocus = 'strength' | 'muscle' | 'balanced'`
- `EffortLabel = 'easy' | 'good' | 'hard' | 'max'`
- `ProgressionAction = 'increase' | 'repeat' | 'buildReps' | 'reduce' | 'needData'`
- `RecommendationConfidence = 'low' | 'medium' | 'high'`
- `ExercisePerformanceSession`
- `ProgressionRecommendation`

Keep the recommendation engine pure where possible:
- database layer fetches history;
- progression module receives normalized history + prescription + focus;
- pure function returns recommendation + reasons;
- UI renders it.

This makes calculations testable without a device.

---

# 12. Unit tests / deterministic fixtures

V5 needs actual calculation tests before gym QA.

Required scenarios:
- no history → Need more data
- one prior session → repeat/build, low confidence
- muscle `10/9/8 → 10/10/9 → 10/10/10` → increase only at appropriate threshold
- repeated Max sets → do not increase
- easy completion with reserve → progression can occur
- one bad session after good trend → do not automatically reduce
- sustained regression → hold/reduce conservatively
- strength focus progresses differently from muscle focus for same history
- balanced sits between the two
- skipped RIR still produces a recommendation with reduced confidence
- incomplete sets ignored
- incomplete workouts ignored
- null/bodyweight load excluded from weighted-load recommendations
- dumbbell per-hand semantics preserved
- unknown equipment increment does not create false precision

---

# 13. Physical gym QA

V5 is not complete until tested during real sessions.

## QA session A — baseline
- verify existing real history survives upgrade;
- confirm training focus defaults to Balanced;
- complete a real workout without changing normal behaviour;
- capture Easy/Good/Hard/Max after actual working sets;
- confirm effort capture takes one tap and does not become annoying;
- verify recommendations explain the history they used.

## QA session B — repeat exercise
- train at least one exercise with prior V5 data;
- compare recommendation against what the user would naturally choose;
- record whether weight suggestion is practical for gym equipment;
- verify accepted/ignored recommendations do not corrupt logging;
- confirm recommendation changes appropriately after the session.

## QA session C — focus comparison
For an exercise with sufficient history:
- inspect Strength recommendation;
- inspect Muscle recommendation;
- inspect Balanced recommendation;
- confirm differences are explainable rather than arbitrary;
- return the program to the desired focus after QA.

## Visual / interaction QA
- modal is thumb-friendly on Android;
- no keyboard collision;
- modal does not appear twice for same completed set;
- changing a previously completed set does not create confusing duplicate prompts;
- recommendation card does not crowd the main logging controls;
- text is readable in a busy gym at a glance.

---

# 14. Acceptance criteria

- User can select Strength, Muscle, or Balanced at program level.
- Existing programs migrate safely to Balanced.
- Completed working sets can optionally store RIR via Easy/Good/Hard/Max.
- Effort modal appears only after a valid set completion and can be skipped.
- Forge calculates recommendations only from real completed history.
- Recommendations distinguish increase / repeat / build reps / reduce / need data.
- Muscle mode implements double progression.
- Strength mode gives greater weight to load/e1RM progression.
- Balanced combines rep completion, load, e1RM, and effort.
- Exact kg recommendation uses real/configured increments where available and avoids false precision otherwise.
- Recommendation includes a human-readable reason.
- Low-history recommendations show low confidence.
- One poor workout does not automatically trigger a reduction.
- Repeated Max effort prevents reckless automatic progression.
- Dumbbell load semantics are clear (`kg each hand`).
- User can ignore/override every recommendation.
- TypeScript passes.
- Expo Doctor passes.
- Android export passes.
- Real physical-device gym QA passes.
- PR remains draft until explicitly approved.

---

# Explicitly out of scope for V5
- AI/LLM-generated training plans
- injury diagnosis or rehabilitation guidance
- wearable recovery scores
- sleep-based readiness
- automatic deload weeks based on medical-style fatigue inference
- nutrition logging
- calorie/macronutrient targets
- cloud coaching/social features
- fully adaptive program generation

---

# V6 follow-on — Nutrition

The natural next layer after V5 is a **Nutrition** screen tied to the same goal and progress system.

V6 should be scoped separately after V5 is stable, but capture these product ideas now:
- Nutrition becomes a real first-class tab/screen rather than an unrelated calorie tracker.
- Align nutrition guidance to the active goal/training focus and observed progress.
- Show daily/weekly calorie and protein targets.
- Track bodyweight trend against intake rather than looking at food logging in isolation.
- Strength/Muscle/Balanced training goals can inform recommendations, but nutrition needs its own explicit goal such as gain / maintain / lose/recomp.
- Surface whether recent bodyweight direction is consistent with the selected goal.
- Prioritise protein, calorie consistency, and useful meal-level logging over micronutrient overload in the first version.
- Keep nutrition recommendations explainable and conservative.
- Do not infer a medical diet or eating-disorder treatment plan.
- Consider barcode/photo/food-database integrations only after the core workflow is clear.

Potential V6 screen hierarchy:
1. Today nutrition summary
2. Calories vs target
3. Protein vs target
4. Bodyweight trend context
5. Meal log
6. Weekly adherence
7. Goal-aligned insight

Do **not** create the V6 implementation branch from V4. When V6 starts, base it on the stable V5 lineage so training guidance and nutrition can share the same goal model cleanly.

---

# Suggested implementation order
1. additive schema migration for `training_focus`, `rir`, load semantics/increment
2. pure progression types and deterministic test fixtures
3. training-focus selector
4. post-set effort modal and persistence
5. exercise performance history normalizer
6. Muscle double-progression rules
7. Strength rules
8. Balanced rules
9. exact load/increment calculation
10. recommendation card + Why explanation
11. confidence/insufficient-data states
12. recommendation acceptance/override telemetry if needed
13. automated TypeScript/Expo/Android QA
14. physical-device gym QA across repeated sessions
15. keep draft until recommendation behaviour is explicitly approved

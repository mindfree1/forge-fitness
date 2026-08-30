# Forge Progress v4 — visual analytics dashboard

## Status
Implementation in progress on draft PR #3. The first real-data dashboard tranche is built. Automated static Android QA is green on the implementation commits and runs on every V4 push/PR update. This branch must remain unmerged until physical-device visual and gym QA are complete.

## Branch / PR contract
- Head: `feature/progress-v4`
- Base: `feature/training-programs-v3`
- Do not rebase or recreate this work from `main`.
- PR remains **draft** until the Progress screen has been visually QA'd on a physical Android device.

## Product goal
Turn the existing Progress tab into a premium, information-dense analytics dashboard that feels like a real training product rather than a collection of summary tiles.

The approved visual direction is the supplied Forge mockup: black background, stacked dark analytics cards, compact chart density, restrained blue/lime accents, rounded controls, strong numerical hierarchy, and a persistent bottom navigation. The mockup is the visual source of truth for hierarchy and density; this spec translates it into implementation rules for the current Forge Android codebase.

## First implementation checkpoint
Completed on `feature/progress-v4`:
- range-aware analytics layer in `src/lib/analytics.ts`
- `7D / 30D / 12W / 1Y` screen-level filtering
- completed-workout consistency aggregation
- strength exercise discovery from real completed weighted sets
- per-session `e1RM`, `Max Weight`, and `Volume` series
- range-filtered bodyweight series with latest-known fallback
- PB history with calculated prior-record deltas and same-exercise/day deduplication
- normalized muscle-group weighted volume
- reusable Progress analytics cards, selectors, line/bar charts, PB strip, muscle bars and state components
- V4 Progress screen wired to SQLite only
- loading, empty, partial-error, retry and stale-async protections
- removal of fresh-install synthetic weight history
- reset flow leaves tracking analytics genuinely empty instead of inserting a zero-weight sentinel
- GitHub Actions QA for TypeScript, Expo Doctor and Android export
- real gym QA checklist in `docs/qa/progress-v4-gym.md`

Physical-device visual QA remains the source of truth for visual polish and merge approval.

## Current repo baseline
`feature/training-programs-v3` provides the required data foundation:
- `workouts` with `started_at`, `completed_at`, and optional `template_id`
- `workout_sets` with exercise, set number, weight, reps and completion state
- `personal_bests` with `weight`, `reps`, `e1rm`, and `volume` metrics
- `weight_entries`
- `exercises` with muscle-group metadata
- existing SQLite persistence and persistent tab navigation

V4 replaces the simpler Progress presentation with range-aware analytics while preserving the underlying V3 training data model.

## Non-negotiables
1. **Real SQLite data only.** No hard-coded chart series, fake PBs, fabricated percentages or mock analytics values.
2. **No destructive migration of user history.** Existing workout, set, PB, weight and program data must survive.
3. **Pixel-first mobile layout.** The screen must be designed for a physical Android phone first, not a desktop/web approximation.
4. **Keep the existing Forge visual language.** Reuse `colors`, spacing, radii, typography and tab treatment where possible.
5. **Reusable analytics primitives.** Do not build every chart/card as bespoke one-off markup inside `progress.tsx`.
6. **All range changes update the relevant cards consistently.** A selected range is a screen-level state, not separate per-card time filters.
7. **No merge before visual QA.** Draft PR only.

## Data cleanliness
`initialiseDatabase()` previously seeded synthetic weight entries for a fresh install. Progress v4 no longer inserts those rows and must not rely on or introduce seeded analytics data.

Rules:
- do not insert demo `weight_entries` for new installs;
- do not create synthetic workouts, sets, PBs, streaks or chart points;
- do **not** automatically delete historical weight rows from existing installs because the current schema cannot safely distinguish seeded rows from legitimate user-entered rows;
- for QA devices that contain old seed data only, use the reset workflow to start from a known clean state;
- if a device contains real history that should be preserved, do not reset it just to make V4 visually cleaner.

## Screen anatomy

### Header
- primary title: **Your Progress**
- contextual training-span subtitle derived from completed workout history
- compact filter/settings affordance aligned right
- if no completed sessions exist, use `Start training to build your trends`

### Global range selector
- `7D`
- `30D`
- `12W`
- `1Y`
- default `12W`
- one `ProgressRange` shared by UI and queries
- all relevant analytics update from the same selected range

Range semantics:
- `7D`: trailing 7 calendar days
- `30D`: trailing 30 calendar days
- `12W`: trailing 84 days
- `1Y`: trailing 365 days

## Training consistency
- completed workouts only (`completed_at IS NOT NULL`)
- `7D`: one bar per day
- `30D`: weekly buckets including partial boundaries
- `12W`: one bar per week
- `1Y`: calendar-month buckets
- sessions/week = completed sessions / selected span in weeks
- in-progress workouts never count
- empty state remains inside the card shell

## Strength progression
Eligible exercises come only from real completed weighted sets with reps.

Metrics:
- `e1RM`: per completed set `weightKg * (1 + reps / 30)`, then max per workout/exercise session
- `Max Weight`: maximum completed-set weight per workout/exercise session
- `Volume`: sum of `weightKg * reps` per workout/exercise session

Rules:
- bodyweight/null-weight sets do not contribute to weighted volume
- default exercise is the most recently trained eligible exercise
- headline uses the latest in-range session value
- change compares first versus latest valid in-range session
- insight is computed only from valid real points
- one point prompts for another session rather than inventing a trend

Visual target:
- lime connected line + visible markers
- horizontal guides
- compact axis labels
- subtle area-fill treatment is optional polish if it can be added without making the Android chart fragile

## Bodyweight trend
- reads only actual positive `weight_entries`
- chart shows only entries inside the selected range
- headline can fall back to latest-known real weight when the range is empty
- delta compares first versus last in-range entry
- one weigh-in never produces a fake trend
- blue is the supporting analytics accent

## Recent PBs
- sourced from actual `personal_bests`
- real prior PB is queried for each exercise + metric
- displayed delta is current minus prior record only when a prior record exists
- otherwise display the record value
- same exercise/day is deduplicated so one set creating several PB metrics does not flood the strip
- `View all` continues to PB History

## Muscle balance
- aggregate `SUM(weight_kg * reps)` from completed weighted sets inside the selected range
- normalize semantically equivalent groups before rendering:
  - chest variants → Chest
  - lats/back variants → Back
  - shoulder/delt variants → Shoulders
  - biceps/triceps/arms → Arms
  - quads/hamstrings/glutes/calves/legs → Legs
  - core/abs → Core
- sort by real volume descending
- computed insight only when enough data exists

## Reusable implementation
V4 uses Forge-owned lightweight React Native primitives rather than a large chart dependency:
- `ProgressRangeSelector`
- `AnalyticsCard`
- `AnalyticsCardHeader`
- `LineChart`
- `BarChart`
- `MetricSelectPill`
- `InsightRow`
- `RecentAchievementStrip`
- `MuscleBalanceBars`
- `AnalyticsEmptyState`
- `AnalyticsErrorState`
- `AnalyticsSkeleton`
- `OptionPickerModal`

Range-aware queries live in `src/lib/analytics.ts`. `progress.tsx` owns selected range/exercise/metric and uses a request-id guard to prevent stale async responses overwriting newer selections.

## Loading / empty / error states
Every major card has an intentional state.

Empty-state actions:
- consistency → complete a workout
- strength → complete weighted sets with reps
- bodyweight → add a weigh-in
- PBs → set a first real record
- muscle balance → complete weighted working sets

Partial query failures log Progress-specific context and expose retry without blanking successful cards.

## Visual rules from approved mockup
- true black Forge background
- stacked dark cards with subtle borders
- compact 14–18 px card padding
- high-contrast white headings
- muted metadata
- lime for strength/progress/action emphasis
- blue for consistency/bodyweight
- rounded restrained pill controls
- editorial, precise charts
- no fake glass, neon glow or decorative 3D treatment
- enough bottom inset to clear the persistent tab bar

## Implementation status
1. ✅ analytics types and range/date primitives
2. ✅ stop fresh-install synthetic weight seeding
3. ✅ reusable analytics card/chart primitives
4. ✅ global range selector
5. ✅ training consistency query + bar chart
6. ✅ bodyweight query + blue trend chart
7. ✅ strength exercise/metric selectors + strength series/e1RM
8. ✅ recent PB strip with real prior-record deltas
9. ✅ muscle-group volume + normalization
10. ✅ loading / empty / partial-error / retry states
11. **Next:** physical-device visual polish against mockup
12. ✅ automated typecheck + Expo Doctor + Android export
13. **Next:** fresh preview APK and real physical-device/gym QA

## Acceptance criteria
- Progress visually follows the approved mockup hierarchy and density.
- all four ranges update relevant analytics.
- consistency uses completed SQLite workouts only.
- strength supports e1RM / Max Weight / Volume using real completed sets.
- e1RM uses `weight * (1 + reps / 30)`.
- bodyweight uses actual `weight_entries` only.
- PB deltas use actual prior PB history only.
- muscle balance uses actual completed weighted-set volume.
- no fabricated analytics values appear.
- new installs receive no synthetic weight history.
- existing user history is not destructively migrated.
- 0, 1 and many-point states are intentional and stable.
- TypeScript passes.
- Expo Doctor passes.
- Android export passes.
- fresh preview APK passes physical-device and gym QA.
- PR remains draft and unmerged until that QA is explicitly approved.

## Out of scope for v4
- Health Connect / wearable ingestion
- predictive strength forecasting
- AI training recommendations
- exercise substitution suggestions
- calorie/macronutrient analytics
- cloud sync
- social leaderboards
- desktop-first analytics redesign
- workout/program editing changes

## QA
The full real-use checklist is maintained in `docs/qa/progress-v4-gym.md`.

Minimum merge gate:
- automated QA green
- fresh Android preview installs
- at least one genuine workout flows end-to-end into Progress
- physical Android screenshot compared side-by-side with approved mockup
- data discrepancies fixed at the source rather than hidden with display-only values
- Today / Train / Goals / PB History / reset and exercise-media persistence regressions checked

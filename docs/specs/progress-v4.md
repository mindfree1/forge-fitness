# Forge Progress v4 — visual analytics dashboard

## Status
Implementation in progress on draft PR #3. The first real-data dashboard tranche is built and automated static Android QA is passing. This branch must remain unmerged until physical-device visual and gym QA are complete.

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

Automated checkpoints pass for the implemented V4 code. Physical-device visual QA is still required before merge and remains the source of truth for visual polish.

## Current repo baseline
`feature/training-programs-v3` already provides the required data foundation:
- `workouts` with `started_at`, `completed_at`, and optional `template_id`
- `workout_sets` with exercise, set number, weight, reps and completion state
- `personal_bests` with `weight`, `reps`, `e1rm`, and `volume` metrics
- `weight_entries`
- `exercises` with muscle-group metadata
- real Progress screen reads from SQLite
- current `getStrengthTrends()` and `getCompletedWorkoutCountSince()` analytics helpers
- current `ProgressSparkline`, `Card`, theme tokens and persistent tab navigation

The V4 implementation replaces the simpler Progress presentation with range-aware analytics while preserving the underlying V3 training data model.

## Non-negotiables
1. **Real SQLite data only.** No hard-coded chart series, fake PBs, fabricated percentages or mock analytics values.
2. **No destructive migration of user history.** Existing workout, set, PB, weight and program data must survive.
3. **Pixel-first mobile layout.** The screen must be designed for a physical Android phone first, not a desktop/web approximation.
4. **Keep the existing Forge visual language.** Reuse `colors`, spacing, radii, typography and tab treatment where possible.
5. **Reusable analytics primitives.** Do not build every chart/card as bespoke one-off markup inside `progress.tsx`.
6. **All range changes update the relevant cards consistently.** A selected range is a screen-level state, not separate per-card time filters.
7. **No merge before visual QA.** Draft PR only.

## Important data-cleanliness requirement
`initialiseDatabase()` previously seeded synthetic weight entries for a fresh install. Progress v4 no longer inserts those rows and must not rely on or introduce seeded analytics data.

Implementation requirement:
- do not insert demo `weight_entries` for new installs;
- do not create synthetic workouts, sets, PBs, streaks or chart points;
- do **not** automatically delete historical weight rows from existing installs because the current schema cannot safely distinguish seeded rows from legitimate user-entered rows;
- for QA devices that contain old seed data, use the existing reset/dev workflow to start from a known clean state rather than performing an ambiguous production deletion.

## Screen anatomy

### 1. Header
Target hierarchy:
- primary title: **Your Progress**
- secondary line: contextual training span, e.g. `12 weeks of training`
- compact settings/filter icon aligned right

Do not keep the current `Progress / Proof of work.` hierarchy in V4.

The subtitle is derived from real data where possible. If no completed sessions exist, use a neutral empty-state subtitle such as `Start training to build your trends`.

### 2. Global range selector
Segmented pill control directly below the header:
- `7D`
- `30D`
- `12W`
- `1Y`

Default: `12W`.

Selected state uses Forge lime accent with dark text. Unselected states remain dark/neutral.

Range semantics:
- `7D`: trailing 7 calendar days
- `30D`: trailing 30 calendar days
- `12W`: trailing 12 weeks / 84 days
- `1Y`: trailing 365 days

Use one `ProgressRange` type shared by queries and UI.

## Analytics cards

### 3. Training consistency
Card contents:
- icon + label `Training consistency`
- headline average such as `4.2 sessions / week`
- metric selector/control reading `Workouts`
- vertical bar chart
- x-axis labels appropriate to selected range

Bucket rules:
- `7D`: one bar per day
- `30D`: weekly buckets, including partial boundary weeks
- `12W`: one bar per week
- `1Y`: one bar per month

Calculation:
- count completed workouts using `completed_at`
- sessions/week = completed sessions divided by selected span in weeks, rounded to one decimal
- never count an in-progress workout

Empty state: keep the card shell and replace the chart with a concise prompt to complete the first workout.

### 4. Strength progression
This is the hero analytics card and should visually resemble the mockup's Dumbbell Bench Press card.

Controls:
- exercise selector populated only from exercises that have completed working-set data
- metric selector with:
  - `e1RM`
  - `Max Weight`
  - `Volume`

Default exercise:
1. most recently trained eligible exercise;
2. otherwise the eligible exercise with the most completed sessions.

Default metric: `e1RM`.

#### e1RM
Per completed working set:
`e1RM = weightKg * (1 + reps / 30)`

For each workout/exercise session, chart the maximum calculated e1RM from completed sets.

Headline value: latest in-range session e1RM.
Change pill: percentage change versus the first in-range session with valid data.

#### Max Weight
Per workout/exercise session, chart the maximum completed-set `weight_kg`.

Headline value: latest in-range session max weight.
Change pill: percentage change from first valid in-range session.

#### Volume
Per workout/exercise session:
`volume = SUM(weight_kg * reps)` for completed sets with non-null positive weight and reps.

Bodyweight/null-weight sets do not contribute to weighted volume in V4. Do not invent a substitute load.

#### Chart treatment
- line chart with visible data-point markers
- subtle area fill beneath the line is a visual-polish target if it can be implemented without making the chart fragile
- horizontal guide lines
- minimal axis labels
- lime accent for strength
- use real dates from the selected range

Below the chart show a concise computed insight, e.g.:
`Estimated 1RM is up 11.4% over 8 sessions`

Only show an insight when the calculation is valid. If only one valid point exists, say that more sessions are needed for a trend.

### 5. Bodyweight trend
Card contents:
- icon + `Bodyweight`
- headline latest in-range or latest-known weight
- delta summary, e.g. `down 0.8 kg in 30 days`
- unit control showing `kg`
- blue line chart with visible points and horizontal guides

Range behavior:
- chart only entries inside the selected date range;
- if there is a latest historical weight but no entry inside the range, show the latest value in the headline but treat the chart as empty for that range;
- delta compares first and last valid weight entries within the selected range.

Use blue as the secondary analytics accent so lime remains reserved for strength/progress emphasis.

### 6. Recent PBs / achievements strip
Compact horizontal card matching the mockup density.

Source data:
- `personal_bests` / `getPersonalBestHistory()`
- optional real computed training-streak achievement

Preferred content:
- latest meaningful PB events, deduplicated so the strip is not filled with four metrics from the same set/session;
- show exercise name, improvement/value, and date;
- when available, include longest completed-workout streak as an achievement tile.

Do not fabricate `+2.5 kg` style deltas. A displayed delta must be calculated against the prior PB for the same exercise + metric. If no prior PB exists, display the record value instead.

`View all` continues to open PB History.

On narrow devices the strip may horizontally scroll; avoid cramped four-column layouts.

### 7. Muscle balance
Card title: `Muscle balance`
Secondary label: selected range or a compact descriptor such as `Last 4 weeks` where applicable.
Metric control: `Volume` for V4.

Aggregate completed weighted training volume by `exercises.muscle_group`:
`SUM(weight_kg * reps)`

Display the leading muscle groups as horizontal bars sorted descending.

Canonical group normalization happens before rendering so semantically equivalent labels do not split into separate rows. Initial display order is data-driven, not hard-coded.

Each row:
- muscle label
- horizontal lime bar scaled to the maximum group value
- formatted total volume in kg

Insight line beneath the rows should be generated from the top groups, for example:
`Back and chest dominate your last 4 weeks.`

Only produce the sentence when enough data exists to make it useful.

## Reusable component plan
The V4 implementation uses a small analytics component layer rather than expanding one huge screen file.

Implemented analytics components:
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

The existing `Card` remains the base surface. Analytics-specific wrappers adjust density without globally changing other Forge screens.

### Chart rendering
The current V4 implementation uses Forge-owned lightweight React Native chart primitives rather than adding a large charting package. This keeps the first Android QA surface small and avoids dependency churn before physical-device testing.

Charts must handle:
- one point
- identical values / zero range
- sparse dates
- long labels
- zero values
- missing values
- different device widths

## Data/API layer
Range-aware analytics live in `src/lib/analytics.ts`, keeping `db.ts` focused on persistence and training operations.

Implemented models include:
- `ProgressRange`
- `ConsistencyBucket`
- `StrengthMetric = 'e1rm' | 'maxWeight' | 'volume'`
- `StrengthSeriesPoint`
- `BodyweightSeries`
- `RecentAchievement`
- `MuscleVolumeRow`

Implemented query/helper surface:
- `getTrainingSpanSummary()`
- `getTrainingConsistency(range)`
- `getStrengthExerciseOptions()`
- `getStrengthSeries(exerciseSlug, metric, range)`
- `getBodyweightSeries(range)`
- `getRecentAchievements(range, limit)`
- `getMuscleGroupVolume(range)`

Queries aggregate in SQLite where practical, then perform light shaping/normalisation in TypeScript.

## State model
`progress.tsx` owns:
- selected range
- selected strength exercise
- selected strength metric
- loading state
- partial error state
- loaded dashboard data

Reload when:
- screen gains focus;
- selected range changes;
- selected strength exercise changes;
- selected strength metric changes.

The implementation uses a request id guard so older async responses cannot overwrite newer selector results.

## Loading, empty and error states
Every analytics section has an intentional state.

### Loading
Card-shaped stable-height loading placeholders are used so the screen does not collapse while queries resolve.

### Empty
The hierarchy remains intact and explains the action that creates missing data:
- consistency → complete a workout
- strength → log completed sets with weight and reps
- bodyweight → add a weigh-in
- PBs → set a first record
- muscle balance → complete weighted working sets

### Error
Query failures are logged with Progress-specific context and the affected cards expose retry rather than silently swallowing failures.

A partial query failure does not blank the whole dashboard if other cards loaded successfully.

## Visual rules from approved mockup
- true black / Forge background behind cards
- dark cards with subtle borders rather than bright separators
- card radius slightly tighter visually than oversized marketing cards
- 14–18 px internal card padding range
- compact vertical rhythm so multiple analytics cards are visible in one scroll
- high-contrast white headings
- muted grey metadata
- lime = primary progress/strength/action accent
- blue = supporting data accent, primarily consistency/bodyweight
- pill controls use thin borders and restrained fills
- charts should feel editorial and precise, not playful
- no gradients except an extremely subtle chart-area fade if implemented cleanly
- no 3D effects, glossy shadows, fake glass or neon glow

## Navigation / safe area
Preserve the existing persistent tab bar and active Progress state.

The final analytics card must have enough bottom content inset that it is never obscured by the absolute tab bar.

Do not change unrelated tab structure as part of this PR.

## Accessibility / interaction
- touch targets at least ~44 dp where practical
- controls readable without relying on accent colour alone
- chart summary values available as text; the chart itself is supplementary, not the sole carrier of meaning
- numbers use locale-aware formatting where practical
- avoid tiny text below ~10–11 sp for essential content on Android

## Performance
The dashboard should remain smooth with several years of local workout history.

Requirements:
- query only the selected range where possible;
- aggregate before rendering rather than drawing every raw set;
- cap visible chart points through date/session aggregation, not arbitrary data deletion;
- memoize derived display data;
- avoid rerendering every card for unrelated selector changes when practical.

## Implementation order
1. ✅ analytics types and range/date primitives
2. ✅ stop fresh-install synthetic weight seeding
3. ✅ reusable analytics card/chart primitives
4. ✅ global range selector
5. ✅ training consistency query + bar chart
6. ✅ bodyweight query + blue trend chart
7. ✅ strength exercise/metric selectors + strength series/e1RM
8. ✅ recent PB/achievement strip using real PB history
9. ✅ muscle-group volume query + balance bars
10. ✅ loading / empty / partial-error / retry states
11. **Next:** physical-device visual polish against mockup
12. ✅ automated typecheck + Expo Doctor + Android export
13. **Next:** fresh preview APK and physical-device/gym QA

## Acceptance criteria
- Progress screen visually follows the approved mockup hierarchy and density.
- `7D / 30D / 12W / 1Y` works and updates all relevant analytics.
- Training consistency uses completed workouts from SQLite.
- Strength card can switch exercises and `e1RM / Max Weight / Volume`.
- e1RM uses `weight * (1 + reps / 30)`.
- Bodyweight chart uses actual `weight_entries` only.
- Recent PBs use actual PB history and calculated deltas only.
- Muscle balance uses actual completed-set volume joined to exercise muscle groups.
- No fabricated demo chart series or analytics values appear.
- New installs do not receive synthetic weight history.
- Existing user history is not destructively migrated.
- Loading, empty and error states exist for all major sections.
- Screen remains usable with 0, 1 and many data points.
- Bottom tab bar does not cover content.
- TypeScript passes.
- Expo Doctor passes.
- Android export passes before spending another EAS build.
- Latest preview APK passes physical-device visual QA.
- PR remains draft and unmerged until that QA is explicitly approved.

## Explicitly out of scope for v4
- Health Connect / wearable ingestion
- predictive strength forecasting
- AI training recommendations
- exercise substitution recommendations
- calorie/macronutrient analytics
- cloud sync
- social leaderboards
- desktop-first analytics redesign
- changing workout/program editing flows

## QA checklist
### Data
- empty/new database shows intentional empty states
- one workout / one weigh-in does not crash charts
- multiple sessions produce correct first/latest deltas
- incomplete workout is excluded from consistency
- incomplete sets are excluded from strength/volume
- PB delta is against the prior record for the same exercise + metric
- null-weight sets do not create fake weighted volume
- range boundaries include expected local calendar dates

### Visual
- compare physical Android screenshot side-by-side with approved mockup
- verify title, range pill, card sequence, density and spacing
- verify lime/blue accent balance
- verify chart labels do not collide
- verify cards do not clip at large Android font settings
- verify bottom-most content clears the tab bar
- verify 7D and 1Y both remain visually legible

### Regression
- Today screen loads
- Train screen loads
- Goals screen loads
- workout logging still writes sets/PBs
- PB History still opens
- reset tracking still works
- program/exercise configuration remains intact

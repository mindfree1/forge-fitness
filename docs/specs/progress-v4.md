# Forge Progress v4 — visual analytics dashboard

## Status
Implementation in progress on draft PR #3. The first real-data dashboard tranche is built. Automated static Android QA runs on every V4 push/PR update. This branch must remain unmerged until physical-device visual and gym QA are complete.

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

## Analytics contract

### Header
- **Your Progress**
- real training-span subtitle derived from completed workout history
- compact filter/settings affordance
- empty subtitle: `Start training to build your trends`

### Range selector
- `7D` = trailing 7 calendar days
- `30D` = trailing 30 calendar days
- `12W` = trailing 84 days
- `1Y` = trailing 365 days
- default `12W`
- one screen-level range drives all relevant cards

### Training consistency
- completed workouts only
- 7D daily bars
- 30D weekly buckets including partial boundaries
- 12W weekly bars
- 1Y calendar-month buckets
- sessions/week = completed sessions / selected span in weeks
- in-progress workouts never count

### Strength progression
Eligible exercises come only from completed weighted sets with valid reps.

Metrics:
- `e1RM = weightKg * (1 + reps / 30)` per completed set; chart max e1RM per workout/exercise session
- `Max Weight` = max completed-set weight per workout/exercise session
- `Volume` = sum of `weightKg * reps` per workout/exercise session

Rules:
- null/nonpositive weights/reps do not contribute
- default exercise is most recently trained eligible exercise
- headline uses latest in-range value
- change compares first versus latest valid in-range session
- one point never invents a trend

### Bodyweight
- actual positive `weight_entries` only
- chart only entries inside selected range
- latest-known real weight may be shown when range is empty
- delta is first versus last in-range entry
- one point never invents a trend

### Recent PBs
- actual `personal_bests` only
- query prior PB for the exact exercise + metric
- display a delta only when a prior record exists
- otherwise display record value
- dedupe same exercise/day events so one set does not flood the strip

### Muscle balance
- completed weighted-set `SUM(weight_kg * reps)` only
- normalize chest/back/shoulders/arms/legs/core variants before rendering
- sort descending by real volume
- compute insight only from enough actual data

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

## Visual target
- true black Forge background
- stacked dark cards with subtle borders
- compact 14–18 px card padding
- high-contrast white headings
- muted metadata
- lime for strength/progress/action emphasis
- blue for consistency/bodyweight
- rounded restrained pill controls
- connected lines with point markers and horizontal guides
- enough bottom inset to clear persistent navigation
- subtle strength area fill can be evaluated during device polish rather than forcing a chart dependency before QA

## Implementation status
1. ✅ analytics types and range/date primitives
2. ✅ stop fresh-install synthetic weight seeding
3. ✅ reusable analytics card/chart primitives
4. ✅ global range selector
5. ✅ training consistency query + bar chart
6. ✅ bodyweight query + blue trend chart
7. ✅ strength exercise/metric selectors + e1RM/max/volume series
8. ✅ recent PB strip with real prior-record deltas
9. ✅ muscle-group volume + normalization
10. ✅ loading / empty / partial-error / retry states
11. **Next:** physical-device visual polish against mockup
12. ✅ automated typecheck + Expo Doctor + Android export on implementation checkpoint
13. **Next:** fresh preview APK and real physical-device/gym QA

## Acceptance criteria
- approved mockup hierarchy and density are reproduced closely on Android
- all four ranges update relevant analytics
- all analytics use actual SQLite history only
- new installs receive no synthetic bodyweight history
- reset creates genuinely empty tracking history
- existing legitimate user history is not destructively migrated
- 0, 1 and many-point states remain stable
- TypeScript, Expo Doctor and Android export pass
- fresh preview APK installs and runs
- at least one genuine gym workout flows end-to-end into Progress
- physical screenshot is compared side-by-side with approved mockup
- any data discrepancy is fixed at the data/query layer, not covered with fake display values
- PR remains draft and unmerged until explicit visual/gym QA approval

## Out of scope for v4
- Health Connect / wearable ingestion
- predictive strength forecasting
- AI training recommendations
- exercise substitutions
- calorie/macronutrient analytics
- cloud sync
- social leaderboards
- desktop-first redesign
- unrelated workout/program editing changes

## QA
The detailed real-use checklist lives at `docs/qa/progress-v4-gym.md`.

Regression gate includes Today, Train, Goals, PB History, workout logging, reset tracking, program rotation and persistence of exercise media/technique settings.

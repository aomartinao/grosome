# Redesign: Merge History & Reports into Unified Stats View

## 1. Current State Analysis

### History Page (`src/pages/History.tsx`)
Three tabs: **List**, **Week**, **Month**

| Tab | What it shows | Key components |
|-----|---------------|----------------|
| **List** | Chronological food entries grouped by day, with sleep/training indicators. Swipe-to-edit/delete. Grouped by date with protein totals and goal-met badges. | `HistoryList` |
| **Week** | Stacked bar chart (protein by meal type: breakfast/lunch/snack/dinner) with calorie line overlay. Stats: avg protein, goals hit, avg calories. Week-over-week trend. Click bar for day popover with "View day" link. MPS dots below bars. | `WeeklyChart` (uses Recharts) |
| **Month** | Calendar heatmap showing protein per day. Green highlight for goal-met days. MPS dots. Click day for popover with "View day" link. Monthly stats: protein avg, goals hit, calories avg. | `CalendarView` |

**Navigation:** Swipe left/right to navigate weeks/months. List scrolls vertically.

### Reports Page (`src/pages/Reports.tsx`)
Single scrollable page with 7d/30d toggle.

| Section | What it shows | Key components |
|---------|---------------|----------------|
| **Summary Cards** | Protein (avg/day + goals hit), Sleep (avg/night + goals hit), Training (session count). Uses `PillarCard`. | `PillarCard` x3 |
| **Protein Chart** | Weekly bar chart of protein values vs goal line. | `WeeklyPillarChart` |
| **Sleep Chart** | Weekly bar chart of sleep hours vs goal line. | `WeeklyPillarChart` |
| **Training Breakdown** | Horizontal bar chart showing muscle group distribution (Push/Pull/Legs/etc.) with percentages. | Inline JSX |

### Dashboard Homepage (`src/pages/Dashboard.tsx`)
- Shows **one day at a time** with left/right swipe navigation
- Progress ring(s) for protein (and optionally calories)
- Sleep + Training pillar cards for the selected day
- Quick stats: streak, MPS hits, entry count
- Scrollable food entry list with swipe-to-edit/delete
- "View full history" link at the bottom

### Current Navigation (`MobileNav.tsx`)
5 tabs: **Today** | **Coach** | **History** | **Reports** | **Settings**

---

## 2. Overlap & Redundancy Analysis

### What overlaps between History and Reports
| Feature | History | Reports | Notes |
|---------|---------|---------|-------|
| Protein weekly bar chart | Week tab (detailed, stacked by meal) | Protein chart (simple bars) | History's is better — stacked by meal + calorie line |
| Daily protein averages | Week/Month stats | Summary cards | Both compute and display this |
| Goals hit count | Week/Month stats | Summary cards | Both compute and display this |
| Calorie averages | Week/Month stats | Summary cards (no) | History has it; Reports shows protein avg only |
| Time range navigation | Swipe week/month back/forward | 7d / 30d toggle | Different interaction models |

### What's unique to each
| Feature | Unique to |
|---------|-----------|
| **Food entry list with edit/delete** | History (List tab) |
| **Calendar heatmap** | History (Month tab) |
| **Meal-type breakdown in bars** | History (Week tab) |
| **Calorie line overlay on protein chart** | History (Week tab) |
| **Week-over-week trend percentage** | History (Week tab) |
| **Sleep summary card + chart** | Reports |
| **Training summary card + breakdown** | Reports |
| **30-day range option** | Reports |
| **Muscle group distribution chart** | Reports |

### What overlaps with the Dashboard
- Dashboard shows **single-day detail** with day swiping — this is the primary way to review past days
- History List tab duplicates this: it also shows per-day food entries with edit/delete
- History's Week/Month views provide the **aggregate** view that Dashboard lacks

---

## 3. Proposed New Structure: Unified "Stats" Page

### Core Insight
The user has **two distinct needs** that map to two views:
1. **"How am I doing this week/month?"** — Aggregate trends and insights across all 3 pillars
2. **"What did I eat/do on day X?"** — Individual day review (already served by Dashboard swiping)

The History List tab is redundant with Dashboard day-swiping. The Week and Month views from History belong together with the Reports pillar summaries as one unified Stats page.

### Proposed page: `/stats` (replaces both `/history` and `/reports`)

**Layout: Two tabs — "Week" and "Month"**

Each tab shows **all three pillars** (Protein, Sleep, Training) in a unified, scrollable view for that time range.

#### Week Tab
```
+--------------------------------------------------+
| [< prev]     This Week / Mar 3 - Mar 9    [next >] |
+--------------------------------------------------+
|                                                    |
| PILLAR SUMMARY CARDS (horizontal scroll or grid)   |
| ┌─────────┐ ┌─────────┐ ┌─────────┐              |
| │ Protein │ │  Sleep  │ │Training │              |
| │ 142g avg│ │ 7h 20m  │ │ 3/4     │              |
| │ 5/7 hit │ │ 4/7 hit │ │sessions │              |
| └─────────┘ └─────────┘ └─────────┘              |
|                                                    |
| PROTEIN CHART                                      |
| [Stacked bar chart — breakfast/lunch/snack/dinner] |
| [Calorie line overlay if enabled]                  |
| [MPS dots below bars]                              |
| [Tap bar → popover with "View day" link]           |
|                                                    |
| SLEEP CHART (if enabled)                           |
| [Bar chart — hours per night vs goal]              |
|                                                    |
| TRAINING BREAKDOWN (if enabled)                    |
| [Muscle group distribution bars]                   |
| [Session list: "Mon: Push, Wed: Legs, Fri: Pull"] |
|                                                    |
+--------------------------------------------------+
```

#### Month Tab
```
+--------------------------------------------------+
| [< prev]     This Month / February       [next >] |
+--------------------------------------------------+
|                                                    |
| PILLAR SUMMARY CARDS                               |
| (Same as Week but with monthly aggregates)         |
|                                                    |
| CALENDAR HEATMAP                                   |
| [Existing CalendarView — protein per day]          |
| [Green = goal met, MPS dots, tap for details]      |
|                                                    |
| MONTHLY INSIGHTS                                   |
| - Best week vs worst week                          |
| - Consistency score (% of days tracked)            |
| - Month-over-month trend                           |
| - Sleep regularity index                           |
|                                                    |
+--------------------------------------------------+
```

### Why no "List" tab
- The List tab (chronological food entries with edit/delete) is **functionally identical** to swiping days on the Dashboard
- Users who want to review/edit a specific day should swipe on Dashboard or tap a day in the calendar → redirects to `/?date=YYYY-MM-DD`
- This eliminates the #1 source of redundancy

### Why no "30-day" toggle in Week view
- The Month tab replaces the need for a 30-day range
- Week = 7 days of detail charts. Month = calendar + monthly aggregates. Clean mental model.

---

## 4. Navigation Changes

### Current nav bar (5 items)
`Today` | `Coach` | `History` | `Reports` | `Settings`

### Proposed nav bar (4 items)
`Today` | `Coach` | `Stats` | `Settings`

**Benefits:**
- Removes one nav item — less cognitive load, larger tap targets
- "Stats" is a clearer label than "History" or "Reports" for what the page actually does
- 4-item nav is a common mobile pattern (fits well on all screen sizes)

**Icon:** `BarChart3` (currently used by Reports) — more intuitive for statistics than `Calendar`

### Dashboard "View full history" link
Rename to **"View stats"** and link to `/stats` instead of `/history`.

### Legacy routes
- `/history` → redirect to `/stats`
- `/reports` → redirect to `/stats`

---

## 5. How Homepage Day-Swiping Relates

The Dashboard's day-swipe is the **detail view** — it answers "what happened on Tuesday?"

The Stats page is the **trends view** — it answers "how am I doing this week/month?"

They complement each other:
- **Dashboard → Stats:** "View stats" link at the bottom of Dashboard
- **Stats → Dashboard:** Tap any bar (Week chart) or day (Month calendar) → navigate to `/?date=YYYY-MM-DD` to see that day's detail on Dashboard
- This creates a natural **drill-down / zoom-out** pattern that feels intuitive on mobile

No duplication. Clear separation of concerns.

---

## 6. Key Insights for Muscle-Building Users

The unified Stats page should surface insights that matter for the three pillars:

### Protein
- **Daily average vs goal** — Am I consistently hitting my target?
- **Meal distribution** (stacked bars) — Am I spreading protein across meals? (important for MPS)
- **MPS hits per day** — Am I getting 3+ protein-rich meals spaced correctly?
- **Week-over-week trend** — Am I improving or slipping?
- **Consistency score** — What % of days did I track / hit goal?

### Sleep
- **Average duration vs goal** — Am I getting enough?
- **Consistency** — Do I sleep similar amounts each night? (regularity matters more than occasional long sleeps)
- **Goal hit rate** — X out of 7 nights meeting the target
- **Chart shows variability** — easy to spot bad nights

### Training
- **Sessions this period vs goal** — Am I training enough?
- **Muscle group balance** — Am I skipping legs? Too much push? The distribution chart answers this
- **Training frequency pattern** — How many rest days between sessions?

---

## 7. Wireframe-Style UI Layout

### Stats Page — Week View (detailed)

```
┌──────────────────────────────────────┐
│ [<]    This Week    [>]              │  ← week navigation, swipeable
├──────────────────────────────────────┤
│                                      │
│  ┌──────┐  ┌──────┐  ┌──────┐      │  ← PillarCard row
│  │🥩142g│  │🌙7h20│  │💪3/4 │      │     protein / sleep / training
│  │5/7 ✓ │  │4/7 ✓ │  │ sess │      │     avg + goal hit count
│  └──────┘  └──────┘  └──────┘      │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ PROTEIN                      │   │  ← WeeklyChart (existing)
│  │ [stacked bars by meal type]  │   │     stacked bars + calorie line
│  │ --- goal line ---            │   │     tap bar → popover → view day
│  │ Mon Tue Wed Thu Fri Sat Sun  │   │
│  │ . .. .   ..  .       .  ...  │   │  ← MPS dots below
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ SLEEP                        │   │  ← WeeklyPillarChart (existing)
│  │ [bar chart — hours/night]    │   │     from Reports, now in context
│  │ --- goal line ---            │   │
│  │ Mon Tue Wed Thu Fri Sat Sun  │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ TRAINING BREAKDOWN           │   │  ← from Reports
│  │ Push     ████████░░ 40%  2   │   │     muscle group bars
│  │ Legs     ████░░░░░░ 20%  1   │   │
│  │ Cardio   ████░░░░░░ 20%  1   │   │
│  └──────────────────────────────┘   │
│                                      │
│              [padding for nav]       │
└──────────────────────────────────────┘
```

### Stats Page — Month View (detailed)

```
┌──────────────────────────────────────┐
│ [<]    February 2026    [>]          │  ← month navigation, swipeable
├──────────────────────────────────────┤
│                                      │
│  ┌──────┐  ┌──────┐  ┌──────┐      │  ← PillarCard row (monthly agg)
│  │🥩145g│  │🌙7h05│  │💪14  │      │
│  │22/28✓│  │18/28✓│  │ sess │      │
│  └──────┘  └──────┘  └──────┘      │
│                                      │
│  ┌──────────────────────────────┐   │
│  │  M  T  W  T  F  S  S        │   │  ← CalendarView (existing)
│  │           1  2  3  4         │   │     protein per day, green=goal
│  │  5  6  7  8  9 10 11        │   │     MPS dots, tap → popover
│  │ 12 13 14 15 16 17 18        │   │     popover has "View day"
│  │ 19 20 21 22 23 24 25        │   │
│  │ 26 27 28                    │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ MONTHLY INSIGHTS             │   │  ← NEW section
│  │                              │   │
│  │ Consistency: 89% days tracked│   │
│  │ Best week:  Feb 10-16 (152g) │   │
│  │ Trend: +5% vs January        │   │
│  │ Sleep regularity: Good       │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ TRAINING THIS MONTH          │   │  ← training breakdown
│  │ Push  ██████░░░░ 35%  5      │   │
│  │ Pull  █████░░░░░ 28%  4      │   │
│  │ Legs  ████░░░░░░ 21%  3      │   │
│  │ Cardio ██░░░░░░░ 14%  2      │   │
│  └──────────────────────────────┘   │
│                                      │
│              [padding for nav]       │
└──────────────────────────────────────┘
```

---

## 8. Migration Plan

### Components to KEEP (reuse as-is or with minor props changes)
| Component | Current location | Changes needed |
|-----------|-----------------|----------------|
| `WeeklyChart` | `components/history/WeeklyChart.tsx` | Move to `components/stats/` — no logic changes |
| `CalendarView` | `components/history/CalendarView.tsx` | Move to `components/stats/` — no logic changes |
| `WeeklyPillarChart` | `components/tracking/WeeklyPillarChart.tsx` | Keep in place, used by new Stats page |
| `PillarCard` | `components/tracking/PillarCard.tsx` | Keep in place, used by new Stats page |

### Components to REMOVE
| Component | Reason |
|-----------|--------|
| `HistoryList` | Redundant with Dashboard day-swiping. Users tap calendar day / chart bar → Dashboard. |

### Pages to CREATE
| File | Description |
|------|-------------|
| `src/pages/Stats.tsx` | New unified page combining History Week/Month + Reports pillar summaries |

### Pages to REMOVE
| File | Reason |
|------|--------|
| `src/pages/History.tsx` | Replaced by Stats |
| `src/pages/Reports.tsx` | Replaced by Stats |

### Files to MODIFY
| File | Change |
|------|--------|
| `src/App.tsx` | Replace `/history` and `/reports` routes with `/stats`. Add redirects for old routes. |
| `src/components/layout/MobileNav.tsx` | Replace History + Reports nav items with single "Stats" item. |
| `src/components/tracking/DailyProgress.tsx` | Change "View full history" to "View stats", link to `/stats`. |

### New components (optional, can be inline in Stats.tsx)
| Component | Description |
|-----------|-------------|
| `MonthlyInsights` | Consistency score, best/worst week, month-over-month trend, sleep regularity |

### Directory restructure
```
src/components/history/  →  src/components/stats/
  WeeklyChart.tsx              WeeklyChart.tsx (moved)
  CalendarView.tsx             CalendarView.tsx (moved)
  HistoryList.tsx              (deleted)
```

---

## 9. Implementation Order

1. **Create `Stats.tsx`** — Build the new page with two tabs (Week/Month), composing existing components
2. **Update routing** — Add `/stats` route, add redirects for `/history` and `/reports`
3. **Update MobileNav** — Replace two items with one "Stats" item
4. **Update DailyProgress** — Change "View full history" link
5. **Move components** — `history/` → `stats/`, delete `HistoryList.tsx`
6. **Delete old pages** — Remove `History.tsx` and `Reports.tsx`
7. **Add Monthly Insights section** — New feature for Month tab
8. **Test** — Verify all navigation flows, redirects, data display

---

## 10. Open Questions for Review

1. **Monthly Insights section** — Should we include the "best week", "consistency score", "month-over-month trend" in v1, or defer to a later iteration?
2. **Sleep chart in Week view** — Currently Reports shows a sleep chart for the last 7 days. Should the Week tab always show it, or make it collapsible to save scroll space?
3. **Training chart in Week view** — The muscle group breakdown is useful for 30d but may be sparse for a single week. Show it only if there are 2+ sessions?
4. **Calendar multi-pillar** — Currently the calendar only shows protein data. Should sleep/training data also appear (e.g., color-coded dots or icons for sleep/training)?
5. **Entry count in nav badge** — Should the Stats nav item show any badge/indicator (e.g., streak count)?

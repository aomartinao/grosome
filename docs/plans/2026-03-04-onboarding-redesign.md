# Onboarding Redesign Plan

**Date:** 2026-03-04
**Status:** Draft / Research Complete
**Scope:** First-time user experience from app open to first interaction

---

## 1. Current Flow Analysis

### Step-by-step walkthrough

The current onboarding is a 5-step wizard gated by `OnboardingGate` (wraps the entire app in `App.tsx`):

1. **Welcome Screen** — Shows the app name "grosome", a tagline ("Build and preserve muscle with three pillars"), and three pillar cards (Protein, Sleep, Training). Two CTAs: "Create free account" and "Log in". No skip option to try the app first.

2. **Protein Goal** — Stepper (+/- by 10g) with preset buttons (100g, 150g, 180g, 200g). Tip about 1.6-2.2g/kg body weight. Default: 150g.

3. **Sleep Tracking** — Toggle to enable, then choose nightly goal (6h/7h/8h/9h). Disabled by default.

4. **Training Tracking** — Toggle to enable, then choose sessions per week (2-6). Disabled by default.

5. **Complete** — Summary of chosen settings with a "Start Tracking" button.

After completion, user lands on the **Dashboard** (Today view) which shows an empty progress ring and "Tap here to log your first meal" text.

### Detection logic

- `OnboardingGate` checks `settings.onboardingCompleted` flag
- Existing users (with food entries in IndexedDB) are auto-skipped
- Returning users who sign in and sync data with existing entries are also auto-skipped
- Settings page has a "Re-run Onboarding" option under Data section

### What works well

- **Clean visual design** — Progress dots, icon cards, and the stepper UI are polished
- **Quick path** — Only 5 steps, can be completed in under 30 seconds
- **Smart returning-user detection** — Syncs data after auth and skips onboarding if entries exist
- **Sensible defaults** — 150g protein is a reasonable starting point
- **Optional features** — Sleep and training are off by default, reducing initial commitment

### What's confusing or missing

1. **No value proposition before asking for commitment** — The welcome screen lists features but doesn't explain *why* this app is different from MyFitnessPal or other trackers. The AI coach (the core differentiator) is never mentioned.

2. **Account creation is mandatory before seeing the app** — There's no "try first" option. Users must create an account or sign in before they can even set goals, let alone see the dashboard. This is high friction for a PWA that people might be testing.

3. **No context for goal setting** — The protein step shows a tip about g/kg bodyweight, but the user has no way to input their weight to calculate it. The presets (100-200g) are arbitrary without context.

4. **Empty dashboard after onboarding** — After completing setup, the user lands on an empty dashboard with zero guidance. The progress ring shows 0/150g. The only CTA is faint gray text: "Tap here to log your first meal." There's no explanation of *how* to log (text, photo, camera) or what the AI can do.

5. **Chat/Coach not introduced** — The primary interaction mode (the AI coach chat) is a separate tab the user has to discover. First-time users may not realize the coach exists or what it can do.

6. **No explanation of the three pillars** — While the welcome screen lists them, it doesn't explain the philosophy (protein for muscle, sleep for recovery, training for stimulus). Users who are new to this framework get no education.

7. **Smart greeting is lost** — The chat generates context-aware greetings (streak info, behind-schedule nudges, etc.) but for new users with zero data, the greeting has nothing to work with. There's no special first-time greeting that explains capabilities.

8. **Skip flow sets no defaults** — The "Skip" button on the welcome screen sets `onboardingCompleted: true` but keeps the default 150g goal without the user even seeing it. They arrive at a dashboard with a protein goal they never chose.

---

## 2. Research Findings

### Industry best practices

**Progressive disclosure beats upfront setup.** Modern mobile onboarding research consistently shows that revealing features gradually as users need them outperforms presenting everything upfront. Static onboarding screens that users passively swipe through have lower engagement than contextual, action-driven onboarding.

**The "aha moment" should come fast.** The most successful apps get users to their core value within 60 seconds. For a tracking app, this means logging their first item, not configuring settings. 77% of daily active users stop using an app within the first 3 days — the onboarding window is critical.

**Empty states are onboarding opportunities.** An empty dashboard should never feel empty. It should explain what will be there once populated, and provide a clear next step. The best empty states use illustration, positive framing ("Start by logging your first meal" vs "No entries yet"), and a prominent action button.

**Personalization creates buy-in.** Apps like MacroFactor ask detailed questions (weight, activity level, experience) and use the answers visibly — showing calculated macro targets rather than arbitrary defaults. This makes users feel the app is tailored to them. However, this must be balanced against length — MyFitnessPal keeps onboarding simpler and still succeeds.

**Let users try before asking for commitment.** Requiring account creation before any app interaction is a major drop-off point. The modern pattern is: let users try the core experience first, then prompt for account creation when they have data worth saving. Noom's behavioral coaching model works partly because users are invested in their answers before being asked to sign up.

### Competitor patterns worth noting

- **MacroFactor:** Deep onboarding (gender, weight, height, activity, training experience) used to calculate precise macro targets. Users understand *why* they're answering questions because they see the math.
- **MyFitnessPal:** Lighter onboarding (goal, basic metrics, activity level). Gets users to food logging fast. Uses a large food database as the hook.
- **Noom:** Psychology-forward onboarding with behavioral questions. Creates emotional investment before asking for commitment. Categorizes food by color (calorie density) rather than strict macros.

### Sources

- [VWO Mobile App Onboarding Guide (2026)](https://vwo.com/blog/mobile-app-onboarding-guide/)
- [UXCam Onboarding Flow Examples](https://uxcam.com/blog/10-apps-with-great-user-onboarding/)
- [LogRocket: Progressive Disclosure in UX](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/)
- [Smashing Magazine: Empty States in User Onboarding](https://www.smashingmagazine.com/2017/02/user-onboarding-empty-states-mobile-apps/)
- [NN/g: Designing Empty States](https://www.nngroup.com/articles/empty-state-interface-design/)
- [Toptal: Empty State UX Design](https://www.toptal.com/designers/ux/empty-state-ux-design)
- [Design Studio: Mobile Onboarding Best Practices (2026)](https://www.designstudiouiux.com/blog/mobile-app-onboarding-best-practices/)
- [MacroFactor vs MyFitnessPal Comparison](https://macrofactor.com/macrofactor-vs-myfitnesspal-2025/)

---

## 3. Proposed New Flow

### Philosophy

**"Show, then ask."** Let users experience the app's value before asking them to configure it. The AI coach is Grosome's differentiator — lead with it.

### Revised step sequence

#### Step 1: Welcome (keep, enhance)

**Current:** App name + 3 pillar cards + account creation buttons.

**Proposed changes:**
- Add a one-line hook that positions the AI: *"Your AI-powered coach for building and preserving muscle."*
- Replace the three static pillar cards with a brief value pitch:
  - "Tell me what you ate — I'll handle the tracking" (shows AI analysis capability)
  - "Photo a menu — I'll find the best protein picks" (shows photo feature)
  - "Ask me anything about nutrition and training" (shows coach capability)
- Add a **"Try it first"** button below the account creation CTA. This skips auth entirely and goes to goal setup, then the app. Account creation becomes a prompt later (e.g., after first food log, or on the settings page).
- Keep "Already have an account? Log in" for returning users.

**Why:** Users need to understand what makes this app worth trying before they commit to creating an account. The AI capabilities are the hook — surface them immediately.

#### Step 2: Quick Goal Setup (simplify)

**Current:** Three separate screens — protein, sleep, training.

**Proposed changes:**
- Combine into a **single screen** with the protein goal as the focus. Sleep and training are secondary toggles below.
- Add a **weight-based calculator**: "What's your weight?" input + a selector for target intensity (Moderate: 1.6g/kg, High: 2.0g/kg, Maximum: 2.2g/kg). Show the calculated protein goal, let users adjust from there.
- Keep the +/- stepper and presets as a fallback for users who don't want to enter weight.
- Remove the "Complete" summary screen — it's unnecessary when everything is on one page.

**Why:** Three separate screens for optional features adds friction. Most first-time users will only care about protein (the primary feature). Calculating from body weight makes the goal feel scientific rather than arbitrary. A single screen reduces the step count from 5 to 2.

#### Step 3: First Action Prompt (new)

**Current:** User lands on empty dashboard.

**Proposed changes:**
- After goal setup, navigate directly to the **Coach (chat) page** instead of the dashboard.
- Show a special first-time coach message:
  > "You're all set! Here's how I can help:
  > - Type what you ate (e.g., '2 eggs and toast')
  > - Take a photo of your meal
  > - Photo a restaurant menu for protein picks
  >
  > Try logging your first meal to see how it works."
- Show quick-reply chips: "Log breakfast", "Take a photo", "What should I eat?"
- This replaces the empty dashboard as the first thing users see.

**Why:** Getting users to their first successful log is the "aha moment." The chat interface is friendlier than an empty dashboard. Quick-reply chips reduce the cold-start problem of not knowing what to type.

### Enhanced Empty State (Dashboard)

When users do navigate to the Dashboard (Today tab) for the first time with zero entries:

**Current:** Empty progress ring at 0/150g + faint "Tap here to log your first meal" text.

**Proposed changes:**
- Replace the faint text with a **first-time card** inside the entry list area:
  - Heading: "Start your day"
  - Body: "Log your first meal to see your protein progress here. Tap the + button or chat with your coach."
  - Two action buttons: "Log a meal" (navigates to coach) and "Take a photo" (opens camera, then navigates to coach)
- The progress ring stays at 0g but with a subtle animation (pulse or shimmer) to signal it's waiting for data.
- After the first entry is logged, this card disappears permanently and normal entry list takes over.

**Why:** The empty state should be inviting, not blank. It should explain what will appear here and provide a clear path to populate it.

### Account Creation Prompt (deferred)

**Current:** Mandatory before any app use.

**Proposed changes:**
- After the user logs their first 1-2 food entries without an account, show a **non-blocking banner** at the top of the dashboard or a toast:
  > "Your data is stored locally. Create a free account to back it up and sync across devices."
  > [Create Account] [Maybe Later]
- Also show this prompt in Settings if no account exists.
- The coach can mention it conversationally after a few interactions: "By the way, your tracking data is only on this device right now. Want to create an account to keep it safe?"

**Why:** Users who have already experienced value are much more likely to create an account. Forcing auth upfront loses users who just want to try the app. Local-first (IndexedDB) architecture already supports this — the data is stored locally regardless.

---

## 4. Implementation Scope

### What changes

| Component | Change | Effort |
|-----------|--------|--------|
| `Onboarding.tsx` | Restructure welcome screen copy, add "Try it first", combine goal screens into one | Medium |
| `OnboardingGate.tsx` | Allow unauthenticated users through (skip auth requirement) | Small |
| `DailyProgress.tsx` | Replace empty "Tap here" text with first-time card component | Small |
| `UnifiedChat.tsx` | Add first-time welcome message with capability overview | Small |
| `unified.ts` (greeting) | Add a `daysTracked === 0` case to `generateSmartGreeting` | Small |
| New: `FirstTimeCard.tsx` | Empty state card component for dashboard | Small |
| New: `AccountPrompt.tsx` | Deferred account creation banner/toast | Small |

### What stays the same

- The auth system itself (Supabase auth, sync logic)
- Settings page (all goal editing stays there)
- The chat/coach AI analysis pipeline
- The progress ring, entry list, and all tracking UI
- Sleep and training tracking flows

### What to validate

- Can the app function fully without auth? (Yes — IndexedDB is the primary store, sync is optional)
- Does the AI coach work without auth? (Depends on API key — admin-provided key requires auth. Need to verify if proxy works for unauthenticated users)
- Will deferred auth break any sync assumptions? (The sync system already handles the "no user" case gracefully)

### Risk: AI access without auth

The AI analysis features require either a user-provided Claude API key or an admin-provided key (checked via Supabase `admin_users` table). If users skip auth, they won't have AI access unless they provide their own key. This is a significant limitation.

**Options:**
1. Allow limited AI access for unauthenticated users (e.g., first 3 analyses free via proxy) — requires backend change
2. Make the "try it first" flow focus on manual text logging only, with AI as the upgrade hook — simpler but less impressive
3. Keep auth required but move it to *after* the value pitch — compromise approach

**Recommendation:** Option 3 is the safest short-term approach. Restructure the welcome screen to explain value first, then require auth, then do quick goal setup, then land on coach. This preserves AI access while improving the value communication. Option 1 is better long-term but requires backend work.

---

## 5. Priority Order

If implementing incrementally:

1. **Rewrite welcome screen copy** — Biggest impact for smallest effort. Add AI coach positioning, capability examples. Keep auth requirement for now.
2. **Combine goal screens into one** — Reduce onboarding from 5 steps to 3 (welcome -> goals -> done).
3. **Land on Coach after onboarding** — Instead of empty dashboard, navigate to `/coach` and show first-time greeting.
4. **Improve dashboard empty state** — Replace faint text with actionable first-time card.
5. **Add "Try it first" flow** — Allow unauthenticated access (requires API access decision).
6. **Deferred account creation prompt** — Show after first few logs.

Items 1-4 can be done without any backend changes or auth modifications. Items 5-6 require decisions about API access for unauthenticated users.

---

## 6. Open Questions

- Should the weight-based protein calculator store the weight value, or just use it for calculation and discard? (Privacy consideration)
- Is there appetite for a "demo mode" that shows pre-populated data to demonstrate the app before real use?
- Should the onboarding mention the PWA install prompt, or handle that separately?
- How should the onboarding differ for users who arrive via a shared link vs organic discovery?

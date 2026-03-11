# Smart Quick Replies + Data-Driven Motivation

## Problem

1. **Generic greeting chips** ("Log a meal", "Motivate me") are vague and don't leverage the rich context already available
2. **Motivation responses are lame** — AI treats "Motivate me" as a generic question, returns cheerleading like "You've got this!" instead of data-anchored coaching

## Design

### Part 1: Smarter Greeting Quick Replies

Replace generic chip labels in `generateSmartGreeting()` with context-specific, actionable alternatives.

**Time-aware meal logging:**
- Before 11am: "Log breakfast"
- 11am-3pm: "Log lunch"
- 3pm-5pm: "Log a snack"
- After 5pm: "Log dinner"

**Replace "Motivate me" with "How am I doing?"** — reframes from passive cheerleading request to data inquiry, which the AI handles much better.

**Other chip improvements:**
| Current | New | Rationale |
|---------|-----|-----------|
| "Keep it going" | "Show my stats" | Actionable, data-oriented |
| "Suggest something" | "High-protein ideas" | More specific |
| "Analyze a menu" | "Scan a menu" | Clearer verb |

### Part 2: AI Motivation Prompt

Add a `## MOTIVATION & ENCOURAGEMENT` section to the system prompt in `buildUnifiedSystemPrompt()`.

**Instructions for AI:**

When user asks for motivation, encouragement, or "how am I doing":
1. Lead with their actual data (streak, consistency %, protein today, 7-day average)
2. Highlight one specific positive trend or achievement
3. Give one concrete, actionable next step
4. Keep it to 2-3 sentences max

**Anti-patterns to ban:**
- Generic cheerleading: "You've got this!", "Keep going!", "Believe in yourself!"
- Deficit framing: "You missed your goal", "You're behind"
- Repeating the UI header stats verbatim

**Example patterns:**

Data insight: "Your 7-day average is 165g — that's 87% of your goal, and it's been climbing. Your lunch game is especially strong."

Recovery: "Yesterday was light, but your 12-day average tells the real story: you're consistent. One day doesn't break a trend."

Tactical: "You're at 90g with dinner ahead. A chicken breast or salmon fillet would put you right at target."

Compound win: "8h sleep, protein on track, and you trained today. That's the trifecta for recovery."

## Files to modify

1. `src/services/ai/unified.ts` — `generateSmartGreeting()` chip labels + `buildUnifiedSystemPrompt()` motivation section

## Verification

1. Open chat at different times of day — verify time-aware chip labels
2. Tap "How am I doing?" — verify response references actual user data
3. Check various greeting scenarios still produce appropriate chips
4. `npx tsc --noEmit` passes

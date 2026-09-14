# Fantasy Guru Product Plan

## Product goal
Fantasy Guru should let a normal fantasy football manager make expert-quality decisions in about 30 seconds without needing to understand advanced analytics.

The analytics stay rigorous underneath. The default interface stays simple.

## Core product promise
**Tell me what to do with my fantasy team — and explain it simply.**

Fantasy Guru is not trying to win by displaying more data than FantasyPros, Fantasy Life, or Dynasty Nerds. It should win by turning league-specific data into better decisions with less work from the user.

## The Guru Recommendation Standard
Every recommendation must answer these questions, in this order:

1. **DECISION** — START, SIT, ADD, DROP, TRADE, HOLD, or WATCH.
2. **WHY** — one or two plain-English reasons.
3. **IMPACT** — what changes for the user's actual roster.
4. **CONFIDENCE** — High, Medium, or Low, based on evidence quality and decision margin.
5. **WATCH OUT** — only if a meaningful downside exists.
6. **ACTION** — the next useful action in the app.
7. **DETAILS** — advanced analytics available on demand, never required to understand the recommendation.

## Language standard
- Aim for roughly a fifth-grade reading level.
- Prefer short sentences and familiar football language.
- Do not lead with VORP, source counts, trade-value scores, market deltas, projection spread, or other microdata.
- Translate analytics into meaning first.
- Raw metrics belong behind **Details**, **Why?**, or **Advanced Analytics**.
- HOLD is a good answer when no move materially helps.
- Never manufacture a recommendation to make the product feel active.
- Never show fake precision. Estimated values must be clearly labeled as estimates.

## Decision engine rule
AI explains and connects the evidence. AI does not replace deterministic fantasy math.

The deterministic layer remains authoritative for:
- league scoring and roster rules
- weekly and ROS projections
- optimized starting lineups
- add/drop impact
- post-trade roster impact
- availability and ownership
- source confidence/disagreement
- market intelligence

Guru should use those outputs to explain the decision in simple language.

## Progressive disclosure
### Level 1 — Answer
Example: **START Terry McLaurin.**

### Level 2 — Explanation
Example: **He projects a little higher this week and has the safer role. This is a close call.**

### Level 3 — Evidence
Projection sources, ROS values, market signals, source disagreement, matchup analytics, utilization data, and other advanced metrics.

A beginner should never need Level 3. An expert should always be able to reach it.

## Product phases

### Phase 1 — Decision UX foundation
- Make Guru follow the Recommendation Standard.
- Make Start / Sit decision-first and hide microdata behind Details.
- Simplify Dashboard recommendation cards to Decision / Why / Impact / Confidence / Action.
- Establish shared visual language for START / SIT / ADD / DROP / TRADE / HOLD / WATCH.

### Phase 2 — Matchup as a game plan
- Default view answers: **How am I doing? What can still change? What needs attention?**
- Hide player microdata by default.
- Show injuries, lineup problems, projected swing players, and close-call decisions first.
- Keep full player analytics behind Details.

### Phase 3 — Player Hub as a decision center
- Default view answers: **What move actually improves my team?**
- Organize into Add, Trade, Compare, Watch — not raw datasets first.
- Every suggested add names the exact drop and team impact.
- Every trade names what the user gives, gets, and why the other manager might accept.
- Market activity supports recommendations but never becomes a recommendation by itself.

### Phase 4 — Season strategy
- Build a real playoff probability simulator before presenting playoff odds as authoritative.
- Add schedule-aware ROS planning and playoff-week strength.
- Add waiver-priority / FAAB strategy when data supports it.
- Add trade timing and roster-construction strategy.

### Phase 5 — Trust, speed, and production quality
- Consolidate presentation layers instead of stacking patches.
- Remove duplicate/legacy render paths.
- Profile heavy calculations and lazy-load deep analytics.
- Add recommendation audit/debug mode for testing.
- Track when Guru says HOLD vs recommends action.
- Add tests for roster optimization, add/drop logic, trade fairness, and recommendation wording.

## Success metrics
Fantasy Guru is succeeding when:
- a new user understands the recommended action in under 10 seconds;
- a user can make a strong league-specific decision in under 30 seconds;
- advanced users can inspect the evidence without cluttering the default view;
- recommendations improve the optimized roster, not just individual-player value;
- false-positive recommendations decrease;
- HOLD is used when the edge is marginal;
- the app feels fast and stable on desktop and mobile.

## North-star question
**Can someone who knows very little about fantasy football make an expert-quality decision in 30 seconds?**

If a feature does not improve that outcome, it is not a priority.

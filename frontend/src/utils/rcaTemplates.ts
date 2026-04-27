export const LITE_TEMPLATE = `## TL;DR

_(1-2 line summary of what happened, who was affected, and how it was resolved)_

## Timeline

_(bulleted, local time + UTC. Keep it terse — one event per line.)_

- \`HH:MM local / HH:MM UTC\` — _(event)_
- \`HH:MM local / HH:MM UTC\` — _(event)_

## Root cause

_(what actually broke and why)_

## Resolution

_(how it was mitigated and resolved)_

## Action items

_File each as a tracked issue in your work tracker (Jira / Linear / GitHub Issues / etc.) and link it back here._

- [ ] [TICKET-XXX](https://your-tracker.example.com/issues/XXX) — _(short description)_
- [ ] [TICKET-XXX](https://your-tracker.example.com/issues/XXX) — _(short description)_
`;

export const FULL_TEMPLATE = `> **TL;DR** — _(2-3 line summary: what broke, blast radius, how long it lasted, how we got out. This is what a busy reader gets in 10 seconds.)_

## Summary

_(What happened, in 1-2 lines per incident. If this RCA covers multiple linked incidents, list each briefly here.)_

## What was the impact?

_(User-facing impact, qualitative. What did your users actually experience?)_

## What is the consequence of impact?

_(Business consequence — bounce, churn, drop, revenue loss, SLO burn. Quantify where you can.)_

## Root cause - Five Whys

_(Walk the cause chain. Each "why" should bite into the previous answer.)_

1. **Why?** _(answer)_
2. **Why?** _(answer)_
3. **Why?** _(answer)_
4. **Why?** _(answer)_
5. **Why?** _(answer)_

## Immediate Resolution

_(What was done right away to stop the bleeding — rollback, restart, failover, config flip, manual intervention.)_

## Takeaways

### What went well?

_(Things that worked — runbook, comms, tooling, a teammate's quick thinking.)_

### What could have been better?

_(Gaps in tooling, runbook, alerting, ownership, comms.)_

### Where did we get lucky?

_(Things that could have been much worse but weren't, by luck rather than design.)_

## Action Items

### Immediate Fixes

_Tip: file each action item in your tracker (Jira / Linear / GitHub Issues) and paste the link below._

| Action Item | Status | Owner |
|---|---|---|
| _(short description — paste [TICKET-XXX](https://your-tracker.example.com/issues/XXX))_ | _(Open / In Progress / Done)_ | _(name)_ |

### Monitoring & Alerts

_Tip: file each action item in your tracker and paste the link below._

| Action Item | Status | Owner |
|---|---|---|
| _(short description — paste [TICKET-XXX](https://your-tracker.example.com/issues/XXX))_ | _(Open / In Progress / Done)_ | _(name)_ |

### Operational Excellence

_Tip: file each action item in your tracker and paste the link below._

| Action Item | Status | Owner |
|---|---|---|
| _(short description — paste [TICKET-XXX](https://your-tracker.example.com/issues/XXX))_ | _(Open / In Progress / Done)_ | _(name)_ |

### Fundamental Long-Term Investments

_Tip: file each action item in your tracker and paste the link below._

| Action Item | Status | Owner |
|---|---|---|
| _(short description — paste [TICKET-XXX](https://your-tracker.example.com/issues/XXX))_ | _(Open / In Progress / Done)_ | _(name)_ |

## Timeline

_All times in local + UTC. Chronological. Time to Detect / Respond / Resolve are computed from the structured timestamps above the body._

| Time | Event |
|---|---|
|  |  |
`;

---
alwaysApply: false
---

## Identity
You are the project's AI development assistant, acting as the **Change Classifier & SDD Steward for MidasCreed**, operating under **MC-DOS**. This rule is tool-agnostic — it applies regardless of which AI coding assistant is invoking it (Claude, Cursor, Antigravity, or otherwise), and regardless of which project it's running on.

This rule runs **before** `tasklist_rule.txt` or `setup_rule.txt` whenever new work is requested. Its job is to classify the change, update the SDD/workstream as needed, and tell the user which `@setup` chat to open next — **all in one pass, with no approval stop along the way.** Git makes every write here reversible; the system trusts the user to review what's shown and revert if it's wrong, rather than asking permission before writing it.

---

## When This Rule Applies
Invoked manually at the start of any new request, e.g. `@intake Add ordering` or `@intake Customers can't submit reviews on Safari`. Describe the change in plain language, or pre-tag it if you already know the category: `@intake [Fix] ...`.

Do not skip straight to `@tasklist` or `@setup` for anything beyond a trivial one-line fix.

---

## No Approval Gates in This Rule
Classification, SDD edits, and workstream edits all happen directly, in one pass, without stopping to ask. Specifically:
- **State the classification and reasoning, then proceed** — don't wait for confirmation. If a classification was pre-tagged and you disagree with it, say so explicitly and proceed with the one you believe is correct — disagreement still gets stated, it just doesn't block.
- **Apply SDD edits directly** once the redline is drafted — show the full `[PROPOSED ADD]`/`[PROPOSED EDIT]` redline in the response (this is the actual safety mechanism now — visibility, not a pause), then write it.
- **Apply workstream edits directly** — same logic.
- End every run with a single clear instruction: which `@setup` chat to open next, and nothing the user has to additionally type to get there.

Finishing the actual `git add`/`commit` for the SDD and workstream edits is left to the user — this rule edits the files and tells you what changed; it doesn't run git itself.

---

## Identifiers
- **Major Feature / Architectural Change, Minor Feature, Maintenance/Refactor** → numeric, e.g. `12.0`, in `/Docs/workstream.md`'s **Planned Roadmap** section.
- **Fix** → `F<n>.0` (e.g. `F2.0`), in the **Reactive Log** section of the same file.
- **Debug** → `D<n>.0` (e.g. `D2.0`), same section, single line only until resolved.

**Capsule log filenames are always `F<n>.0-<slug>.md` or `D<n>.0-<slug>.md`** — never the retired `FIX-<slug>.md` form.

---

## Why Branching Lives in `setup_rule.txt`, Not Here
An SDD/workstream edit is a documentation change — it gets committed directly by the user, no branch needed. The only work that needs a branch is code implementation, which doesn't start until `@setup`. So this rule never mentions branching; `setup_rule.txt` creates it, with literal commands, at the start of each `@setup` chat.

---

## Pipeline Overview (the five possible flows)

| Classification | SDD touched? | What happens here |
|---|---|---|
| Major Feature / Architectural Change | Yes — full/partial M.A.S.T.E.R pass, version bump | Redline applied directly → continue into `@tasklist` logic in this chat → end with "open `@setup <id>`" |
| Minor Feature | Yes — short addendum, no version bump required | Addendum applied directly → continue into `@tasklist` logic → end with "open `@setup <id>`" |
| Maintenance / Refactor | No | Continue into `@tasklist` logic directly → end with "open `@setup <id>`" |
| Fix | No | Reactive Log entry written directly → end with "open `@setup F<n>.0`" |
| Debug | No | Usually skip this rule entirely — use `@setup investigate` instead (see `setup_rule.txt`) |

---

## Source of Truth
1. Current SDD (`/Docs/SDD.md`)
2. Current `/Docs/workstream.md` — both sections
3. Current codebase
4. The user's description of the requested change

---

## Step 1 — Classify the Change
Read the SDD, workstream.md, and relevant code. State the classification and reasoning — then proceed regardless, per "No Approval Gates" above. Categories:

**Major Feature / Architectural Change** — introduces a new actor, a new data model, a new architectural component, or changes a stated NFR/tradeoff (consistency requirement, latency target, tier/entitlement boundary, core technology choice).
→ Full or partial M.A.S.T.E.R pass, SDD version bump.
→ If this supersedes an already-completed Planned Roadmap entry, create a **new** parent task and add `[SUPERSEDED BY <new-id>]` inline after the old entry's text — never edit or renumber it.

**Minor Feature / Enhancement** — extends an existing feature inside the current data model and architecture; no NFR or tradeoff implication.
→ Short SDD addendum, new Planned Roadmap entry.

**Maintenance / Refactor** — internal change with no user-facing behavior change and no change to any actor/data model/NFR already stated in the SDD.
→ No SDD change. Normal numeric Planned Roadmap entry.

**Fix** — corrects behavior to match what the SDD already says should happen.
→ No SDD change. Reactive Log entry.
→ If it closes an authorization, entitlement, or multi-tenancy enforcement gap, tag `Security-relevant: Yes`, `Priority: High`.

**Debug** — root cause unknown.
→ Prefer `@setup investigate: <description>` instead of starting here (see `setup_rule.txt`) — classifying something you haven't looked at yet has nothing real to decide.

If classification is ambiguous, say so and proceed with your best read of it.

---

## SDD Ownership
**Only this rule may edit `/Docs/SDD.md`.** `tasklist_rule.txt` and `setup_rule.txt` treat it strictly as read-only and report deviations rather than fixing them.

## Capsule Log Ownership
**This rule never creates, writes to, or otherwise touches anything under `/Docs/capsule-logs/`.** That directory belongs exclusively to `setup_rule.txt`, which creates a capsule log only when `@setup` actually begins work on a capsule. When this rule mentions a future capsule log filename (e.g. in Step 3d below), that is a **name being reserved for later reference** — text inside the Reactive Log entry, nothing more. Writing an actual file at that path here would be out of scope, full stop.

---

## Step 2 — Output a Change Report (informational, not a gate)

Render as a markdown table:

| Field | Value |
|---|---|
| Requested Change | `<description>` |
| Classification | `<category>` |
| Reasoning | `<why>` |
| SDD Sections Affected | `<e.g. M, A, T, R / none>` |
| Workstream Impact | `<new Planned Roadmap entry / new Reactive Log entry / none yet>` |
| Next Action | `<e.g. "Open a new chat: @setup 12.1">` |

Then proceed directly into Step 3 — this table documents what you did, it doesn't ask permission to do it.

---

## Step 3a — Major Feature/Architectural Change
- Walk through only the M.A.S.T.E.R sections affected.
- Show the full redline (`[PROPOSED ADD]`/`[PROPOSED EDIT]`) in this response.
- **Content-integrity check (mandatory, regardless of how confident you are):** before applying anything, diff the proposed new document against the current one section by section. Any section not named in the redline must appear in the new version completely unchanged — same features, same entities, same endpoints. If anything outside the stated change is missing, shortened, or altered, stop and call it out explicitly before applying — never let an addition silently carry a deletion along with it.
- Apply it directly to `/Docs/SDD.md`: increment the version in the SDD's own changelog block, one-line summary, inline `[SUPERSEDED BY ...]` if applicable.
- Continue directly into `tasklist_rule.txt`'s logic in this same chat — report Fresh/Extend Mode and what was added. **Confirm the new Planned Roadmap entry was actually appended before ending your turn** — a version bump in the SDD with no matching entry in `workstream.md` means the handoff silently failed partway.
- End with: "Open a new chat and run `@setup <id>`."

## Step 3b — Minor Feature
- Show and apply the short addendum directly.
- Continue into `tasklist_rule.txt`'s logic in this chat.
- End with: "Open a new chat and run `@setup <id>`."

## Step 3c — Maintenance/Refactor
- No SDD edit. Continue into `tasklist_rule.txt`'s logic directly, describing the work.
- End with: "Open a new chat and run `@setup <id>`."

## Step 3d — Fix
- Append directly to the Reactive Log: `F<n>.0`, date, symptom, affected area, root cause (if known), `Security-relevant: Yes/No`, `Priority`, and the **name** the capsule log will use once `@setup` creates it (`F<n>.0-<slug>.md`) — do not create that file here, it's a text reference only. Append one line to the Recent Activity Index.
- End with: "Open a new chat and run `@setup F<n>.0`."

## Step 3e — Debug (if invoked here instead of `@setup investigate`)
- Append a single line directly to the Reactive Log: `D<n>.0`, date, symptom. No subtasks, no capsule log yet — that gets created when investigation actually starts. Append one line to the Recent Activity Index.
- End with: "Open a new chat and run `@setup D<n>.0`" (equivalent to having started with `@setup investigate` directly).

---

## Developer Handoff Guarantee
Every classification decision and SDD redline must be legible to a developer who was not in this chat — state the reasoning, not just the conclusion. Without an approval pause, this legibility is the entire safety mechanism — don't compress it.

## End of Rule
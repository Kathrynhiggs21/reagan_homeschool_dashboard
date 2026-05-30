# reagan-homeschool-grading SKILL.md — Sixth Grade Update Runbook

**Why this matters:** The `reagan-homeschool-grading` skill (a Manus
user-managed Skill, lives in `/home/ubuntu/skills/reagan-homeschool-grading/`
on a fresh sandbox) currently documents 5th-grade grading expectations only.
When summer mode flips to grade 6 the skill has no guidance for the harder
6th-grade rubric, so AI grading runs on stale prompts.

## What's already in place (in this codebase)

- `server/_lib/seedSixthGradeLadder.ts` — 22 curated Ohio-aligned 6th-grade
  ladder rows with `OH.6.<strand>.<n>` codes and full-strand descriptions.
- `server/_lib/blockAutoAttach.ts` — picks 6th-grade rows when
  `effectiveSummerActive(date) === true`.
- `references/sixth-grade-summer-prep.md` — narrative guide for summer mode
  6th-grade work; covers Math + ELA priorities and Ohio mid-grade
  benchmarks.

The skill update is the AI-prompt-side counterpart: when the skill is
loaded by the grader and the active grade level is 6, the rubric expectations
should match.

## Steps for the user

1. Open `/home/ubuntu/skills/reagan-homeschool-grading/SKILL.md` (or wherever
   you maintain that skill) in your editor.
2. Add a new section **"6th Grade Adjustments"** under the existing 5th-grade
   rubric. Suggested content:

```markdown
## 6th Grade Adjustments (active when summer mode = on, or after promotion)

When the active grade level is 6, scale the rubric:

### Math
- Multi-step word problems: expect students to show work + check answer
  reasonableness, not just the right number.
- Fractions/decimals/percent: expect fluent conversion among forms.
- Ratios + proportions: brand new for 6th grade — accept developing-level work
  on first introduction.
- Negative numbers + integer ops: brand new — accept developing-level work.
- Algebraic thinking (variables, expressions): brand new — accept
  developing-level work.

### ELA
- Writing: expect 5-paragraph structure with thesis + evidence + counterpoint.
- Reading: expect identification of theme, character development, and author's
  craft (not just plot summary).
- Vocabulary: expect Greek/Latin root identification.

### Science (Ohio 6th-grade band)
- Earth's place in space (Sun, Moon, planets, gravity)
- Cells as the basic unit of life
- Force, motion, simple machines

### Social Studies (Ohio 6th-grade band)
- Ancient civilizations (Mesopotamia, Egypt, Greece, Rome, China, India)
- Geography of the Eastern Hemisphere
- Civic discourse + early government structures

### Mastery thresholds
Same as 5th grade — green ≥ 75, amber 40-74, rose < 40 — but the underlying
work is harder, so a green at 6th grade represents real readiness for 7th.
```

3. Save the file.
4. Reload the skill in any open Manus session that uses it
   (close the chat or call `/reload-skills`).
5. Mark the todo item as `[x]`.

## Cross-reference

For full Ohio 6th-grade scope detail beyond what fits in the skill, the
**13th doc** in `server/_lib/driveReferenceDocs.ts` (slug:
`ohio-standards-full-reference`) covers all four subjects with code-level
standards. Once Drive credentials land, this doc gets pushed into
`Curriculum and Resources/` for Mom + Grandma + tutors to reference too.

---
_Last updated: 2026-05-30_

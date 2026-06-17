# Theme reference notes — 2026-06-17

## Theme A — Bright & Colorful Card

Sources reviewed:
- `/home/ubuntu/upload/1000398363.jpg`
- `/home/ubuntu/upload/1000398361.jpg`
- `/home/ubuntu/upload/1000398340.jpg`
- `/home/ubuntu/upload/1000398338.jpg`

Key traits to carry into the new theme:
- Overall **light / off-white background** with strong readability.
- Panels read as **individual raised cards**, not flat sections.
- Cards use **large rounded corners** and **soft layered shadows** for a pop-out / floating look.
- Accent palette is **bright and playful**: purple, orange, yellow, green, pink, blue.
- Layout still needs clear contrast; the colorful cards sit on a calmer light surface.
- Some cards are full-color blocks, while others are pale surfaces with one strong colored accent.
- Shadow language is important: soft but noticeable, giving a lifted dashboard feel.

## Theme B — Glassmorphism

Confirmed by user: the **last 3 images** are the glass references.

Primary source reviewed so far:
- `/home/ubuntu/upload/1000398371.png`

Key traits to carry into the new theme:
- **Dark soft-focus backdrop** behind the UI.
- Panels are **translucent dark glass** with blur and subtle borders.
- Bright accent colors appear as **small glow / pill / gauge highlights** rather than full solid panels.
- Cards feel layered and premium; edges are softly rounded.
- Transparency should not reduce readability; text stays high-contrast.
- For the homeschool dashboard, safer adaptation is a **soft gradient background** rather than a photo, while preserving the frosted glass feel.

## Constraints to preserve in implementation

- No grey unreadable boxes.
- Text contrast must remain strong on every card.
- Theme must work across the full app, not just one hero panel.
- Reagan-facing surfaces should stay fun and clear, not moody or hard to read.
- Bright Card theme should feel cheerful and raised.
- Glass theme should feel frosted, translucent, and layered without relying on a photographic background.

## Pending inspection

Still to inspect directly in code:
- Current theme catalog and which theme besides `glass` should be replaced.
- Current CSS variable strategy in `client/src/index.css`.
- Current daily block rendering and worksheet button insertion points in `client/src/pages/Today.tsx` and related components.
- Remaining glass reference images:
  - `/home/ubuntu/upload/1000398370.png`
  - `/home/ubuntu/upload/1000398368.jpg`
- Worksheet visual references:
  - `/home/ubuntu/upload/1000398309.png`
  - `/home/ubuntu/upload/1000398297.png`


## Worksheet visual style (refs 309 + 297) — reviewed 2026-06-17

Ref 1000398309.png ("1st Grade MATH — Let's Learn and Have Fun!"):
- Big colorful title banner with a friendly mascot (cartoon pencil + a waving kid).
- Page split into numbered PARTS, each with its own colored header pill (purple, blue, green, orange, teal, pink).
- Each PART is a white card with a thin colored border matching its header.
- Mix of exercise types: fill-in tables, equation boxes, matching, color-the-fraction, word problems with little illustrations (balloons, fish bowl), pattern rows with shapes/emoji.
- Decorative confetti stars/sparkles scattered around.
- Header strip "Name / Date" box top-right.
- Footer "Skills Covered" ribbon with little icons.
- Encouraging mascot footer ("MATH IS EVERYWHERE! Keep practicing. You're doing great!").

Ref 1000398297.png (NewPath Homeschool Worksheets K-8):
- Grade 6-ish examples: "Landforms, Rocks & Soil" (Science), "Interpreting Graphs" (Math), "Parts of a Book" (ELA).
- Each worksheet: small subject tag in the corner (Sci/Math/ELA), colored header bar, numbered questions, small relevant photos/illustrations, multiple-choice + short answer.
- More grown-up than ref 309 but still colorful and friendly — appropriate target for 6th grade.

### Implication for the generator
The colorful worksheet PDF for a 6th grader should:
- Have a bright illustrated title banner (subject + topic) with a friendly mascot — but tuned to a 6th-grade tone (not babyish).
- Break the assignment into numbered PARTS / sections, each with a colored header pill and a matching bordered card.
- Use the actual block's assignment content (topic, subject, questions, reading pages, video description) — open directly to THAT block's content, not generic.
- Include a Name/Date header box, an encouraging mascot footer, and a "Skills Covered" style ribbon.
- Be fully printable (letter size), color, and grade-appropriate (6th in summer mode, else 5th).
- Build approach: HTML template -> render to PDF (so we get full color, borders, layout control) rather than hand-drawing in pdfkit. Reuse existing storagePut + /manus-storage proxy + publicProcedure pattern already used for printables.

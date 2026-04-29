# Red-pen Feedback — Pass 3 full redesign

## Reference images Reagan/Mom liked
- **1000332536.jpg (chosen favorite)** — "A Typical Daily Routine of an Online Student": crumpled-paper BG, simple rectangular frames with teal/green outline + drop shadow, clean all-caps serif TITLE inside each frame, ONE icon per card. Very clean, very readable.
- **1000332630.jpg** — "Jenny Wilson" course dashboard: white bg, thin blue sidebar, 3D colorful cards, purple/teal/orange/green character cards, simple sans-serif, calendar + assignments widgets on right.
- **1000332631.jpg** — "School Supplies for Homeschooling": thin teal border, white bg, friendly sans-serif.
- **1000332632.jpg** — HomeschoolMom: thin teal border, colored pencils, blue pill CTA, simple.

Target aesthetic: **clean white/cream school-planner** with **thin teal accents**, **ONE big icon per row**, **big clean title**, **minimal clutter**. NOT dark chalkboard anymore.

## Per-page red-pen notes

### Sticker Book (1000332544.png)
- "STICKER BOOK" — arrow pointing to header
- "DO NOT LIKE BACKGROUND" — kill the peach→coral ombre banner
- Drew a book layout at the bottom — wants an actual sticker-book shape (open book spread with sticker slots)

### This Week (1000332562.png)
- "Add" — arrow to header
- "Too much empty space" — day cards are empty placeholders, wants content or to shrink them

### Prize Shop (1000332565.png)
- X'd out several prizes on the left column — wants to REMOVE some defaults
- "Add own $ prizes" — parent-add custom dollar-value prizes

### Tutor Handoff (1000332568.png)
- "CANNOT READ CHANGE" on Trauma-Aware Rules box (red text on dark grey = unreadable)
- "DO NOT LIKE GREY BOXES" — kill grey card bg
- "Add to bottom" — arrow from accommodation block down to schedule; maybe move something to bottom
- Wants accommodations readable

### Bookshelf (1000332634.webp — circled)
- "WHY MULTIPLE DUPLICATES?" — 3 copies of same books visible
- Need hard dedupe

## Known issues still live
- Theme picker committed but NOT visible on published site (user published old checkpoint)
- Schedule rows still too bright in some views (maybe different component)
- Flock/Notes widget placement

## Action plan
1. Rebuild theme as **clean light "School Planner"** per ref
2. Simpler frames: white bg, thin 3px teal outer border, inset white, soft drop shadow — exact ref style
3. Kill peach→coral ombre banners on Sticker Book, Prize Shop, Today headers
4. Kill grey boxes on Tutor Handoff; readable text
5. Reconfigure This Week day cards: remove if empty, or fill with summary
6. Let parents add custom-dollar-value prizes; remove default prizes user X'd
7. Hard-dedupe bookshelf at DB level


## More red-pen notes (continued)

### Today (1000332575.png)
- "TOO GREEN" — pointing at Today nav item's green highlight
- X'd out the bottom row of widgets (Stickers/Coin pill, Brain Break card, Kiwi's note strip) — wants them NOT on Today or restructured
- Big box around the empty bottom area: "full width"
- "Separate page" — arrow from Today nav — maybe move things to separate pages
- "Good Morning, Reagan!" rainbow is okay but Today chip green is too bright

### Journal (1000332578.png)
- "Add stickers and prizes together" — integrate stickers+prizes with journal rewards?
- "Add to Timeline" — journal entries should show on Timeline page
- "Why notebook and sketchpad and journal?" — user is confused why 3 separate note things — consolidate to ONE journal page with tabs
- "Make 1 page w/ switches" — combine Notebook + Scratch Pad + Journal into a single page with tabs/switches

### Sticker Book (1000332586.png)
- "Sticker book?" — arrow pointing up — header is fine
- "DO NOT LIKE BACKGROUND" — ombre header bad
- Drew an open book layout at the bottom — wants sticker book page to LOOK like an open book (2-page spread with sticker slots)

### Bookshelf (1000332589.png)
- "x THIS" crossed out on "Your library"/"Bookshelf" header
- "DON'T LOVE THIS LOOK" — the vivid neon-outlined book cards look cheap

### About Me (1000332594.png)
- "Columns = more sections" — the long stacked scroll is bad; wants multi-column layout with more organized sections


## More pages reviewed

### Tutor Handoff (1000332597.png)
"Trauma-Aware Rules" red text on dark grey is unreadable — "CANNOT READ CHANGE." "DO NOT LIKE GREY BOXES." The accommodations list is stacked too densely. Red arrow from accommodations to bottom: "Add to bottom" — user wants accommodations at the bottom, not at top.

### Academics (1000332600.png)
"Are these dbs?" — confused that this looks like a raw database listing. "Why 4 of XYZ" — multiple MAP duplicates. "Better organize" — needs subject grouping, dedupe, collapsible year sections.

### Report Card (1000332603.png)
"Grades from school?" — wants report card to pull real grades (Academics page has MAP/MAZE/Acadience data); currently report card shows only dashes.

### Settings (1000332606.png)
"Make easier to check box" — Notification Recipients form is cramped. "What?" — Audit log section confusing to a parent user, either hide or explain.

### Printables (1000332609.png)
"All the same color" — all 28 source cards look identical (same dark tile with teal tags); needs variety/visual hierarchy. "Add divisions" — wants sources grouped by category (standards, math, reading, science, etc.), not one long undifferentiated grid.

## Summary of global directives
1. **Kill dark chalkboard theme entirely** — move to clean white/cream school-planner look per the reference images (crumpled-paper bg, teal outline frames, serif caps titles, one icon per row, soft drop shadows, minimal colors).
2. **Hard-dedupe bookshelf** at DB level; remove 1777379912525 test row
3. **Kill all peach→coral ombre banners** on every page — replace with calm chalk strip or serif title on paper
4. **Kill grey boxes** (Tutor Handoff)
5. **Merge Notebook + Scratch Pad + Journal** into ONE page with tabs
6. **Integrate Journal with Timeline**
7. **Today page**: move Stickers/Coins/Brain Break/Kiwi note OFF Today or to bottom; less green on active nav; full-width layout
8. **This Week**: shrink empty day cards or fill with content
9. **Prize Shop**: parent-add custom $ prizes; let parent remove defaults
10. **About Me**: multi-column/more sections instead of long stacked scroll
11. **Printables**: group sources by category with visual variety
12. **Academics**: dedupe entries, group by subject + year
13. **Report Card**: pull from Academics data not empty dashes
14. **Settings**: simplify, hide/explain Audit log
15. **Theme picker** must actually appear — user didn't see it because published version was old

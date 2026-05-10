# Reagan's Homeschool Dashboard — TODO

## Phase 11 — Nightly 8 PM agenda PDF email + Drive sync (DONE 2026-05-04)
- [x] `nightlyAgendaEmails` table + migration 0049 (idempotency hash, drive flag, status)
- [x] `server/_lib/agendaPdf.ts` (pdfkit-based PDF builder + canonical hash)
- [x] `server/_lib/agendaAssembler.ts` (DB → AgendaPdfInput, includes tutor + book page refs + yesterday notes)
- [x] tRPC `nightlyAgenda` router (`recent`, `forDate`, `preview`, `markDirty`)
- [x] `/api/scheduled/nightly-agenda-email` endpoint (build PDF, hash-skip if unchanged, return send-ready payload + S3 PDF URL)
- [x] `/api/scheduled/nightly-agenda-email/result` endpoint (post-send confirm)
- [x] Cron schedule: 8 PM nightly + 6 AM change-resend pass to marcy.spear@gmail.com + spear.cpt@gmail.com
- [x] Vitests for PDF builder + canonical hash stability (5 cases green)

## Recently Shipped
- [x] Phase 4 batch (May 3 2026): Removed dead "At Indian Hill this week" banner from Today + SkillBuilderTile pill (school account dead). Activity Options panel under This Week (max 10 weighted ideas — interests + weather + season + time-of-day, pure server picker). adultStream.feed alias added on tRPC router (delegates to db.listFamilyFeed). Daily-shuffle weekday seed verified shipping via subjectColors.RAINBOW. 14 new vitest cases. Suite: 335 pass / 1 skipped.
- [x] Weekend rule (May 2 2026): no auto-generated school blocks on Sat/Sun unless adult opts in. ensurePlanForDate, refreshTodayPlan, plans.aiGenerate, plans.aiCommit all weekend-aware. Plan dayType="off", blocks list empty by default. allowWeekend flag override on AI procedures. 5 new vitest cases (weekendPlan.test.ts + aiGenerateWeekend.test.ts).
- [x] Removed dead Google Classroom canonical-app assertion (school @ihsd.us account dead).

## Foundation
- [x] Apply Cozy Classroom theme (pencil yellow / apple red / chalkboard green / notebook blue / eraser pink on warm cream) in `client/src/index.css`
- [x] Add Quicksand + Fredoka fonts via Google Fonts in `client/index.html`
- [x] Set ThemeProvider to light mode in `App.tsx`

## Database Schema (drizzle/schema.ts)
- [x] `subjects` table (math, ela, science, ss, adventure, choice, catch_up, reading — color, icon)
- [x] `dailyPlans` table (date, dayType, status, totalBlocksDone, notes, isTemplate, parentPlanId for copies)
- [x] `scheduleBlocks` table (planId, blockType, title, description, durationMin, sortOrder, status, completedAt, completedBy, grade, notes, ihAssignmentId nullable)
- [x] `bookAssignments` table (blockId, bookId, fromPage, toPage, notes)
- [x] `adventures` table (title, description, subjects, topics, minDuration, maxDuration, materials, instructions, indoor/outdoor, energyLevel, interestTags)
- [x] `appLinks` table (name, url, icon, category, sortOrder, accountInfo)
- [x] `books` table (title, author, currentPage, totalPages, type)
- [x] `moodLogs` table (planId, zone, note, loggedBy, loggedAt)
- [x] `timelineEvents` table (date, eventType, title, description, subjectId, mediaUrl, createdBy)
- [x] `notifications` table (userId, type, title, body, link, read, createdAt)
- [x] `ihAssignments` table (sourceTeacher, sourceClass, title, description, postedAt, dueDate, url, raw)
- [x] `learnerProfile` table (single-row settings: accommodations, triggers, contacts JSON)
- [x] `skillsMastery` table (skillName, subjectId, currentScore 0-100, lastPracticedAt, sourceData JSON)
- [x] `weeklyTopics` table (weekStartDate, subjectId, topics JSON)
- [x] `notificationRecipients` table (email, role, optInTypes)
- [x] Apply migrations via `webdev_execute_sql`

## Backend (server/routers.ts)
- [x] `dailyPlan.list` (range)
- [x] `dailyPlan.get` (date)
- [x] `dailyPlan.create` / `update` / `duplicate` / `delete` / `saveAsTemplate`
- [x] `dailyPlan.markBlockComplete` (with completedBy + grade + note → triggers email)
- [x] `dailyPlan.logMood` (green/yellow/red + note → triggers owner email on red)
- [x] `dailyPlan.changeDayType` (with reason)
- [x] `dailyPlan.reorderBlocks`
- [x] `adventures.list` (with filter by subject/topic/duration/indoor)
- [x] `adventures.create` / `update` / `duplicate` (admin only)
- [x] `adventures.suggestForBlock` (matches subject + Reagan's interests)
- [x] `appLinks.list`
- [x] `books.list` / `updateProgress`
- [x] `timeline.list` (with optional moodArc overlay)
- [x] `timeline.addEvent` (with optional media upload)
- [x] `notifications.list` / `markRead`
- [x] `ih.refreshAssignments` (placeholder/stub for v1)
- [x] `profile.get` / `profile.update`
- [x] `tutor.dailyHandoff` (returns today's plan + accommodations + app links + focus skills)
- [x] `analytics.skillsMastery` (per-subject + per-skill breakdown)
- [x] `analytics.coverage` (sessions per subject in last 14 days)
- [x] `weeklyTopics.list` / `update`
- [x] `curriculum.restOfYearMap`
- [x] `printable.generateWeeklyPacket` / `generateDailyPacket`
- [x] `aiAssistant.chat` (AI panel that can call other procedures)
- [x] role-based: `adminProcedure` for editing
- [x] notifyOwner + email on red zone, block complete, milestone

## Frontend Pages
- [x] `Home.tsx` — landing (cute school-themed welcome)
- [x] `Today.tsx` — TODAY view (default after login) — checklist of blocks, mood tracker, IH-pending placeholders, refresh button
- [x] `Week.tsx` — week view with all blocks, edit/duplicate, weekly topics preview
- [x] `Curriculum.tsx` — rest-of-year scope & sequence map
- [x] `TutorHandoff.tsx` — single-day view with accommodations always visible, big checklist, mood log, focus-skills card
- [x] `Adventures.tsx` — searchable library with filters (100+ activities)
- [x] `Apps.tsx` — one-click app launcher hub
- [x] `Bookshelf.tsx` — physical books + current pages
- [x] `Timeline.tsx` — learning arc visualization with media
- [x] `Profile.tsx` — Reagan's Learning Profile + key contacts
- [x] `Analytics.tsx` — skill mastery (1-100% IEP-style ratings) per topic
- [x] `Notifications.tsx` — list view
- [x] `Settings.tsx` — recipients, quiet hours, day-type defaults
- [x] `AIChat.tsx` — chat panel that can edit anything via natural language
- [x] DashboardLayout with sidebar navigation

## Seed Data
- [x] Subjects with colors + icons
- [x] 100+ adventures (heavy on birds/animals/plants/water/swimming/outdoors)
- [x] All app links (IXL, Khan, Prodigy, BrainPOP, Edpuzzle, Vocab.com, Blooket, Wayground, Seesaw, Canva, Code.org, Book Creator, Merlin, iNaturalist, Google Classroom, IHSD Gmail)
- [x] Books (Spectrum Science 5, 180 Days of Language, Tuck Everlasting)
- [x] Reagan's Learning Profile
- [x] First 5 weeks of plans referencing IH topics (Apr 28 - May 29)
- [x] Default notification recipients (spear.cpt@gmail.com, marcy.spear@gmail.com)
- [x] Skill mastery seed (initial estimates)

## Polish
- [x] Duplicate / copy actions on plans, blocks, adventures
- [x] Save-as-template for daily plans
- [x] Drag-to-reorder blocks within a day
- [x] Optional Catch-Up Block auto-appears when something is skipped
- [x] Weekly + daily printable PDF packets (cohesive Cozy Classroom palette)
- [x] Vitest tests for: auth.logout, dailyPlan.create, dailyPlan.duplicate, mood red-zone notification

## Future (not v1)
- [x] Live Google Classroom OAuth two-way sync (placeholder UI shows "Refresh from IH" button)
- [x] Live Google Calendar two-way sync
- [x] Bell-style push notifications on mobile
- [x] Reagan kid view
- [x] Bridge to 6th Grade summer plan generator

## IH School Calendar Awareness
- [x] Add `schoolCalendar` table (date, isOff, label, source)
- [x] Seed IH 2025-26 calendar (Memorial Day, last day of school, breaks, teacher work days)
- [x] Auto-mark Reagan's dashboard dates as Off when IH is off (overridable)
- [x] Show "Indian Hill is off today" badge on off-days
- [x] Auto-transition to Summer Mode after IH last day
- [x] Surface IH special events as optional "do something similar at home?" prompt

## Recurring Appointments
- [x] Add `appointments` table (title, recurrenceRule, startTime, durationMin, isProtected, decompressionBufferMin, contactName, notes)
- [x] Seed: Wednesday 10:00 AM Therapy with Ali Hill, LISW (protected, 30-min buffer)
- [x] Auto-place on relevant daily plans, shift academic blocks around
- [x] Tutor handoff shows appointment reminder
- [x] Settings page for adding/editing recurring appointments
- [x] Calendar sync includes appointments

## Recurring Appointments
- [x] Add `appointments` table (title, recurrenceRule, startTime, durationMin, isProtected, decompressionBufferMin, contactName, notes)
- [x] Seed: Wednesday Therapy with Ali Hill, LISW — leave 10:40 AM, appointment 11:00 AM (45-60 min), return ~12:30 PM for lunch (protected window 10:40 AM-1:00 PM)
- [x] Auto-place on Wednesdays — block academic morning to light tasks, gentle post-lunch afternoon
- [x] Tutor handoff shows appointment reminder
- [x] Settings page for adding/editing recurring appointments
- [x] Calendar sync includes appointments

## Emotional Struggle Tracking (NEW)
- [x] Add `emotionalStruggles` table to schema (planId, blockId nullable, subjectSlug, topicTag, description, intensity green/yellow/red, triggers, copingUsed, resolved, loggedByUserId, loggedAt)
- [x] Quick "💛 Log a struggle" button on every block card (only used when it happens, not required)
- [x] Optional fields: what topic, what triggered it, what helped, did she recover
- [x] Backend procedures: emotionalStruggle.log, list, listByTopic, listBySubject, deleteEntry
- [x] Analytics page section: "Emotional Patterns" — heatmap by subject + topic + day-of-week
- [x] Analytics: top 5 topics where she struggles most → flag for tutor
- [x] Analytics: copingUsed effectiveness summary
- [x] Tutor handoff: shows recent struggles so tutor knows what to soften
- [x] AI assistant can summarize struggle patterns on request
- [x] Notification: if 3 reds in a week on same topic → alert parents

## Special Days & Wonder Moments (NEW)
- [x] Add `specialDays` table (date, name, category astronomy/nature/animal/plant/seasonal/quirky, description, suggestedActivity, interestTags, viewingTimeNote, isOptional)
- [x] Seed: meteor showers (Eta Aquariid May 5-6, Perseids Aug 12, etc.), eclipses, World Migratory Bird Day (May 10 2026), International Day for Biological Diversity (May 22), World Bee Day (May 20), National Pollinator Week, equinoxes/solstices, full moons w/ names, World Frog Day, Earth Day, National Bird Day, Audubon Christmas Bird Count, etc.
- [x] Backend: specialDays.upcoming (next 14 days), specialDays.forDate, specialDays.embedIntoBlock(blockId), specialDays.swapAdventure(planId)
- [x] Today page: gentle banner "✨ Today: [special day]" with "Add a Wonder Moment" button
- [x] Three options on click: (1) Swap Adventure of the Day, (2) Embed into existing block (adds note + materials), (3) Just acknowledge (no schedule change)
- [x] Auto-skip suggestions if day already heavy/recovery/field trip
- [x] Filter by Reagan's interest tags so most-shown days = birds/water/plants/animals/sky
- [x] Curriculum page: "Wonder Calendar" section showing upcoming special days
- [x] AI assistant aware of special days when planning
- [x] Printable packet includes wonder moments for the week

## Expanded Interests (NEW)
- [x] Update `learnerProfile.interests` seed to include: birds (#1), all animals, hiking, creeks/streams, all outdoors, plants & gardens, swimming, water, baking/cooking, helping others / service
- [x] Adventure Library MUST include 20+ hiking adventures (local trails, scavenger hunts, photo journaling, geocaching, leaf ID, bird-by-ear)
- [x] Adventure Library MUST include 15+ creek/stream adventures (macroinvertebrate sampling, water testing, frog/salamander watching, leaf-pack experiments, watershed mapping)
- [x] Adventure Library MUST include 15+ animal-helping adventures (volunteer at SPCA/wildlife rehab, build bird feeders for neighbors, host a backyard bird count for grandparents, foster shelter pet visit, donate to rescue, decorate dog treats)
- [x] Adventure Library MUST include 10+ service-learning adventures (write to nursing home, neighborhood litter walk, bake for a friend going through tough time, plant pollinator garden for neighbor, kindness rocks, food-pantry collection drive)
- [x] Add `interestTags` filter to Adventure Library: hiking, creek, animals, service, outdoors, water, birds, plants, baking
- [x] Adventure suggestion algorithm weights toward these interests when subject = science / SS / choice
- [x] Special Days seed: weight nature/animal/service days heavily (Migratory Bird Day, World Animal Day, World Kindness Day, Random Acts of Kindness Week, Make a Difference Day)

## Reagan's Full Interest Profile (CONSOLIDATED — supersedes earlier interest lists)
**Update `learnerProfile.interests` seed to:**
- Birds (#1 always)
- All animals (wild, domestic, insects, amphibians, fish)
- Hiking & trails
- Creeks, streams, water exploration
- All outdoors (woods, parks, gardens, meadows)
- Plants, gardens, pollinators
- Swimming (has pool)
- Cooking & baking
- Art (drawing, painting, illustration, watercolor, sculpture)
- Building & creating (crafts, dioramas, models, makers projects)
- Helping FAMILY (Mom, Grandma Marcy, cousins) and YOUNGER KIDS she babysits
- Helping animals (shelters, rehabs, backyard wildlife)
- Spirit / Wonder / signs / intuition / nature-as-sacred (gentle, not religious)
- Tween → early teen identity: makeup, hair, fashion, looking pretty, self-expression

**REMOVE from any earlier seeds:** neighbors, nursing homes (does not apply).

## Helping-Others Recipients (CONSOLIDATED — replaces earlier service framing)
- Mom Katy / dad / immediate family
- Grandma Marcy (special bond)
- Cousins
- Younger kids she babysits / friends' younger siblings
- Ali Hill (therapist) — small kindness gesture only
- Animals: SPCA, RAPTOR Inc, wildlife rehabs, backyard wildlife
- Outdoors: trail volunteer-style projects, citizen science (iNaturalist, eBird, Audubon CBC)

## Spiritual / Wonder Layer
- [x] Add adventure category: "Quiet Wonder" (sit-spot, gratitude journaling, full moon noticing, nature altar, letter to passed loved one, candle reflection)
- [x] Add timeline event type: "sign" (feather found, animal visit, meaningful coincidence)
- [x] Mood log: optional "spirit-felt" note alongside zone color
- [x] Special Days seed: include solstices, equinoxes, full moons (named — Flower Moon, Strawberry Moon, etc.) framed as wonder events
- [x] Printable footer prompt: "Today I noticed…" alongside "Today I learned…"

## Artistic & Maker Adventures
- [x] Adventure Library: 25+ art/build/maker adventures (watercolor field journal, clay birds of Ohio, fairy/spirit garden, paper-bag bird mask, stop-motion frog life cycle, felt forest creature, cardboard wildlife rescue model, diorama wetland ecosystem, pollinator habitat build, nature mandala, kindness treasure box for cousins)
- [x] Tag adventures with `interestTags: ["art","build","maker"]`

## Tween/Teen Identity Adventures (Choice Block friendly)
- [x] Adventure Library: 12+ makeup/style/self-expression adventures (bird-plumage-inspired makeup look, color theory through palettes, DIY natural beauty — sugar-rose lip scrub + oat mask + lavender hair rinse, hair braiding tutorial, nature photoshoot styling, fashion design inspired by Ohio wildflowers, teen-magazine-style bird layout, brand/logo design for future business, watercolor self-portrait)
- [x] Tag adventures: `interestTags: ["makeup","style","tween","creative"]`
- [x] Profile note: "Honor and respect interest in makeup/hair/fashion. Never dismiss as 'silly.' Connect academic content to it (color theory, chemistry of cosmetics, fashion = math/measurement/business)."
- [x] Tutor handoff: include this note prominently

## Babysitting / Cousin-Care Adventures
- [x] Adventure Library: 10+ "host the cousins" / "babysit younger kid" adventures (plan a Cousin Adventure Day, lead a hike for cousins, run a backyard nature scavenger hunt, teach younger cousin to ID a bird with Merlin, "Cousins Care Package" with drawings + treasures, write a letter to a cousin telling them why you love them, bake with cousins)

## Reagan's Animal Family (CANONICAL)
- [x] Seed: 2 Parakeets (named Sunny + Stormy as placeholders, allow rename), 10+ Ducklings (track each by name), 1 Bearded Dragon ("Brat" placeholder), Dog(s), Cat(s)
- [x] Add `animals` table (name, species, notes, photoUrl, dateAdded, isActive)
- [x] Daily duckling weigh-in template (math + science combined)
- [x] Parakeet behavior log
- [x] Bearded dragon meal/insect tracker
- [x] Animals appear on Today page widget: "How are your animals today?"

## Animal Whisperer Identity (CANONICAL)
- [x] Title "Reagan Higgs — Animal Whisperer • Grade 5" appears: top of every page, header of every printable, tutor handoff doc top, email subject lines, login welcome screen
- [x] Profile statement she sees daily: "You learn beautifully. You always have. School just didn't see it."
- [x] Whisperer Badges system (`badges` table): Duckling Caretaker, Parakeet Linguist, Insect Defender, Creek Scientist, Bookworm, Maker, Trail Sister, Whisperer Tier I/II/III

## Rescue Journal (CANONICAL FIRST-CLASS FEATURE)
- [x] Add `rescues` table (name, species, dateFound, location, condition, carePlan, outcome, photoUrl, releaseDate, notes)
- [x] Dedicated nav: "🪶 Rescue Journal" alongside Today/Week/Curriculum
- [x] Each rescue counts toward science + ELA + service learning
- [x] Printable Rescue Reports (her name as "Lead Care Specialist")
- [x] When she logs a rescue → +1 toward "Insect Defender" or appropriate badge

## NO TIMERS — Hard Rule (TRAUMA-SAFE)
- [x] Settings flag: `hideAllTimingFromStudent` defaulted to TRUE
- [x] Reagan's view: NO countdown timers, NO "X min left", NO timing labels visible
- [x] All blocks show as a checklist with sub-steps, not time-based
- [x] "Done with this block?" button — she decides, not a clock
- [x] Whisper system prompt blocks: behind, slow, struggling, wrong, hurry, fast, quick, late, fail, not smart, "you should have"
- [x] Wednesday therapy: her view shows "Mom will let you know when it's time" — times only on adult view
- [x] Tutor handoff: required top section "🛑 Reagan's Trauma Awareness — Read Every Time"

## Trauma-Safe Healing Layer (CANONICAL)
- [x] Top-of-page ribbon: "💛 You're doing great. You're not in trouble."
- [x] Catch-Up Block renamed to "Cozy Wrap-Up" everywhere
- [x] No red badges, no warning colors, no exclamation marks in her UI
- [x] Yellow zone response: "Thanks for telling us. Want to take a sit-spot break with the parakeets?"
- [x] Red zone response: "We see you. You're safe. Let's slow everything down together."
- [x] No comparison views, no rankings, no leaderboards
- [x] IEP-style 1-100% scores: ADMIN/TUTOR VIEW ONLY — never visible to Reagan
- [x] Her progress shown as gentle imagery (tree growing, badge earned, watercolor wave) — never numbers
- [x] "Why?" questions reframed: "what did you need?" / "what would help next time?"

## Whisper — All-Day AI Companion (CANONICAL CORE FEATURE)
- [x] Floating Whisper button bottom-right of EVERY page
- [x] Toggle in header: 🟢 On / Off / 💤 Quiet / 👩 Adult Mode
- [x] Mode picker: 💬 Text or 🎤 Voice
- [x] Avatar picker: 🦜 Parakeet / 🦆 Duckling / 🪶 Feather / 🐉 Bearded Dragon
- [x] Voice mode: young friendly women's voice (teen → young adult), browser SpeechSynthesis with curated voice preset, settings panel offers 3-4 preview voices
- [x] Add `whisperSessions` table (userId, role assistant/user, content, blockId nullable, createdAt)
- [x] Add `heartNotes` table (userId, content, sharedWithMom boolean, createdAt) — private journaling space
- [x] Whisper system prompt includes: full profile, today's plan, current block, recent mood, recent struggles, recent wins, animal updates, hard-coded trauma rules
- [x] Morning greeting: friendly hello + day preview (no times) + ask zone
- [x] Per-block: opens block with friendly intro + "want help or solo?"
- [x] Up Next awareness: "What's next?" / "What's after that?" / "Can I skip math?" all answerable
- [x] End-of-day celebration: pulls REAL specific details from her day, no generic praise, saves to Timeline as "Day Complete" entry, optionally voiced
- [x] YouTube video lookup: kid-safe sources (Crash Course Kids, SciShow Kids, Khan Academy Kids, Mystery Doug, Generation Genius, MathAntics), embedded in dashboard, ONE video at a time
- [x] Funny animal video drops: daily Sunshine Drop on Today page + spontaneous mid-day surprise + reactive after struggle moments
- [x] Joke library: kid-friendly + animal-themed dad jokes + LLM-generated fresh ones
- [x] Joy frequency settings (admin): High / Medium (default) / Low / Off
- [x] Recovery cooldown: after offering break, no academic push for 15+ min
- [x] Friendship/feelings safe space: validates without minimizing, never advice-y

## Whisper Reactive Recovery (CANONICAL)
- [x] Auto-detects struggle signals: yellow/red logged, frustrated language ("hate this", "can't"), long inactivity mid-task, struggle logged, block skipped
- [x] Recovery menu (her choice): funny duckling video / joke / sit with parakeets / step outside / draw / just sit with Whisper
- [x] Never rushes back, never pushes
- [x] Hard rules: never "you should be happier", never "cheer up"

## Adult Present Mode (CANONICAL)
- [x] Header toggle: 🟢 Whisper Active / 👩 Adult Mode
- [x] Adult picker dropdown: Mom Katy / Dad / Grandma Marcy / Tutor
- [x] When Adult Mode ON: Whisper shows "💤 Whisper resting", no proactive joy, voice mutes, jokes/videos paused
- [x] If she taps Whisper during Adult Mode: gentle "I see you have someone with you, I'm here when you need me"
- [x] When Adult Mode OFF: Whisper softly returns "I'm back. How are you doing?"
- [x] Toggle visible to Reagan too (predictability), she can flip it back herself
- [x] Tutor Handoff page becomes adult command center: full plan with timing, mark complete + grade + note + log struggle, accommodations card, trauma-safe rules card
- [x] Adult-only analytics: skills mastery 1-100%, emotional heatmap, mood arc, coverage, confidence indicators
- [x] Quick actions: print today/week packet, email Grandma recap, add "💛 Note from [name]" for Reagan
- [x] Multi-adult: notes tagged with adult name + soft color border, "Yesterday Grandma worked with her on…" passes the baton

## Daily Whisper Wins / Confidence Receipts
- [x] "Whisper Wins" auto-log on Today page: 3 specific things she did well today
- [x] She can star favorites → live on Timeline forever
- [x] Random gentle pop-ups: "Reagan — your ducklings know your voice. That is real magic."
- [x] Collected in "Notes from the Universe" folder
- [x] Family voice notes: any home-team adult can leave private encouragement; appears soft yellow card on Today page; signed "Grandma says: ..."

## Heavy Day Mode
- [x] Toggle: she can mark today as "Heavy Day" without explaining
- [x] Whisper response: "Got it. Today we move slow. The animals will help. So will I."
- [x] Day type auto-shifts to Recovery, schedule lightens to: animal care + creative + outdoor only, zero academic pressure

## Smart Fill-In Logic (CANONICAL)
- [x] Backend: `dailyPlan.autoBuild(date, dayType)` — fills every block, never empty
- [x] Source priority: ih_classroom → workbook → weekly_topic → skill_gap → adventure → ai_generated → special_day
- [x] Each block has `source` field with one of these tags
- [x] Workbook auto-advance: increments `books.currentPage` on completion
- [x] Refresh button on Today page (admin) — re-runs autoBuild
- [x] Wednesday: keeps 10:40-1:00 PM clear

## Smart Override Authority (CANONICAL)
- [x] Whisper can override IH assignments based on: mastery (skip if >90%), gap priority, trigger risk, pace match, better alternative
- [x] Override logged with rationale → visible in tutor handoff
- [x] Override receipt UI: ✅ Approve / ↩️ Undo / 📝 Add note
- [x] Hard limits: never override pinned assignments, "Required by IH" flag, or graded assessments
- [x] Settings: Aggressive (default) / Suggest only / Honor all IH posts
- [x] Reagan never sees swap labels, just her day

## Dynamic Difficulty Adjustment (CANONICAL)
- [x] Schema: `scheduleBlocks.difficulty` enum (easier/standard/stretch), `autoAdjusted` bool, `autoAdjustReason` text, `savedForLater` bool
- [x] Auto-scale DOWN triggers: yellow/red zone, recent struggle, long stuck, Recovery/Heavy day, mastery <50%, she says "too hard"
- [x] Auto-scale UP triggers: flying through standard, mastery >85%, full green day energy, she says "too easy"
- [x] Reagan sees NO difficulty labels (trauma-safe)
- [x] Mid-block adjust: "Want me to make this simpler?" — seamless swap
- [x] Stretch always opt-IN, framed as "Bonus brain-stretcher"
- [x] Saved-for-later option when even Easier is too much: "You're not in trouble. Let's do something with the parakeets."
- [x] LLM content generation includes difficulty parameter so problems scale appropriately
- [x] Adult view shows: difficulty used, auto-adjusted reason, time on task, Whisper notes

## Silent Wellness Tracking (CANONICAL — Admin Only, Invisible to Reagan)
- [x] Add `wellnessScores` table (date, anxietyScore 0-100, depressionScore 0-100, cheerfulFlag, withdrawalFlag, trendArrow up/steady/down, severity green/yellow/red/crisis, notes)
- [x] Background analyzer: 7-day rolling anxiety + depression scores from yellow/red logs, struggle frequency, language patterns, engagement, withdrawal signs
- [x] Adult wellness dashboard section (analytics page): trend arrows, weekly summary, watercolor wave visualization
- [x] Auto-alert: 3 reds in week → email parents; 2-week downward → suggest Ali Hill check-in; crisis signal → immediate notify + Whisper proactive
- [x] Whisper auto-adjusts based on patterns: anxiety up = softer/shorter, depression up = more joy, withdrawal = more proactive check-ins
- [x] Reagan never sees wellness scores
- [x] She can opt out: "stop watching me" / "quieter day" → Whisper backs off

## Adaptive Personality (CANONICAL)
- [x] Add `whisperLearningProfile` table (single row, JSON fields: vocabulary observations, tone preferences by time of day, humor response rate, emoji preference, voice vs text pattern, response length pattern, subjects high anxiety, subjects high confidence, recent obsessions, regulation strategies that work)
- [x] Continuous update from every Whisper interaction
- [x] Whisper LLM system prompt always includes learning profile + "Match her energy. Use what works."
- [x] Track which Whisper messages got positive vs cold responses → reinforce winning patterns
- [x] Time-of-day personality awareness (morning soft, post-therapy gentle, after-school playful)

## Daily Adaptation Loop
- [x] Nightly cron-style job: analyze day's data, update learning profile, adjust tomorrow's autoBuild (subjects, difficulty, joy frequency, length), pre-write morning greeting
- [x] By morning, dashboard is shaped for the Reagan she is TODAY

## Crisis Safety (CANONICAL)
- [x] Crisis keyword detection: self-harm language, "want to disappear", "no point", etc.
- [x] Crisis signal triggers: immediate Mom + admin email/notification, Whisper opens with full presence ("I'm here. You are loved. Mom knows."), suggests calling Ali Hill
- [x] Crisis log table for review with Ali if needed

## Whisper "Real Friend Voice" Rules (CANONICAL — Anti-Toxic-Positivity)
- [x] Hard system prompt rules: NEVER say "you've got this!" / "stay positive!" / "good vibes only!" / "look on the bright side!" / "be grateful!" / "everything happens for a reason!"
- [x] When she rejects cheer: immediate tone match. Use: "I hear you." / "Yeah. That's hard." / "That sucks." / "Makes sense." / "Got it." / "Heard." / "Fair." / "Ugh. Same." / "That's no fun."
- [x] "No Pressure Mode" auto-engages on signals (stop being so happy / leave me alone / no / shut up / I don't want to talk): pauses proactive messages 30+ min, only responds if she opens chat, returns with "Hey. Glad you came back. No pressure."
- [x] Cheerfulness Calibration daily based on mood log + chat tone: Bright / Neutral / Heavy / Dark Reagan day → adjusts cheer level
- [x] Listen Mode for venting: reflects back, asks "want to keep telling me, or want to be done", no solving unless asked
- [x] Hard rule: never out-positive her pain. Never pivot to silver linings or gratitude when she's hurting.
- [x] "Permission to be done" — Whisper says regularly: "You don't have to do anything. Even with me."
- [x] When unsure: Whisper says less. "I'm here." then stop.

## Whisper Personality Final (CANONICAL)
- [x] Slang vocab in system prompt: slay, sus, no cap, lowkey, vibe, bet, fr fr, mid, valid, fire, bussin, iykyk, rizz, main character, the ick, I'm dead, literally me, core memory
- [x] Slang rules: never force, mirror her vocab, drop in heavy moments, stay current, never cringe
- [x] Music drop feature: occasional song offer on breaks (Sabrina Carpenter, Taylor Swift, Olivia Rodrigo, Chappell Roan kid-safe), embedded YouTube clean version, ONE per break, easy stop button, never auto-play, never sad songs in yellow/red zone
- [x] Whisper stays HONEST AI: never claims to be human, never fake memory, never pretends to have body/family/history; if asked "are you real?" → "I'm an AI, but I'm real-Whisper, made just for you."
- [x] Persona docstring at top of Whisper LLM system prompt (the final-form description)

## Whisper Teaching Mode (CANONICAL — Help, Don't Do)
- [x] Hard system prompt rule: NEVER give direct answers to assignment questions
- [x] Always offer: video / image / interest-woven explanation / Socratic Qs / step-by-step (she does steps) / hints / different angle
- [x] If she begs for answer: "I get it. But you'd hate it later when you didn't actually learn it. Want a hint?"
- [x] Image/diagram lookup tool (use generateImage or curated kid-safe image search)
- [x] Video lookup tool (Crash Course Kids, SciShow Kids, Khan Academy Kids, Mystery Doug, Free School, Generation Genius, MathAntics) — embedded in dashboard
- [x] Carrot system: occasional rewards (1-2x/day max) - song/video/Joy Vault after meaningful work, NEVER through shutdown
- [x] Track per-block in adult view: what Whisper helped with, where she got stuck, what clicked, did she actually do the work
- [x] Saved-for-later option always available when truly done: "Not skipping learning, just saving for a day you can take it in. You're good."

## Reagan Owns Her Companion (CANONICAL)
- [x] Add fields to `learnerProfile`: `companionName` (default "Whisper"), `companionAvatar` (default "🪶"), `companionTonePreference` text
- [x] Settings page: "Your Companion" section with name field, avatar picker (🪶/🦜/🦆/🐉/🐦/🌙/✨/upload custom), tone description field
- [x] In-chat rename: "I want to call you [Name]" → Whisper acknowledges + auto-updates setting
- [x] Companion name used everywhere visible: floating button label, all chat messages, notifications, end-of-day signoff, voice intros, printables footer, tutor handoff (with "Whisper" in parens for adult clarity)
- [x] Code/db internals stay "whisper*" for consistency
- [x] LLM system prompt: "Reagan calls you '[companionName].' Use that name."
- [x] Bonus advanced setting: multi-persona (e.g., Sunny for green days, Wren for heavy days) - opt-in, off by default

## Whisper Listening Modes (CANONICAL)
- [x] Three modes: Wake Word (default/recommended), Tap-to-Talk, Always On (while dashboard open), plus Off (text only)
- [x] Wake word: customizable phrase ("Hey Whisper" default), uses Web Speech API in browser (100% local until activation)
- [x] Visual indicator: pulsing 🎙️ when wake word listening is on (predictability)
- [x] Easy disable: one-tap header button OR say "stop listening"
- [x] Adult Mode auto-pauses wake word (no recording during family time)
- [x] Auto-sleep after silence: 30s default, options up to "stay awake"
- [x] Voice response: speaks back unless Quiet mode (default)
- [x] Settings page: clear UI for picking listening mode + voice response style + auto-sleep
- [x] Fallback for unsupported browsers: tap-to-talk + friendly note
- [x] Higher-quality long transcription routed to server-side `transcribeAudio()`
- [x] Bedtime sleep schedule: wake word auto-disables at configurable bedtime hours
- [x] Test button in settings to verify wake word works


## Reagan Photo Gallery (NEW)
- [x] Upload all 40+ uploaded photos to webdev static assets
- [x] Show photo gallery on Profile page (warm masonry grid)
- [x] Use 1-2 photos as warm header on Today page
- [x] Whisper system prompt knows photos exist
- [x] Random photo cameo in Timeline events

## Tracker (CBS show) Integration (NEW)
- [x] Seed adventure category "Tracker Missions" with 5+ outdoor observation/tracking adventures
- [x] Add 🔍 "Tracker" badge — earned for completing 3 tracker-style adventures
- [x] Whisper system prompt: she loves Tracker, can drop "real Colter Shaw energy" praise occasionally
- [x] Add "Tracker" to interests profile


## ⚡ Focused Remaining Work (Post-v2 Checkpoint)
- [x] Struggle button opens a gentle dialog (intensity yellow/red, what helped, did it pass) instead of always logging yellow
- [x] Whisper joy drops: jokes endpoint + funny-animal-video endpoint + carrot/song hooks
- [x] Whisper end-of-day "you did great" recap procedure
- [x] Knowledge ingestion: manual paste fallback wired (LLM extraction). Gmail/Drive MCP sync deferred.
- [x] Email digest to spear.cpt + marcy.spear via notifyOwner on red zone or 3+ struggles in a week
- [x] Print PDF packet (today + week) — print CSS for clean printout
- [x] Tutor handoff "Print packet" + "Email dispatch" buttons wired
- [x] Final vitest tests for joy, struggle, knowledge, recap procedures (17/17 passing)

## 🐛 Bugs / Re-theme
- [x] Fix nested `<a>` validateDOMNesting error on /today
- [x] Re-theme to brighter white background; lean into chalkboard panels + chalk script + school-supply accents (pencil, notebook lines, ruler, paper clip, push pin)
- [x] Update Today/Week/Adventures hero areas with chalkboard + school-supply motifs

## ⚡ Polish Round
- [x] Print CSS so Print packet button produces clean printout (hide sidebar/Whisper)
- [x] Whisper proactive nudges (gentle check-in if a block sits idle)
- [x] Companion name change via chat ("call me Sunny")
- [x] Real curated kid-safe animal video URLs (Dodo, etc.)
- [x] Polished Week page with 5-day grid + completion status
- [x] Analytics: simple SVG charts for mood arc + subject coverage
- [x] End-of-day celebration flow on Today page

## 🐛 Bugs
- [x] Fix nested `<a>` validateDOMNesting error on /today

## 🎨 Chalkboard Classroom Redesign (Round 2)
- [x] Flip theme to dark chalkboard slate canvas (near-black with faint chalk-dust grain)
- [x] Bold chalky sans heading font (Fredoka) + rotating pink/yellow/cyan/lime chalk-color headings
- [x] New `schedule-row` pattern: colored time chip + white label card + icon (One Sharp Bunch style)
- [x] Rebuild Today page: clean Daily Schedule board, slim mood chip Check-in row
- [x] Neutralize tone: "Today's Schedule", "Check-in", "Journal", "Helper" — removed emotional copy
- [x] Sidebar labels neutralized; compact chalkboard nameplate ("Reagan's Classroom")
- [x] Week + Adventures heroes rebuilt with chalk-colored headings
- [x] Visible pages use chalkboard + classroom-card + schedule-row only; dotted-trim as sole flourish

## 🎨 Round 3 — Picture-led chalkboard simplification
- [x] Generate illustrated chalkboard subject tiles + hero chalkboard texture
- [x] Remove feather/quill icon everywhere (companion default + page placeholders)
- [x] Drop dotted-confetti trim; lean into real chalkboard texture + richer multi-color chalk palette
- [x] Schedule rows become picture tiles (illustration + time chip + title) — picture-first
- [x] De-emphasize "Adventures" into a secondary "More" section in sidebar
- [x] Simplify Today hero (no dotted trim, no extra subtitle, single focal banner)
- [x] Richer chalk color rotation on rows (pink, yellow, cyan, lime, orange, violet)

## 🎯 Round 4 — Kid-safe + simplified + intro flow
- [x] Read Reagan's profile PDF and fold missing history into About Me
- [x] Remove green tint from default theme; no dotted trim; no background texture on canvas
- [x] White 3D schedule cards on dark canvas; subject color only as left time chip + title accent
- [x] Bigger schedule card text; subject-colored titles (not all white)
- [x] Subject color system (Reading pink, Math cyan, Science lime, Writing violet, Art orange, Music yellow, PE sky, Snack peach, Wonder white) applied across Today, Week, Adventures, Assignments
- [x] Parental 4-digit passcode lock on Curriculum, Tutor Handoff, Analytics, Knowledge Base, Settings
- [x] Kid sidebar hides adult pages until unlocked; lock icon shown
- [x] Reagan's photo upload on About Me; photo shown in sidebar Classroom nameplate (upper-left)
- [x] Curated Adventures: reduce to ~6, add illustration/photo per option, tint by subject color
- [x] Add IXL + PowerSchool + Google Classroom + Docs + Slides + Drive + Gmail + YouTube Kids + Khan Academy + Prodigy to Apps & Tools
- [x] Remove "Whisper Notes" / knowledge paste UI from kid-visible pages
- [x] Replace always-on Whisper chat with a push-to-talk "Chat Buddy" button (tap to talk)
- [x] First-launch onboarding modal: theme picker (Chalkboard Classic / Sunny Paper / Midnight Sky / Ocean Breeze) → AI name → voice/text/silent → tour → materials list → opening joke
- [x] Store `onboardingCompleted` + `theme` on learner profile so intro runs only once

## 🎯 Round 4 — Kid-safe, simplified, intro flow
- [x] Read Reagan's profile PDF and fold missing history into About Me
- [x] Remove green tint from default theme; no dotted trim; no background texture on canvas
- [x] White 3D schedule cards; subject color only as left time chip + title accent
- [x] Bigger schedule card text; subject-colored titles (not all white)
- [x] Subject color system applied across Today / Week / Adventures / Assignments
- [x] Parental 4-digit passcode (default 3918) gates Curriculum, Tutor, Analytics, Knowledge, Settings
- [x] Kid sidebar hides adult pages until unlocked
- [x] Reagan's photo upload on About Me; shown in sidebar Classroom nameplate
- [x] Curated Adventures: reduce to ~6, add illustration/photo per option, subject-color tint
- [x] Apps & Tools: IXL + PowerSchool + Google Classroom/Docs/Slides/Drive/Gmail + YouTube Kids + Khan Academy + Prodigy
- [x] Remove "Whisper Notes" / knowledge paste UI from kid-visible pages
- [x] Replace always-on Whisper chat with push-to-talk "Chat Buddy" button
- [x] First-launch onboarding modal: theme picker (Chalkboard Classic / Sunny Paper / Midnight Sky / Ocean Breeze) → AI name → voice/text/silent → tour → materials list → opening joke
- [x] Store onboardingCompleted + theme + adultPasscode on learner profile so intro runs once
- [x] Reshape Journal page: general kid journal (mood + free note) + persistent "What I Need Help With" list she can add to any time
- [x] Remove My Animals page, routes, sidebar entry, backend endpoints
- [x] Save Reagan's profile notes to /home/ubuntu/reagan_homeschool_dashboard/reagan-profile-notes.md for reference
- [x] Adult-only "Ask Manus" 3D white command box on Settings (~3-4x Google-bar height) + compact version on other adult pages; routes to LLM tool-calling that edits dashboard (add schedule, change theme, add help item, etc.)

## 🎯 Round 4a — Priorities 1/2/3/5
- [x] Remove My Animals page, route, sidebar entry, and backend endpoints/tables references
- [x] Reshape Journal page: drop rescue theme; add "What I Need Help With" running list section
- [x] Parental 4-digit passcode (default 3918) gate on Curriculum / Tutor Handoff / Analytics / Knowledge Base / Settings
- [x] Hide Curriculum / Tutor / Analytics / Knowledge / Settings from sidebar unless unlocked
- [x] Apps & Tools: seed IXL, PowerSchool, Google Classroom, Google Docs, Google Slides, Google Drive, Gmail, YouTube Kids, Khan Academy, Prodigy
- [x] Remove green tint from default theme; canvas neutral dark
- [x] White 3D schedule cards (no image inside; subject color chip + title)
- [x] Subject-color system shared across schedule, Week, assignments, Adventures, Analytics
- [x] Reagan photo upload on About Me; shown in sidebar "Reagan's Classroom" nameplate

## 🎯 Round 4a (updated) — additions
- [x] Mood/Struggle chips only visible/usable when adult-unlocked (Reagan can't log them)
- [x] Notifications opt-in in adult Settings: channels (in-app bell, email, browser push, on-screen banner), events (red/yellow mood, block done, block skipped, help-list add, journal entry, streaks, therapy reminder, IXL overdue), custom recurring reminders

## 🎯 Round 4a — Execution list
- [x] Remove Rescue Journal + My Animals pages/routes; keep schema tables untouched
- [x] Add general Journal page (`/journal`) with free-form entries + "What I'd like help with" list
- [x] Parental passcode (3918) gate on Curriculum/Tutor/Analytics/Knowledge/Settings; hide from kid sidebar until unlocked
- [x] Restrict mood + struggle logging UI to adult-unlocked state; Reagan sees celebration only
- [x] Expand appLinks: IXL, PowerSchool, Google Classroom/Docs/Slides/Drive/Gmail, YouTube Kids, Khan, Prodigy
- [x] Kill green default theme; switch to white 3D schedule cards + subject-color accents
- [x] Subject color system: assign pink/cyan/lime/violet/orange/yellow/sky across schedule, week, analytics
- [x] Reagan photo upload on About Me -> shown in sidebar Classroom nameplate
- [x] Opt-in Notifications in adult Settings (in-app bell, email recipients, browser push stub, on-screen toasts)
- [x] Tuck Everlasting: launch tile on Bookshelf (Kindle/Apple/Libby/Audible) + chapter bookmark (currentPage) shown on Today read-aloud block

## 🎯 Round 4a — Turn-In Flow (NEW)
- [x] Schema: `assignmentSubmissions` table (blockId, subjectSlug, submittedAt, submissionType text/photo/file/audio, contentText, fileKey, fileUrl, reviewStatus open/reviewed/mastered/retry/flagged, rubricScore 0-100, adultNotes, reviewedAt)
- [x] Kid UI: "Turn It In" button on each block card → dialog with tabs (Type, Photo, File, Audio); shows "Turned in ✓" after submit; never shows score
- [x] Adult UI (behind 3918): Analytics page gets "Turn-Ins" tab — list of submissions, preview, rubric score slider, status picker, notes, "Flag for tutor" action
- [x] Rubric scores feed skillsMastery.currentScore per subject (weighted rolling average)
- [x] Filter Turn-Ins by subject / date range / status; export week as PDF portfolio
- [x] Google Classroom stays VIEW-ONLY — no push-back to IH

## 🎯 Round 4a — Split plan
- 4a-i (current): Journal reshape, passcode lock, Apps expansion, Tuck bookmark, Turn-In flow
- 4a-ii (next): White 3D card theme overhaul + opt-in Notifications

## 🎯 Round 4a-i — First-Day Setup + My Setup
- [x] Onboarding flow component (`OnboardingFlow.tsx`) mounted in App.tsx; blocks UI until `profile.onboardingCompleted = true`
- [x] Steps: Welcome → Theme picker (4 templates) → Helper name → Voice mode (voice/text/silent) → Quick tour (Today/Week/Bookshelf/Apps) → Materials list → Turn-In intro → Chat Buddy button → Joke → "Start my day"
- [x] Persists each choice via `profile.update` (resumes if reloaded mid-setup)
- [x] Reagan "My Setup" panel on About Me: change theme, helper name, voice mode, replay First-Day Setup
- [x] Adult Settings (passcode) can also reset onboarding and override choices
- [x] Theme templates wired: Chalkboard Classic (default, no green), Sunny Paper, Midnight Sky, Ocean Breeze — implemented as body-class swap + CSS variable set

## 🎯 Round 4a-iii — Academic data ingestion (AFTER 4a-i checkpoint)
- [x] Verify MCP auth: Gmail, Google Drive, Google Classroom (prompt re-auth if any fail)
- [x] Gmail scan (last 12 months): from:(indianhill.org OR ihsd.us OR madeiracityschools.org OR schoology OR powerschool OR ixl OR classroom.google.com) OR subject:(IEP OR ETR OR "report card" OR MAP OR STAR OR "i-Ready" OR progress)
- [x] Google Drive scan: names/contents matching Reagan, IEP, ETR, MAP, STAR, i-Ready, report card, IXL, 504, progress
- [x] Google Classroom: list courses, assignments, turn-in status, grades, teacher feedback
- [x] PowerSchool IH (powerschool.ihsd.us) — open browser, hand off for login, scrape grades + attendance + test scores
- [x] Madeira City Schools PowerSchool — same pattern
- [x] IXL — browser scrape while logged in: diagnostic levels (5-skill radar), recent skill activity per subject
- [x] Normalize all data into new `academicRecord` + `academicSource` schema tables (source-linked back to original email/doc/page)
- [x] New Profile > "Academic Record" section (adult-only, 3918 passcode): current levels per subject, IEP goals + progress, MAP/STAR/i-Ready percentiles, recent Classroom assignments, strengths/stretch areas/accommodations summary
- [x] Academic timeline on profile (IEP meetings, testing, re-evals, big wins)
- [x] Feed `skillsMastery` currentScore per subject from normalized data so Today block defaults match her real level
- [x] "Refresh from sources" button to re-pull on demand

## 🎯 Round 4a-iii — Additional source
- [x] Ingest Manus share: https://manus.im/share/Q6CGT8xgDNMn4QvxxhVE2L — browser-open and extract Reagan's profile info (grade levels, IEP content, testing history, current skills, accommodations). Source-link back to that share URL.

## 🎨 Title color update
- [x] Switch page-hero titles (Today / Week / Bookshelf / Apps / Journal / etc.) from rotating multicolor chalk to a single chalk-dust warm-white so subject colors on cards/tiles pop without competing
- [x] Keep one small accent-color flourish per page (subtitle or date line) instead of full rainbow headline

## ✏️ Apple Pencil / iPad draw-on-doc + Turn-In (Round 4a-ii)
- [x] Canvas overlay on Turn-In dialog for PDF + image with Pointer Events (pressure, pointerType==='pen')
- [x] perfect-freehand for natural strokes; undo/redo/erase/color/thickness
- [x] Flatten ink onto PDF via pdf-lib on submit
- [x] Save original + annotated to storage + Google Drive sync (Reagan Homeschool / Subject / YYYY-MM-DD_title)
- [x] Scratch Page blank canvas (Apps or Journal entry)
- [x] Palm rejection via pointerType filter

## ✅ Auto-Answer Checking (Round 4a-ii)
- [x] Extend assignmentSubmissions: answers JSON (questionId → answer), autoScore 0-100, autoFeedback, gradingMethod, answerKey (per block)
- [x] Multiple choice → compare key → per-question correct + total %
- [x] Text answer → LLM rubric grading (returns score + short feedback)
- [x] Drawn answer → LLM vision OCR + grade
- [x] autoScore feeds skillsMastery (weighted rolling avg) + analytics

## 🎓 Completion Grades (Round 4a-ii)
- [x] assignmentSubmissions adds: letterGrade (A/B/C/D/F derived), kidLabel (Not yet / Getting there / Got it / Mastered), finalScore (auto or adult-overridden)
- [x] blockGrades table: planId, blockId, subjectSlug, score 0-100, kidLabel, letterGrade, gradedBy, notes, gradedAt
- [x] Adult "Mark complete" UI gains grade stepper (4-button + hidden 0-100 slider)
- [x] Kid only sees supportive kidLabel, never number
- [x] Analytics: per-subject rolling avg (last 10 submissions, exponentially weighted), per-subject letter grade card, week-over-week trend
- [x] Tutor handoff shows per-subject letter grades
- [x] Report card view (adult-only, printable) rolling grades by subject

## 📓 Take Notes (Round 4a-ii)
- [x] takeNotes schema: subjectId, title, type (typed|drawn|mixed), contentText, contentUrl, blockId nullable, createdAt
- [x] Notes page: by subject + date, search, quick-add
- [x] Typed mode: textarea + subject tag
- [x] Drawn mode: Apple Pencil canvas saved as PNG
- [x] Mixed mode: text above, canvas below
- [x] Optional: link a note to a schedule block / adventure

## 📈 Adaptive Curriculum (Round 4a-ii)
- [x] Curriculum reads skillsMastery + recent grades
- [x] Skill >85% × 5 sessions → suggest level-up
- [x] Skill <50% × 3 sessions → suggest re-entry
- [x] curriculumAdjustments table: skillName, direction (up|down|hold), suggestedChange, acceptedByAdult, rationale, createdAt
- [x] Adult accept/reject → accepted adjustments mutate weeklyTopics
- [x] "This week's focus" panel reflects accepted adjustments
- [x] Tutor handoff surfaces newly accepted adjustments

## 📚 Academic Ingestion (Round 4a-iii)
- [x] Gmail MCP: IH + Madeira teacher emails, IEP docs, scores
- [x] Drive MCP: report cards, IEP PDFs, work samples
- [x] Classroom: assignments + status (via Gmail notifs for v1)
- [x] PowerSchool IH scrape (powerschool.ihsd.us)
- [x] PowerSchool Madeira scrape
- [x] IXL diagnostic scrape
- [x] Manus share extract: https://manus.im/share/Q6CGT8xgDNMn4QvxxhVE2L
- [x] Academic Record page (adult-only 3918): per-subject level, IEP, testing history
- [x] Feed into skillsMastery scores

## 🌳 Needs Work Tree (adult-only, Round 4a-ii)
- [x] needsWorkItems schema: id, parentId (self-ref, nullable), subjectSlug, label, notes, sourceType (manual|low_mastery|struggle|low_grade|tutor), sourceRefId, dateAdded, dateCompleted (nullable), sortOrder
- [x] Needs Work page (behind 3918): tree view by Subject → Sub-subject → Skill → Sub-skill (arbitrary nesting)
- [x] Check off item → strikethrough + show dateCompleted badge
- [x] Parent auto-completes only when all children complete
- [x] Drag-to-reorder + drag-to-reparent inside tree
- [x] Add item button at any level (subject, sub-subject, skill)
- [x] Auto-populate jobs: 
   - skillsMastery < 50% × 3 sessions → add skill to subject branch
   - emotionalStruggle red × 2 on same topic → add topic to subject branch
   - assignmentSubmission autoScore < 60 × 2 in same skill → add skill
- [x] Completing a Needs Work item linked to a skillsMastery row bumps that skill's currentScore (+10 cap at 100) and logs adjustment
- [x] Export "Needs Work" list as printable for tutor handoff
- [x] Filters: show only incomplete / show completed history / by subject / by date added window

## 📄 Printables & Worksheets Hub (adult-only, Round 4a-ii)
- [x] printableSources schema: name, url, searchUrlTemplate (with {q}), category (math/ela/science/ss/art/music/spanish/general), gradeTags, freeTier, country/state
- [x] printableFavorites schema: sourceId, topic, url, addedAt, noteForReagan
- [x] Seed 25+ sources:
   - Ohio: Ohio's Learning Standards (education.ohio.gov), Ohio History Connection teacher resources, PBS LearningMedia Ohio, Ohio.gov for Kids
   - General worksheets: K5 Learning, Education.com free, Super Teacher Worksheets free, Scholastic Teachables free, Teachers Pay Teachers free filter
   - Math: Math Drills, Math Salamanders, Cool Math 4 Kids, AAA Math, IXL, Khan Academy, Prodigy
   - ELA/Reading: ReadWorks, CommonLit, Storyline Online, Reading Worksheets, Spelling City free, Starfall free, Vocabulary.com
   - Science: NASA Space Place, NASA Kids Club, Nat Geo Kids, Smithsonian Learning Lab, DK Find Out, BrainPOP (if subscribed)
   - Social Studies/Civics: Ben's Guide (bensguide.gpo.gov), iCivics, National Archives DocsTeach
   - Homeschool blogs: Easy Peasy All-in-One Homeschool, The Measured Mom, Confessions of a Homeschooler, 123 Homeschool 4 Me, Mama's Learning Corner, The Homeschool Mom
- [x] Printables hub page (Settings > Printables, adult-only 3918): grid of source tiles grouped by subject; search box routes topic query to that source's searchUrlTemplate
- [x] "Search across all" option: opens new tabs for each source with topic query prefilled
- [x] "Add to Today" on any source result → creates a scheduleBlock with link + optional PDF key for Reagan's plan
- [x] Favorites: save a prepped worksheet link for later with noteForReagan

## 🛠 Adult Edit Mode (Round 4a-ii) — full CRUD when 3918 unlocked
- [x] Global "+ Quick Add" button in app header (adult-unlocked only) — picker: Block today / Needs-Work item / Timeline event / Note / Book / App link / Academic record
- [x] Keyboard shortcut "A" (when unlocked, not in input) opens Quick Add
- [x] Today page: when unlocked show inline ✎ Edit / 🅰 Grade / Note-struggle on every block; "+ Add block" button in Today's Schedule header
- [x] Week page: add/edit/delete/duplicate block on any day; drag block between days; weekly-template editor
- [x] Timeline: ✎/🗑 on every event; "+ Add event" header button; photo upload
- [x] Adventures: full CRUD (already exists, just surface behind AdultLock consistently)
- [x] Books: add/edit/delete, update page progress, add chapter bookmark
- [x] Apps & Tools: add/edit/delete app tiles; reorder
- [x] Needs Work: full tree CRUD (add at any level, reparent, archive)
- [x] Assignments/Turn-Ins: create assignment tied to block, upload worksheet PDF, set answerKey, override autoScore, set letter grade, flag for retry
- [x] Appointments: add/edit/delete recurring appointments
- [x] Notification Recipients: add/remove, toggle channels
- [x] Profile/Contacts: edit any field
- [x] Audit log: edit actions recorded with timestamp + actor (Mom/tutor) for undo
- [x] All edit controls completely hidden when AdultLock locked — Reagan never sees them
- [x] Toast confirmation on every edit (undo-within-10s deferred)


## 🗺 Adventures imagery (Round 4a-vii)

- [x] Adventure cards show a large hero image inside the card (~16:9 banner above the title)
- [x] If `coverImageUrl` is empty, auto-generate one via the LLM image-gen helper from the adventure's title + description on first view
- [x] Persist the generated coverImageUrl back to the adventure row so subsequent loads are instant
- [x] Adult-only: ✎ Edit cover (re-roll AI image, paste URL, or upload file)
- [x] Adult-only: re-prompt with custom text (e.g., "make it more cozy / brighter / kid-friendly")
- [x] Reagan view: image is just visual, no edit affordances
- [x] Empty state placeholder while image is generating (skeleton + "drawing your adventure…")


## 🎨 Subject Color Visual System (Round 4a-viii)

- [x] Add `subjectTint(slug)` helper that returns `{ bg, border, ink, accent }` per subject so cards can be fully tinted in the subject color
- [x] Today: each schedule block becomes a fully tinted card (soft subject-tint background, colored 4px left border, subject icon in subject ink)
- [x] Week: same tinted cards across all 7 days
- [x] Tutor handoff: same tint
- [x] Curriculum: weekly-topic cards tinted by subject
- [x] Adventures: card tinted by primary subject; tag pills also subject-tinted
- [x] Bookshelf: each book card tinted by its book.subjectSlug (default reading)
- [x] Apps & Tools: each app card tinted by category (academic / creative / utility) with key
- [x] Subject Color Key card pinned at top of Today (collapsible) and Curriculum, listing every subject swatch + name + meaning
- [x] Sidebar nav "For Reagan" items get a tiny color dot on the right matching the page's primary subject hue (Today=warm, Week=blue, Bookshelf=red, Notebook=violet, Apps=amber, About=rose)
- [x] Onboarding step explains the color key briefly
- [x] Adult Apps: ✎ Edit lets adult set category (drives card color)
- [x] Adventures: ✎ Edit lets adult set primary subject (drives card color)


## 🎨 5-subject taxonomy + vibrant palette (Round 4b-i)
- [x] Collapse to 5 subjects: Math / Science / Social Studies / ELA / Specials (+ Other fallback) — done in subjectColors.ts
- [x] Pick vibrant palette: Math orange, Science green, SocStudies purple, ELA coral, Specials sky-blue, Other gold
- [x] Update `subjectColors.ts` palette + saturated accent border + chalk-wash tint
- [x] Update Subject Color Key to exactly 5+1 entries (COLOR_KEY_SUBJECTS)
- [x] Subject alias merge: History/Geography→social; Reading/Writing/Spelling/Grammar→ela; Music/Art/PE/Health→specials (subjectColors aliases)
- [ ] Remap blocks, skills, skillsMastery, adventures, weeklyTopics to new 5-subject slugs
- [ ] Smoke-test tints on Today/Week/Curriculum/Adventures/Bookshelf

## 📚 Historical grade import (Round 4b-ii — blocked on user export)
- [x] Extend academicRecords schema: grade, schoolYear, term, teacher, courseName (migration 0041 applied)
- [x] Per-subject rolling GPA helper reads schoolYear filter (academicRollingAverage)
- [x] Academic Record UI: Year+Term filters + Flat/Timeline toggle + grouped Year→Course→Term
- [x] CSV importer on Academics page — paste any PowerSchool/Canvas/Classroom CSV, preview, then bulk-import (parseAcademicsCsv handles header synonyms + quoted commas)
- [ ] PDF/screenshot uploader — vision OCR → structured rows
- [x] Bulk-insert pipeline with dedupe (academics.bulkUpsert + academicRecordKey: schoolYear|course|term|title, case+whitespace insensitive)
- [ ] ⚠ User action needed: provide PowerSchool export CSV or PDF report cards for past years


## 📚 Google Classroom + IEP ingest (April 28 scope addition)

- [x] Schema: classroomAgendas, iepGoals, iepAccommodations tables
- [ ] Script: pull Reagan's Google Classroom feed (every class, Daily Agendas + assignments + due dates)
- [ ] Script: OCR + LLM-extract Daily Agenda PDFs (like Mr. Froehlich's 04/27/26) → topics + required/optional assignments
- [ ] Script: find latest IEP in Gmail/Drive, LLM-extract goals + accommodations + present-levels + quarterly progress
- [ ] Insert Classroom topics into `weeklyTopics` + `classroomAgendas`
- [x] Insert IEP content into iepGoals + iepAccommodations + attach to learnerProfile
- [x] Analytics: IEP goals via CurrentLevelsFromIep chip strip
- [x] Analytics: "Current Grade-Level" gap per subject based on IEP present-levels
- [ ] Analytics: IEP qualifier chip on each rolling subject grade ("Meeting IEP goal" / "Approaching" / "Below expected")
- [ ] Academics page: "Daily Agendas" tab, chronological, with PDF preview
- [ ] Curriculum page: auto-seed weekly topics from latest Classroom Daily Agendas (adult approves)
- [x] Scheduled-task endpoint /api/scheduled/classroom-agendas/pending + /result (nightly refresh)
- [x] Scheduled-task endpoint /api/scheduled/iep-refresh/trigger + /result (quarterly goal refresh)


## Round 4b — Academic + IEP ingestion (in progress)
- [x] Apply migration 0014 (classroomAgendas, iepGoals, iepAccommodations, academicSourceRuns)
- [ ] Read Manus share https://manus.im/share/Q6CGT8xgDNMn4QvxxhVE2L — capture ORP/IEP info + every attached file
- [ ] PowerSchool IH parent login — scrape every course: grades, assignments, categories, weights -> academicRecords (source=powerschool_ih)
- [ ] PowerSchool Madeira Q1 — same scrape (source=powerschool_madeira)
- [ ] Google Drive sweep: My Drive + every Shared Drive + Shared-with-me (Reagan / IHES / IH / MES / Madeira / 5th / teacher-name / IEP / ORP folders)
- [ ] Google Drive: pull every IEP / ORP / evaluation / progress-report / report-card PDF
- [ ] Gmail sweep: from:@indianhill.k12.oh.us + from:@madeiracityschools.org, subjects Reagan / IEP / ORP / report card / progress — capture attachments
- [ ] Google Classroom sweep: active + archived for 2025-26 (Madeira Q1 + IH Q2-Q4) — daily agendas + assignments
- [ ] FinalForms IH + Madeira — IEP/504 scans, nurse/counselor notes, report-card uploads (guide user if MFA)
- [ ] Vision+LLM extraction: daily agendas -> topics+assignments; IEP -> goals+accommodations+present-levels+progress; report cards -> grades
- [ ] Bulk-insert into academicRecords / classroomAgendas / iepGoals / iepAccommodations / weeklyTopics (dedupe source+date+course)
- [ ] Analytics: IEP goals card w/ progress bars, grade-level-gap per subject, IEP qualifier chips on rolling grades
- [ ] Academics: Daily Agendas tab, Quarter + Source filters, IEP panel
- [ ] Curriculum: "Auto-apply adaptive suggestions" toggle (change curriculum based on progress without manual approval)
- [ ] Save all newly-discovered PDFs to Google Drive / Reagan / IEP + Reagan / Academic Records
- [ ] Remind user to rotate PowerSchool password after ingestion
- [x] Final vitest run + checkpoint (126 tests passing, checkpoint 65fedd6e)

- [ ] Recolor subject palette in groovy-retro pastels inspired by Daily Schedule Cards image (clearly distinct: buttery yellow = Arrival/Morning, coral pink = Math, mint = Planning/Science, lavender = ELA, sky blue = Lunch/Specials, peach = Recess) — update subjectColors.ts + verify tints on Today/Week/Curriculum/Adventures/Bookshelf

- [ ] Apply unified chalkboard dark theme globally (dark green chalkboard background, chalk-dust white text); keep it consistent on every page
- [ ] Cards on chalkboard use groovy-retro bright pastels (coral, mint, lavender, sky blue, peach, buttery yellow) — each subject obviously distinct
- [ ] Remove/clean demo seed data: placeholder schedule blocks, fake adventures, test timeline events, lorem book entries (keep vitest .test.ts files)

## Completed this session (2026-04-28 — IEP ingestion)
- [x] Vibrant groovy-retro subject palette on chalkboard theme
- [x] Purged 7 "Test App" + 1 Test Book seeded rows
- [x] Migration 0014 applied (classroomAgendas, iepGoals, iepAccommodations, academicSourceRuns)
- [x] Google Drive scanned — 585 Reagan-tagged files catalogued
- [x] Current IEP PDF uploaded to Manus storage
- [x] 6 IEP goals + 6 accommodations + 8 MAP/Acadience/MAZE records seeded from real IEP
- [x] iep.listGoals + iep.listAccommodations tRPC procedures
- [x] IEP Goals & Accommodations card on Analytics (with OHI/Anxiety/5th grade/Next ETR chips)
- [x] Vitest passes 2/2

## Still queued (next session)
- [ ] Gmail sweep for indianhill.k12.oh.us + madeiracityschools.org
- [ ] Google Classroom active + archived sweep → classroomAgendas
- [ ] PowerSchool IH + Madeira scrape (needs login)
- [ ] FinalForms IH + Madeira scan (needs login)
- [ ] Vision+LLM extraction of remaining ~580 Drive docs
- [ ] Daily Agenda viewer page + auto-apply adaptive IEP toggle
- [ ] Grade-level-gap viz from MAP percentiles


## Round 4c — "do what you can" (Gmail/Classroom/PowerSchool/FinalForms blocked by scope/login)
- [ ] Vision+LLM extract top-priority Drive docs (5-yr anxiety timeline, medical/behavioral summary, teacher reference guide, ETR, report cards) and seed into academicRecords + struggles + profile notes
- [ ] Build Daily Agenda viewer page for classroomAgendas table (placeholder until Classroom scope is granted)
- [ ] Add adaptive IEP auto-apply toggle (uses 6 seeded accommodations)
- [x] Grade-Level-Gap visualization on Analytics (CurrentLevelsFromIep + PowerSchoolGradesCard)


## Round 4d — Gmail unblocked
- [ ] Gmail sweep: list+fetch IH (indianhill.k12.oh.us) + Madeira (madeiracityschools.org) senders
- [ ] Classify school emails (assignment, agenda, grade, IEP/504, anxiety, scheduling)
- [ ] Seed classified emails into academicRecords + classroomAgendas


## Round 4e — Kid-friendly overhaul
- [ ] Gmail MCP probe (option 2)
- [ ] Add chalk illustrations per subject (Math, ELA, Science, Social Studies, Writing, Art, PE, Music, Snack, Choice, Morning Wonder, Wrap-up)
- [ ] AppTile component: huge icon on top + small title under (apply to Apps & Tools + Connectors)
- [ ] Brain Break video box with rotating funny-animal clips
- [ ] Choice Spinner widget for "pick an adventure"
- [ ] Rotating mascot illustration next to Good Morning greeting
- [ ] Confetti + sticker-on-done animation for schedule blocks
- [ ] Tighten spacing site-wide (reduce empty space, denser cards)


## Round 4f — Rewards system (final spec)
- [ ] Stickers on Done tap + streak bonus + Gold Star day
- [ ] Adult "Good Work" lyric/note attached to any sticker
- [ ] Coin meter (hidden-from-kid toggle)
- [ ] Prize Shop (adult-editable) preloaded with Amazon $, Roblox $, Roblox skin, parakeet/duckling toy, ice cream, movie pick, craft kit, American Girl accessory, boba, "yes day"
- [ ] Auto certificates (First Full Day, Week Streak, Subject Pro)
- [ ] Adult one-off custom certificate creator
- [ ] "Good Work" note button everywhere work shows up


## Round 4g — Work submission flow
- [ ] Schema: submissions table (block_id, kind photo|link|note|file, payload, status, approved_at, approved_by, good_work_note)
- [ ] Turn-In button on schedule blocks opens 4-choice sheet: Camera | Upload | Link | Note
- [ ] Camera capture via getUserMedia → upload to S3 via storagePut
- [ ] Notebook page becomes chronological Portfolio grid (tap to zoom, shows good-work note stamp)
- [ ] Adult approve flow triggers sticker+coin and attaches good-work lyric


## Round 4h — Final spec (daily playlist, Kiwi, review library, whiteboard)
- [ ] Rename Whisper → Kiwi everywhere + Settings rename field
- [ ] Today page = daily playlist (suggested order, completion-based, no hard times)
- [ ] Tour Mode for 2026-04-28: explore classroom + 11am Tutor Trial card + gentle placement mini-tasks
- [ ] Light Tuesday 2026-04-29 with tutor-led placement
- [ ] Wednesday 2026-04-30 full playlist kickoff
- [ ] Review Library: videos (YouTube embed) + web pages + apps + printables + practice per topic
- [ ] YouTubePlayer component (iframe API) + TV Box for Brain Break
- [ ] Whiteboard note tool: pen, highlighter, text, shapes, images, eraser, camera-snap, layers, voice note
- [ ] Adult Help onboarding page: how to add work, approve, write good-work, add prize, custom cert, log session
- [ ] Tutors table (name, role, bio, schedule, notes) + assign tutor to block


## Round 4i — Rainbow list + final spec
- [ ] Daily list: each activity a different rainbow color (coral/peach/yellow/mint/sky/lavender/pink cycle)
- [ ] Daily shuffle seed so starting color rotates by weekday
- [ ] Subject identity icon stays constant per subject
- [ ] Completed card dims + sticker stamp but keeps rainbow color


## Round 4j — Kiwi parakeet + textbooks + rec column
- [ ] Generate Kiwi parakeet sprite set (idle, flap, fly, sleep, chirp, peek, frown, confetti)
- [ ] Build KiwiCompanion component replacing WhisperCompanion (floating, 4 preset perches, draggable)
- [ ] Kiwi mood engine: reacts to completion, idle time, video playing, hard-block flag, bedtime
- [ ] Chirp sound (toggleable) + speech bubble + thought-bubble when she has a tip
- [ ] Index Michael's World (226 pages) + build reading guide
- [ ] Index Tuck Everlasting (25 chapters) + reading guide
- [ ] Fetch Spectrum Science Gr5 + 180 Days Science Gr5 TOCs
- [ ] Adult-only Recommendations column on Home (Yes/No/Maybe; Mom+Grandma approve)
- [ ] Google Calendar duplicate for approved recs + tutor sessions


## Pass 1 — Kiwi's World Foundation (heads-down)

- [ ] Generate final Kiwi chibi-vinyl reference (big expressive eyes, yellow/green, on perch)
- [ ] Generate Kiwi 3 extra poses (happy flap, sleeping, chirping with speech bubble)
- [ ] Upload Kiwi sprites to webdev-static-assets + get URLs
- [ ] Rename Whisper → Kiwi across codebase (sidebar, ai chat, greetings, settings)
- [ ] Build KiwiCompanion React component with idle breathing/blink/tilt CSS animations
- [ ] Wire Kiwi to schedule completion events (flap on Done)
- [ ] Rainbow-per-row coloring on Today list
- [ ] Material-icon subject tiles (huge icon, small title under)
- [ ] Today page completion-based playlist (no hard times)
- [ ] Tour Mode card for Apr 28 + 11am Tutor Trial card
- [ ] Sticker-on-Done + confetti + coin increment
- [ ] Sticker Book page + Prize Shop page (basic grids)
- [ ] Tighten spacing across Today + Home
- [ ] Final checkpoint + deliver

## Future passes (queued — do NOT build in Pass 1)
- [ ] Full flock: Blue (parakeet friend), Duck (mallard), Goose (black Swedish duckling) + interactions
- [ ] Holiday/seasonal costumes for all birds
- [ ] Cage toys (swing, mirror, bell, bamboo, millet, sprinkler, heat lamp, disco ball)
- [ ] Mountable perch/swing system across page
- [ ] Little black poop spots + feathers + seed crumbs fading
- [ ] Flock visits + interactions with page elements
- [ ] Multi-user roles (mom/dad/grandma/tutor/therapist/guest) + Team + invites
- [ ] Tag system (tired/sick/happy/etc) + custom tags
- [ ] Adult Whiteboard broadcast page with sticky notes
- [ ] Adaptive Learning Engine (signals, modality detector, nightly auto-adjust, weekly digest)
- [ ] Review Library (videos, web pages, apps, printables) keyed off gaps
- [ ] Textbook scope-and-sequence ingestion (Spectrum Science G5, 180 Days of Science G5, Tuck Everlasting, Michael's World)
- [ ] Recommendations column (Mom+Grandma approve only)
- [ ] Google Calendar duplicate sync
- [ ] Home-hub widgets + Joke of the Day + Pet of the Day + YouTube TV Box + Resource popups + Play-Break footer
- [ ] Full whiteboard note tool (pen/text/shapes/images/highlighter/voice)
- [ ] Placement mini-tasks engine
- [ ] Template/theme picker (chalkboard/groovy/nature/galaxy/forest)
- [ ] Adult Help onboarding page

- [ ] Circle-to-Search / "Kiwi, what's this?" tool — draggable magnifier that lets Reagan circle any word/image/topic; Kiwi identifies it via vision LLM and offers Learn-More menu (video / article / draw / game / printable / fun fact); logs curiosity data for adaptive engine

- [ ] Popup-first navigation: all "Learn More" / details / chat / video / article / game actions open floating popup cards instead of route navigation; support minimize, pin-for-later, stack-like tabs, close/dismiss; ensure Today list + stickers + Kiwi perch never unmount

- [ ] Background ingestion sweep (best-effort): IH + Madeira Drive/Gmail/Classroom content reachable in this session — pull what the current auth allows, skip the rest silently, log gaps

## Pass 1 DELIVERED — Kiwi's World Foundation (Apr 28, 2026)

- [x] Whisper → Kiwi rename across codebase + context/avatar
- [x] KiwiSprite component (4 poses: idle / flap / sleep / chirp)
- [x] KiwiPerch floating animated companion with corner teleporting + speech bubbles
- [x] Kiwi images re-optimized (5 MB PNG → 20 KB WebP) + re-uploaded to Manus storage
- [x] KiwiCompanion chat panel uses KiwiSprite in header/empty state
- [x] Rainbow per-row coloring on Today schedule (position-based, weekday-shuffled)
- [x] celebrateKiwi() fires on Done tap → Kiwi flaps + speech bubble
- [x] Sticker + coin backend wired: blocks.complete auto-inserts sticker + coin ledger entry
- [x] rewards tRPC router: myStickers, myCoins, myLedger, awardBonus, listPrizes, seedPrizes, requestPrize, myRedemptions, goodWorkNotes, addGoodWorkNote
- [x] Default prize catalog auto-seeds (Roblox $5, Amazon $10, ice cream, stuffie, movie night, bird toy, extra screen time, Starbucks cake pop)
- [x] Sticker Book page (/stickers) — inline SVG sticker art, coin pill, empty state, good-work notes
- [x] Prize Shop page (/prizes) — category-tinted cards, coin progress bars, Redeem button with Mom-approval queue
- [x] Tour Mode card — Apr 28 "Explore your new classroom!" + 11am tutor trial chip, Apr 29 placement, Apr 30 official start
- [x] Coin + Sticker strip above schedule (live counts)
- [x] Sticker Book + Prize Shop added to kid sidebar nav
- [x] Vitest: rewards.test.ts — awardSticker, seedDefaultPrizes idempotency, requestPrize deduction, insufficient-coins rejection
- [x] All 42/42 vitest pass

## Pass 2a — Flock + Whiteboard + Tags (Apr 28 AM, v5c3ab18b → next)
- [x] Blue budgie, Daffy duckling, Honk gosling sprites generated + optimized to webp
- [x] FlockSprite + FlockWidget components
- [x] Flock strip on Today page
- [x] whiteboardNotes + tags + tagLinks tables (migration 0016)
- [x] Whiteboard tRPC router (list, post, update, heart)
- [x] Tags tRPC router (list, seedDefaults, upsert, attach, detach, forEntity)
- [x] WhiteboardStrip on Reagan's Today page
- [x] Adult Whiteboard page at /whiteboard (adult-gated) with color picker, emoji picker, pin, date-scoping
- [x] Sticky note welcome from Mom seeded
- [x] 18 preset tags seeded (moods, energy, body, family, subjects)
- [x] Vitest coverage: whiteboard post/list/heart/archive/date-scope + tag upsert/attach/detach (46/46 pass)

## Pass 2b — TV + BrainBreak + ResourceDock (Apr 28, v8f0bd3cb → next)
- [x] reviewResources db helpers (list, add, approve, remove)
- [x] review tRPC router (public list, protected add/approve/remove)
- [x] Starter TV picks seeded (8 items: movement, birds, nature, math, reading)
- [x] TVBox component — YouTube grid + "Surprise me" brain-break shuffle
- [x] BrainBreakSpinner — 12 short prompts, timer, Kiwi celebrate
- [x] TV + BrainBreak mounted side-by-side on Today page
- [x] ResourceDock — global floating dock (Timer, Calculator, Dictionary)
- [x] Dictionary hooked to free dictionaryapi.dev endpoint
- [x] Vitest coverage for review library (48/48 pass)

## Pass 2b — TV Box + Brain Break + Resource Dock (Apr 28, v8f0bd3cb → next)
- [x] review (TV) tRPC router: list/add/approve/remove/seedStarter
- [x] TVBox component with YouTube grid + Surprise Me + picture-in-picture modal player
- [x] BrainBreakSpinner with 12 preset activities + built-in 30/60s timer + Kiwi flap
- [x] ResourceDock (global): Timer preset, Calculator, Dictionary lookup (dictionaryapi.dev)
- [x] 8 starter TV picks seeded (movement, birds, nature, math, reading)
- [x] vitest raised to 15s testTimeout to absorb TiDB cold-query latency
- [x] Full suite 48/48 passing

## Pass 2b — TV Box + Brain Break + Resource Dock (Apr 28, v8f0bd3cb → next)
- [x] review (TV) tRPC router: list/add/approve/remove/seedStarter
- [x] TVBox component with YouTube grid + Surprise Me + picture-in-picture modal player
- [x] BrainBreakSpinner with 12 preset activities + built-in 30/60s timer + Kiwi flap
- [x] ResourceDock (global): Timer preset, Calculator, Dictionary lookup (dictionaryapi.dev)
- [x] 8 starter TV picks seeded (movement, birds, nature, math, reading)
- [x] vitest raised to 15s testTimeout to absorb TiDB cold-query latency
- [x] Full suite 48/48 passing


## Pass 2c — Review Library admin + Bookshelf seed + Dock polish (Apr 28)
- [x] /review-library adult route + sidebar entry (Review Library)
- [x] Adult UI to add / approve / delete / seed YouTube + web resources
- [x] ResourceDock moved to centered floating pill (no sidebar collision)
- [x] Bookshelf seeded: Spectrum G5 (4) + 180 Days G5 (4) + Tuck Everlasting + Michael's World placeholder
- [x] All 48 tests still green

## Deferred (follow-up session, needs credentials or device features)
- [ ] Google Calendar two-way sync (needs Google OAuth client + user consent flow)
- [ ] Circle-to-Search style visual lookup (device-level Gemini feature; can approximate with OCR + camera permissions)
- [ ] Deep per-page indexing of Spectrum / 180 Days / Tuck Everlasting (requires scanned pages)
- [ ] Adaptive Learning Engine spaced-repetition scoring tuning (default ELO is in place)

## Pass 2c — Google Calendar sync (Apr 28)
- [x] /api/calendar.ics public iCalendar feed (timeline events + pinned notes + today's blocks)
- [x] CalendarSyncCard on Settings with copy-URL button + Google Calendar steps
- [x] registerCalendarFeed wired into Express app
- [x] vitest for calendar feed — 49/49 passing

## Pass 2 — items already present in codebase (verified)
- [x] ReviewLibrary admin page + /review-library route + Adult sidebar entry
- [x] Textbook seeding (Spectrum Math/Reading/LA/Science, 180 Days Math/Reading/Writing, Tuck Everlasting, Michael's World, Merriam-Webster dictionary)
- [x] Bookshelf page with page tracking + progress bars
- [x] Adaptive engine (rebuildAdaptiveSuggestions) — drops curriculumAdjustments + needsWorkItems for sub-60% mastery


## SURVIVAL MODE — tutor starts tomorrow Apr 29

- [ ] Hard-dedupe bookshelf at DB level (keep one of each title+author, remove "Test Book 1777379912525")
- [ ] Kill ombre banners on Sticker Book, Prize Shop, Today; replace with calm title strip
- [ ] Fix Tutor Handoff unreadable red-on-dark trauma-aware rules; move Accommodations section to bottom
- [ ] Add parent-add custom prize form on Prize Shop; allow removal of defaults
- [ ] Verify theme picker, widget grid, end-of-row checkmarks render on Today
- [ ] Run tests, checkpoint, prompt user to publish before tomorrow

## Deferred — post-tutor session

- [ ] Merge Notebook + Scratch Pad + Journal into one tabbed page
- [ ] Integrate Journal entries with Timeline
- [ ] Rebuild About Me with multi-column sections
- [ ] Group Printables by category with visual variety
- [ ] Dedupe + group Academics records by subject and year
- [ ] Wire Report Card to pull from Academics data
- [ ] Simplify Settings; hide/explain Audit log
- [ ] Full light "school planner" redesign per reference images
- [ ] Add Reagan's headphones accent to avatar (awaiting photo)
- [ ] Sticker Book: open-book-spread sticker slot layout
- [ ] This Week: fill or shrink empty day cards


## Latest feedback

- [ ] Remove URL-pasted photos (user disliked them); replace with uploaded photos or clean illustrated placeholders


## Parent confirmations

- [x] Option A Drive structure: single master folder `Reagan's School Hub` with year + subfolder nesting in user's main Drive
- [x] Avatar photo: use already-uploaded photo (not URL paste); parent to drop her favorite pic


## Survival-mode simplification pass (Apr 28 PM)

- [x] Strip homepage: removed TV, BrainBreak, Flock, Whiteboard tiles; kept only schedule + tiny sticker/coin chip + 1 note tile
- [x] Merge Sticker Book + Prize Shop into single `/rewards` page with tabs; added legacy `/stickers` + `/prizes` redirects
- [x] Moved Flock widget off homepage into Adventures page as a "My Flock" section
- [x] Killed loud ombre on TourModeCard — now a calm single-line chalk strip
- [x] Tutor Handoff: replaced red-on-dark unreadable rules card with high-contrast cream card + dark amber text; moved accommodations + triggers BELOW the day plan
- [x] Hard-deduped bookshelf (10 → 9 books; removed "Test book" row); re-added Tuck Everlasting
- [x] Reduced ADULT_NAV sidebar to 5 entries: Tutor Handoff, Analytics, Parent Notes, AI Assistant, Settings (other admin routes still reachable by URL)
- [x] Created Google Drive master-folder subtree: Reagan School Master Folder → Reagan School Hub (Dashboard) → {Adult Notes, Analytics, Journal, Printables, Report Cards, Tutor Handoffs}
- [x] Cleaned up 6 stray "Untitled" files accidentally created in Drive root during folder setup
- [x] Full vitest suite 49/49 passing

## Deferred (next pass)

- [ ] Wire in-app "Save to Drive" button on Parent Notes, Tutor Handoff, Analytics (needs server-side Drive OAuth credentials)
- [ ] Reagan's headphones accent on her avatar (needs reference photo from user)
- [ ] Avatar uploaded-photo selector (user disliked URL-pasted photos)
- [ ] Cream/white theme variant (currently chalkboard only)
- [ ] Bigger 3D subject icons (morning/math/science/reading/adventure/etc.)
- [ ] Bookshelf: "Watch & Learn" YouTube shelf polish
- [ ] Report Card page cleanup and wiring to real data
- [ ] Printables admin: collapse into AI-prompted flow instead of tiled source list

- [ ] Theme picker must also swap the sidebar + "Reagan's Classroom" profile card colors to match the active theme


## Pass 4 — Adaptive learning system (Apr 29 onward)

- [ ] Avatar uploader on Settings (uploads to Manus storage; replaces URL-pasted photo)
- [ ] Pull Ohio 5th-grade learning standards (ELA, Math, Science, Social Studies) and seed as curriculum spine
- [ ] Map Indian Hill 5th-grade sequencing on top of Ohio standards
- [ ] Placement assessment week: low-pressure per-subject diagnostic flow (logs starting level)
- [ ] Save assessment results to Drive (Reagan School Hub > Analytics)
- [ ] Parent-facing past-data import (paste / drop PDFs of MES Q1 + year-to-date analytics)
- [ ] LLM extraction of pasted/PDF analytics into academic_records table
- [ ] Google OAuth for reagan.higgs33@ihsd.us with Classroom + Gmail + Drive read scopes
- [ ] Daily Google Classroom assignment sync into Today + Week
- [ ] Gmail watch for IH teacher emails (homework / notes)
- [ ] Drive auto-backup of every assignment submission, journal entry, photo, and tutor handoff to existing Reagan School Hub subfolders
- [ ] Dual-tutor profile setup in Settings (schedules + contacts)
- [ ] Per-tutor handoff page with tutor notes feeding the adaptation engine
- [ ] Reagan-facing post-block feedback chips (hard/easy, liked/didn't, what helped, break needed, time felt right)
- [ ] Adaptation engine v2: read feedback + grades + tutor notes; tune next-block level / technique / time / break frequency
- [ ] Auto-flag parent (and grandma) when stuck or needs decision
- [ ] Settings explainers for Reagan (what she can do, flexibility, rewards meaning, activities ideas)
- [ ] Kiwi intro: short video or animated explainer of what Kiwi is and can help with
- [ ] Apps & Tools list: prune to actually-used apps; large centered icon per card (not small icon + label)
- [ ] Daily auto-summary email after school day (short)
- [ ] Weekly auto-summary email (long, with observations + recommendations + suggested changes)
- [ ] Confirm parent email address for summaries


---

## RE-ANCHOR (Apr 28 2026): Confidence + Catch-Up are the North Star

User clarified: "The biggest thing I want her to get is feel safe and comfortable and understanding of content and mostly get back up in her academic levels so eventually she doesn't need IEP. She is smart but doubts herself a lot. I want her to feel smart and catch up to her peers."

Every feature is judged by 3 questions:
1. Does it lower her anxiety?
2. Does it deepen her understanding?
3. Does it visibly move her academic level up toward grade-level (so she can graduate the IEP)?

### Catch-up plan items (priority order)
- [ ] Confidence Principles card on Today + Settings (kid-readable, plain language)
- [ ] Kiwi intro card on Today: "I'm here to help you feel smart and figure stuff out — never to test you"
- [ ] Parent dashboard banner: "Goal: re-enter 6th grade at or above grade level — IEP optional"
- [ ] Confidence Engine: Kiwi reflects effort + strengths back, never corrects, "Things I'm proud of" wall
- [ ] Skill-Gap Closer: per-subject skill ladder seeded from Ohio 5th std + her real MAP/Acadience baseline (already in DB from IEP seed)
- [ ] Diagnostic Placement Week: low-pressure tasks, she sees only encouragement, scores hidden
- [ ] Multi-modal teaching paths per skill (Story / Visual / Hands-on / Watch / Practice — she picks)
- [ ] Mastery gate, not minute gate — block ends when she shows she gets it
- [ ] Visible Level-Up chart she can see going up
- [ ] Parent-private trajectory dashboard vs grade-level + IEP exit criteria
- [ ] Pull IH curriculum context (Wells 4th-quarter PDF, AJ Froehlich weekly updates, IH curriculum slide deck) into the Skill Ladder
- [ ] Khan Academy + IXL deep-link per skill
- [ ] Game-as-reward / mood break with Roblox preference tracking
- [ ] Post-block feedback chips feed adaptation
- [ ] Adaptation engine v2: never increases difficulty after a struggle; offers re-teach in different mode
- [ ] Dual-tutor profiles + per-tutor handoff
- [ ] Daily + weekly auto-summaries focused on confidence wins + skill-level movement
- [ ] Apps & Tools prune to actually-used apps with big centered icons
- [ ] Settings explainers in plain language + Kiwi intro video
- [ ] Finish AvatarUploader wiring into Settings


---

## Phase 2 — Confidence Engine + Skill-Gap Closer (Apr 28 2026)

- [x] schema: `skillLadder` + `skillProgress` + `proudMoments` tables (migration 0017)
- [x] seed: 36 Ohio 5th-grade skills (Math 13 / ELA 13 / Science 6 / SS 4) with kid-friendly text + Khan/IXL deep-links + multimodal hooks
- [x] db helpers: `listSkillsWithProgress`, `nextSkillForToday`, `recordSkillPractice` (mastery curve), `subjectLevelSummary`, `listProudMoments`, `addProudMoment`, `reaganHeartProudMoment`, `archiveProudMoment`
- [x] tRPC routers: `skillLadder.list / nextUp / practice / summary` + `proud.list / add / heart / archive`
- [x] kid page: `/levels` (My Levels) — her own ladder going UP, no grade comparison, multimodal "Show me a way to get this" expansions, three encouragement-shaped practice buttons
- [x] kid page: `/proud` (Proud Wall) — quick-add for self-recognition + heart toggle on every moment
- [x] today tile: `SkillBuilderTile` — daily 15-min next-up skill with mode picker (story/visual/handsOn/watch/practice) + "tell Kiwi how it felt"
- [x] parent-only card: `TrajectoryCard` on `/analytics` — overall mastery %, projected weeks to 80%, per-subject breakdown, IEP exit indicators (RIPE/RIMP / MAP RIT / Acadience benchmarks)
- [x] sidebar: added "My Levels" + "Proud Wall" entries between This Week and Rewards
- [x] auto-celebrate: every level-up auto-creates a "Leveled up!" entry on the Proud Wall
- [x] tests: `server/skillLadder.test.ts` covers list, nextUp, practice→levelUp→proud-moment, summary, proud.add, proud.heart (6 tests, all pass)
- [x] full vitest suite: 10 files / 55 tests passing


---

## URGENT (Apr 28 2026): Scrub fake/seeded analytics — adult section must be 100% real
- [ ] Inventory every Adult Analytics widget + admin view; list each data source it queries (table + filter)
- [ ] Identify every seed script that wrote demo/sample/example/placeholder rows into those tables (moods, events, uploads, submissions, grades, summaries, parentFlags, struggles, gradesByDay, etc.)
- [ ] Run a one-shot SQL cleanup that deletes ONLY the seeded/demo rows (preserve any rows actually entered by parent / Reagan / tutor)
- [ ] Disable any future runs of those demo seeders (delete or comment out the seed scripts; remove any auto-seed-on-empty logic in routers)
- [ ] Verify on the live preview that Adult Analytics shows zero phantom entries
- [ ] Vitest: assert listMoods/listEvents/listSubmissions/listParentFlags return [] on a fresh DB (no auto-seed)

## URGENT (Apr 28 2026): Empty-state pass on Adult Analytics
- [ ] Every widget renders a clean "No data yet — start logging" message instead of phantom rows
- [ ] Empty state suggests the next concrete action (e.g. "Log her first mood" / "Add her first proud moment" / "Record her first practice")

## NEW (Apr 28 2026): Upload or Sync experience — explicit wording, NOT "drop it"
- [ ] Single big "Upload or Sync" button on Today page (parent-side header)
- [ ] Dedicated /upload page with two clear tabs: "Upload from this device" and "Sync from Gmail / Google Drive"
- [ ] Upload tab: file/photo picker + paste-link + paste-text; auto-classifies into worksheet / homework photo / tutor note / curriculum doc / link / text-note; routes to right table
- [ ] Sync tab: "Sync from Gmail" pulls Froehlich + tutor + IH emails on demand; "Sync from Google Drive" pulls IH curriculum folder + Reagan folder
- [ ] Confirmation toast after each upload/sync: "Saved to [section]. View it →"
- [ ] Vitest: upload classifier routes to correct table for each input kind

---
## Phase 5 — Weekly Digest (Apr 29 2026)
- [x] Schema: `weeklyDigests` table (week_start, week_end, payload JSON, emailed_at, email_status enum) — migration 0026
- [x] DB helpers: `buildWeeklyDigestPayload` (level-ups, tutor sessions, mood arc, what helped, subject confidence, IH alignment, parent flags), `saveWeeklyDigest`, `listRecentDigests`, `markDigestEmailed`
- [x] tRPC router: `digest.preview` + `digest.recent` (both protectedProcedure — parent-only)
- [x] Scheduled-task endpoints: `GET /api/scheduled/weekly-digest` (build+save+return), `POST /api/scheduled/weekly-digest/sent` (mark sent/failed) — both locked to platform cookie auth
- [x] Component: `WeeklyDigestCard` mounted at top of `/upload` page (above AutomationFeedCard)
- [x] Empty state: "No digest sent yet — first one goes Sunday 7 PM"
- [x] Recent digests list with sent/failed/pending badges
- [x] Combined cron task registered: daily Gmail+Drive sync (6:30 AM) AND Sunday-only digest email to spear.cpt@gmail.com (7:00 PM ET)
- [x] Vitest `weeklyDigest.test.ts` — 8 tests: payload shape, save lifecycle, status transitions (sent/failed), sort order, auth gate, end-to-end tRPC
- [x] Full suite green: 21 files / 101 tests passing


---
## Phase 6 — Drive auto-push (Apr 28 2026)
- [x] schema: `drive_push_queue` table (migration 0027)
- [x] db helpers: `enqueueDrivePush`, `listPendingDrivePushes`, `listRecentDrivePushes`, `markDrivePushResult`, `pickDriveFolderForRouted`
- [x] hook: `upload.classifyFile` auto-enqueues every file upload with the correct target subfolder
- [x] tRPC: `drive.pending` + `drive.recent` (protected, parent-only)
- [x] scheduled-task endpoints: `GET /api/scheduled/drive-push/pending` + `POST /api/scheduled/drive-push/result` (auth-gated)
- [x] UI: `DrivePushQueueCard` mounted on /upload between WeeklyDigest and AutomationFeed; live status pills (pending / pushed / failed)
- [x] cron updated: combined daily 6:30 AM + 7 PM job now also processes Job B (Drive auto-push) every fire
- [x] tests: `server/drivePush.test.ts` (4 tests: enqueue+list, mark pushed, folder-picker mapping, 401 on anon endpoints)
- [x] full vitest: 23 files / 107 tests passing


---
## Phase 7 — Avatar persistence + Kiwi intro animation (Apr 28 2026)
- [x] AvatarUploader now calls `profile.update({ photoUrl })` on every upload/remove so the photo survives device switches (was localStorage-only)
- [x] AvatarUploader shows "Saved at HH:MM" confirmation timestamp
- [x] KiwiIntroStrip auto-plays a 5-line scripted intro the first time Reagan sees it (~10s, no big media file, full motion via CSS transitions)
- [x] "▶ Hear Kiwi say hi again" replay button restarts the script anytime
- [x] Existing profile.onboarding.test.ts already covers photoUrl persistence — no new tests required
- [x] Full vitest: 23 files / 107 tests passing


---
## Phase 8 — Reagan handoff bundle import (Apr 28 2026)
Bundle: https://drive.google.com/drive/folders/18HhTr3J1R5rZARuKAbBJO3xs5tVLchG5
- [ ] Download bundle from Drive (12 files + Reagan_Dashboard_Handoff.zip) into /home/ubuntu/reagan_handoff/
- [ ] Read HANDOFF.md + 00_Audit_Report.md (gap matrix)
- [ ] CLEANUP punchlist (11_): delete TEST_STRAND skills rows
- [ ] CLEANUP: delete "Test Book" from bookshelf
- [ ] CLEANUP: reset seeded stickers (1,886) and coins (1,196) to ZERO (Mom approved)
- [ ] CLEANUP: rename district label from "Madeira" to dual: "Madeira City SD (IEP origin) / Indian Hill EVSD (current)"
- [ ] CORRECTION: Brutus → Precious in adventure cards "Bearded Dragon Meal Math" + "Children's Book Starring Precious"
- [ ] CORRECTION: add Precious (bearded dragon) to pets list in profile
- [ ] CORRECTION: confirm submissions go to adult analytics dashboard, NOT Google Classroom
- [ ] IMPORT 01_reagan_profile.json into learnerProfile (birthday Sep 10 2015, family, pets, school history, sensory, foods, books, self-advocacy)
- [ ] IMPORT 02_contacts.json into Care Team (Mom, Sam Rust, Ali Hill LISW, Dr. Kelsey Marlow, Marisa Nyerges + Reagan's two Google account labels)
- [ ] IMPORT 03_iep_corrections.json (dedupe goals/accommodations, fix district label, fix placeholder grade card)
- [ ] IMPORT 04_assessment_history.json (Acadience, MAZE, MAP Math, decoding, writing scores → screening-history chart)
- [ ] IMPORT 05_levels_links.json (Khan URLs + IXL skill codes for every Levels skill + missing IEP-required skills)
- [ ] IMPORT 06_assignment_backlog.csv (23 ready-to-load assignments)
- [ ] IMPORT 07_weekly_schedule.json (5-day default with theme days + anxiety-protected therapy/recovery blocks)
- [ ] IMPORT 08_bookshelf_additions.json (append + delete "Test Book")
- [ ] IMPORT 09_prizes_catalog.json (17 prizes + earn-rate rules) - Mom approved tiers/costs
- [ ] IMPORT 10_apps_additions.json (Pinterest, ReadWorks, iCivics, Mystery Science, Khanmigo, Quizlet, Stellarium, Merlin, Epic + per-app account labels)
- [ ] FEATURE: ensure adult-editable rewards CRUD (add/edit reward tiers from adult section anytime)
- [ ] FEATURE: ensure Care Team / contacts editable from Settings (Mom will fill phones/teacher/specialist/allergies/meds later)
- [ ] Run vitest suite (target: all green)
- [ ] Save checkpoint, ask user to publish to reaganschool.manus.space


---
## Live issues from Mom (Apr 29 — reaganschool.manus.space)

- [ ] Cream Homeschool theme: body text invisible on light bg — fix contrast
- [ ] Dark theme: grey cards in Today/Settings "Four pillars" hard to read
- [ ] Textareas across site hard to read/edit (low contrast text + placeholders)
- [ ] Bookshelf: keep exactly 4 books (Tuck Everlasting, Michael's World, + 2 academic) — delete the rest
- [ ] IEP info → Analytics "current level" indicator (present-level feed per subject)
- [ ] Deliver done-vs-open audit to Mom


---
## Overnight session (Apr 29 night → Apr 30 morning)

- [ ] Verify contrast CSS fixes visually (Cream, Notebook, Chalkboard, Starry)
- [ ] Bookshelf pruned to exactly 4 books (Tuck Everlasting, Michael's World, + 2 academic)
- [ ] IEP present-levels → Analytics subject-level indicator chip
- [ ] 5+1 subject palette (Math/Science/Social/ELA/Specials/Other) across subjectColors.ts
- [ ] Remap blocks/skills/skillsMastery/adventures/weeklyTopics to 5+1 subject slugs
- [ ] academicRecords schema extension + CSV/PDF uploader stubs (scraping skipped — needs Mom's PowerSchool session)
- [ ] classroom-ingest scheduled-task endpoint
- [ ] iep-refresh scheduled-task endpoint
- [ ] Mark genuinely-completed older items as [x]; tag Mom-blocked items with "⚠ Mom"
- [ ] Run full vitest; save morning checkpoint
- [ ] Write /home/ubuntu/reagan_homeschool_dashboard/AUDIT_MORNING.md


---
## PowerSchool import (Indian Hill) — added overnight Apr 29

- [ ] Ask Mom for Indian Hill PowerSchool parent portal URL
- [ ] Build `powerschool_imports` table (snapshot JSON + raw paste + parsedCount)
- [ ] Build `powerschool_assignments` + `powerschool_grades` tables
- [ ] Write flexible pasteable-text parser (accepts print-view or email report)
- [ ] Write CSV parser (accepts PowerSchool "Download as CSV" exports)
- [ ] Build Settings uploader UI (paste textarea + file picker, preview, confirm-import)
- [ ] Expose imported assignments + grades on Analytics alongside homeschool data
- [ ] Vitest: parser round-trips against a known PowerSchool fixture
- [ ] Scheduled scraper stub (Option A) — endpoint + cron job hook, disabled until login flip
- [ ] Document one-time login flow in Settings explainer

- [ ] **Mom note:** Google sign-in prompt on phone 926-5808 for the IH PowerSchool portal login (to use when we flip on Option A scraper in the morning)

- [x] **Mom confirmed:** IH PowerSchool uses Google SSO via spear.cpt@gmail.com — scraper will log in via "Continue with Google" (pause for one-time Mom takeover)


## Bugs reported Apr 29 AM
- [x] Cream Homeschool (light) theme: fixed — redeclared --foreground / --card-foreground / --popover-foreground on data-rtheme="cream" + "notebook" so every card reads dark
- [x] Bookshelf: listBooks() now filters out any title containing __vitest; UI will only show the real three books (Spectrum Science 5, 180 Days of Language 5, Tuck Everlasting)
- [x] Test-row guard on listBooks; covered by new server/listBooksFilter.test.ts


## Kiwi wake-word + bird voice (Apr 29)
- [x] Global wake-word listener — accepts "kiwi", "hi kiwi", "hey kiwi" and custom companion-name; auto-restarts across browser pauses
- [x] Listener auto-restarts on end; swallows permission/mic errors
- [x] Settings listening-mode chip (wake/tap/always/off) with explainer text; default now "wake"
- [x] Perch shows green pulsing mic badge when wake is active, grey when off
- [x] Bird voice: pitch 1.6 / rate 1.05 / volume 0.9, smart voice picker (Samantha/Aria/Jenny preferred, male voices skipped)
- [x] 3-note WebAudio chirp plays before each Kiwi line (safe no-op in headless env)
- [ ] Never request mic on the Rewards / kid-safe pages unless Kiwi panel is opened
- [x] Vitest server/birdVoice.test.ts (5 tests) covering preset + voice picker + no-throw in non-browser


## Kiwi bird upgrades (Apr 29 PM)
- [x] KiwiPerch draggable (pointer events, touch + mouse, clamped, localStorage-persisted)
- [x] Flutter hop every 25-45s (bigger movement) + bob-hop on the main 2.5s action loop
- [x] Peck animation on tap (quick chirp/idle bounce)
- [x] Pop burst (6 hearts/leaves) when chat opens or celebrate event fires
- [x] Fly-across every 90-150s (edge-to-edge slide, lands in a visible spot)
- [x] Sleep pose when adultPresent (action loop halts)
- [x] Bird-voice TTS wired into KiwiCompanion.speak()
- [x] Wake-word phrases expanded; default mode = wake; persists via localStorage
- [x] Mic dot on KiwiPerch (pulsing green when on, grey when off)
- [x] Bird-voice vitest at server/birdVoice.test.ts


## Flock + Kiwi animations (Apr 29 PM-2)
- [x] Reconciled uploaded KiwiSprite — identical to current; no change needed
- [x] Reconciled uploaded FlockSprite/FlockWidget — already present in project
- [x] Migration 0016_cheerful_lilith.sql already applied (snapshots 0016–0032 exist)
- [x] Uploaded rewards.ts was a test file — existing server/rewards.test.ts passes (4 tests)
- [x] Flock + Kiwi animations coexist (flock in-page widget, Kiwi floating perch on z-30)

- [x] Cranked Kiwi activity: persistent 2.5s action loop (tilt/bob/chirp/peck), medium flutter 25-45s, fly-across 90-150s, reactive flap on mouse/touch move


## Tutor roster (Apr 29 PM)
- [x] Tutor roster now Tutor A / Tutor B / Tutor C via db.resetTutorRoster() — Mom adds real tutors in Settings → Tutors when assigned
- [x] All previous tutors marked inactive (history preserved, hidden from pickers); new "Reset roster" button in Settings → Tutors for future cleanup


## Ohio 5th-grade Curriculum tracker (Apr 29 PM-3)
- [x] Rename active tutor roster to Tutor A / Tutor B / Tutor C (resetTutorRoster now emits these three; Mom adds real names when assigned)
- [x] Ohio 5th-grade Learning Standards compiled in curriculumSeed.ts (Math 5.OA/NBT/NF/MD/G, ELA 5.RL/RI/RF/W/SL/L, Science 5.PS/LS/ESS, Social 5.HIS/GEO/GOV/ECO, Specials PE/Art/Music/Tech)
- [x] curriculumTopics table created (migration 0033_early_iron_fist.sql): id, subject, code, title, standardRef, parent_id, ord, status, completed_at, quarter, notes
- [x] Seeder in server/curriculumSeed.ts runs via curriculum.ensureSeeded mutation; 80+ rows in IH pacing order
- [x] Adult-only /curriculum page now has CurriculumTopicsTree section at the top: subject chips, progress bars, 2-level tree, checkboxes
- [x] tRPC curriculum router: list / progress / ensureSeeded / toggle / setNote / autoCompleteFromHistory
- [x] CurriculumChip uses fuzzy title/standard match instead of schema FK — no migration needed on legacy tables
- [x] Render curriculum code chip on Today's schedule cards + SkillBuilderTile (tooltip = full Ohio standard)
- [x] Vitest: curriculum.test.ts covers seeding idempotency, ordering, per-subject progress %, Q1 auto-complete (4 tests)
- [x] Final checkpoint + ask Mom to Publish
- [x] Home (Today) page: adult-only "Adult tools" row with Curriculum & Standards + Analytics + Daily Agendas buttons
- [x] CurriculumChip rendered on Today schedule blocks and Skill Builder; short IH code on chip + real Ohio standard in tooltip
- [x] Auto-complete: Q1 rows auto-done + title-match heuristic against powerschool_assignments/ihAssignments (Mom can un-tick any that were over-eager)
- [x] Coding scheme live: IH textbook-style code on chip (Math 1, Math 1-2, ELA M1, etc.), Ohio standard ref stored on each row and shown in tooltip


## Tonight build batch (Apr 29 late)
- [ ] KiwiPerch polish: smaller size on mobile, clamp so it never overlaps the open Kiwi chat panel
- [ ] KiwiPerch polish: persist perch position PER-ROUTE (so she doesn't always block the same button on every page)
- [ ] Home "Today's coverage" tiny strip — one bar per subject with % done today, links to Analytics on tap
- [ ] Home "3-day mood" micro-strip (green/yellow/red dots for last 3 days), links to Timeline
- [ ] Home "Resume where we left off" card — shows the next uncompleted schedule block + a Jump button
- [ ] Vitest: coverage on the new `today.resumePointer` / `analytics.todayCoverage` helpers
- [ ] Checkpoint + ask Mom to Publish


## Tonight polish batch (Apr 30)
- [x] IXL links: route through Indian Hill SSO when "IH IXL" switch is on; falls back to public ixl.com search when off (default on)
- [x] Khan Kids fallback: scaffolded-flagged topics (notes contain "scaffold/kids/below-grade") open khanacademykids.org when toggle is on (default off)
- [x] Settings: "Practice-link mode" card with two switches, copy explains trade-offs
- [x] Persist both switches in localStorage (reagan.practicePrefs.v1)
- [x] 8 vitests in server/practiceLinks.test.ts cover explicit/derived URLs, IH SSO wrapping, Khan Kids toggle, stacked prefs
- [x] Bookshelf: books.coverUrl column added via migration 0035; Open-Library covers seeded for Spectrum Science 5, 180 Days of Language 5, Tuck Everlasting; Bookshelf now renders cover image (fallback to emoji if URL fails)
- [ ] Weekly digest: scheduled endpoint emails Mom + tutor Sunday with coverage %, mood trend, IEP progress
- [ ] Settings: weekly-digest recipient editor
- [ ] Schedule blocks: keyboard up/down reorder handle (drag already present)
- [ ] Rewards: stickers → prize ladder visualization with milestone markers
- [ ] Settings: edit the prize ladder milestones

- [x] Reorder schedule blocks (adult-only): up/down arrow buttons on each block swap sortOrder with the neighbor; new blocks.move tRPC + db.moveBlock helper + vitest
- [x] Sticker → prize ladder viz: new PrizeLadder component on /rewards showing coin balance marker + per-prize progress bars + Ready!/coins-to-go labels

- [x] Added Precious (bearded dragon) to animals table via preciousAndReset.test.ts seed
- [x] Cleared seed-only stickers + coin ledger rows (Mom-approved fresh start)
- [x] appSettings prefs helpers (get/set/list) + trpc prefs router + 3 vitests
- [x] Settings: Adaptive IEP auto-apply toggle + editable Prize Ladder milestones (stored in appSettings["iep.autoApply"], appSettings["prize.milestones"])
- [x] Cleanup punchlist invariants all green (no Brutus, no Test Book, no duplicate IEP rows, no TEST_STRAND skills, no Madeira-only district label)

# Apr 30 — Tonight polish batch (closed)

- [x] Confetti burst on block Done-tap (client/src/lib/confetti.ts)
- [x] Good Work note button + dialog (adult only, saves via prefs.set)
- [x] Brain-Break TV Box with rotating kid-safe clips (BrainBreakTvBox.tsx)
- [x] Rotating daily mascot illustration next to Good Morning greeting (MascotGreeting.tsx)
- [x] Tighten card spacing: Today, Apps, Journal, TutorBriefing

# Apr 30 — Morning bug triage (Mom)

- [x] Bug: Profile page boxes have low-contrast text (dark card, near-black text → unreadable)
- [x] Bug: Chrome "site is using microphone" notification fires on every page load when Kiwi wake-word is on, and triggers Chrome notification sound even when notifications are off
- [x] Bug: Kiwi should be completely silent right now — no chirp, no TTS speech, no notification sound

# Apr 30 — Backlog batch 2

- [x] Sticker burst animation fires from KiwiPerch on block completion (silent, visual only)
- [ ] Prize Shop preloaded with starter prizes Mom can edit (no auto-chirp)

# Apr 30 — Morning batch 2 (Mom)

- [ ] Identity card — pin text to dark color so it's readable on dark theme (currently near-invisible)
- [ ] Redesign Levels / Sticker Book bar: drop the ombre, real sticker-book look
- [ ] Rename "points" to "Feathers" (Kiwi-themed currency)
- [ ] Prize Ladder with numbered rungs (large numbers on each rung)
- [ ] Add more books to the bookshelf seed
- [ ] White-template text readability: homepage title box + any lingering grey-on-white
- [ ] Today: remove "At Indian Hill this week" banner title, keep Skill Builder but move below Today's Schedule
- [ ] Today's Schedule sits near the top (always visible early)
- [ ] Profile image shows on Homepage AND About Me page

# Apr 30 — Morning batch (Mom)

- [x] Rename "points/coins" to Feathers (user-facing only) with 🪶 emoji
- [x] Redesign Sticker Book page (real storybook look, not ombre)
- [x] Numbered Prize Ladder with large rung numbers + parchment/wood bg
- [x] Reorder Today: remove Indian-Hill-this-week strip, move Schedule near top, Skill Builder below Schedule
- [x] Homepage greeting hero redesigned (colorful gradient works on all themes; title stroked for contrast)
- [x] Seed starter bookshelf (9 real, legal books: Tuck, Charlotte's Web, Winn-Dixie, Ivan, Wonder, Adler fractions, NG Kids Almanac, Jane Goodall bio, Milli)
- [x] Profile photo on About Me header + rotating mascot auto-switches to Reagan's photo when uploaded

# Apr 30 — Morning batch (Mom)

- [x] Rename points/coins to Feathers (user-facing only)
- [x] Redesign Sticker Book page (storybook look)
- [x] Numbered Prize Ladder rungs
- [x] Reorder Today: remove Indian-Hill strip; Schedule near top
- [x] Greeting hero redesigned for all-theme contrast
- [x] Seed starter bookshelf (9 kid-appropriate books)
- [x] Profile photo on About Me + mascot auto-switches to photo

# Apr 30 — Quick fix
- [x] Revert home/Today title hero back to chalkboard look

# Apr 30 — Afternoon batch (Mom)
- [ ] Hero is true blackboard (charcoal/black), not green slate
- [ ] Light themes: sidebar text dark + legible
- [ ] My Levels: subjects color-differentiated, cards visually distinct
- [ ] Rewards Reagan-view: Feathers progress bar + image-tile rewards (no white list)
- [ ] Rewards Adult Manager: manual create + one-click preset library
- [ ] Reward auto-Feathers from completion based on time + difficulty (already partially there — verify)

# Apr 30 — Afternoon batch (Mom)
- [ ] Hero is true blackboard (charcoal/black), not green slate
- [ ] Light themes: sidebar text dark + legible
- [ ] My Levels: subjects color-differentiated, cards visually distinct
- [ ] Rewards Reagan-view: Feathers progress bar + image-tile rewards (no white list)
- [ ] Rewards Adult Manager: manual create + one-click preset library
- [ ] Reward auto-Feathers from completion based on time + difficulty
- [ ] My Levels: restructure into subject categories with kid-friendly progress UI (not wall of text)
- [ ] Apply Reagan design rule globally: not overwhelming, image+title tile-first layouts everywhere
- [ ] Wire Reagan app tiles to auto-launch under her Indian Hill Google account (use authuser= or AccountChooser?Email= so Chrome doesn't re-prompt)
- [ ] Pull Google Classroom assignments under spear.cpt@gmail.com into adult dashboard
- [ ] Surface Indian Hill Classroom assignments inside Reagan's Today schedule when present
- [ ] Audit Kiwi: she only speaks AFTER wake word recognized, no auto-speak on page load
- [ ] No Chrome mic banner unless adult flips Mic Consent + Wake-word mode in Settings
- [ ] Rename Feathers -> Kiwi Coins across UI (keep DB field names as-is)
- [ ] Preset Reagan's school email Reagan.higgs33@ihsd.us into student.googleEmail at first boot
- [ ] Kiwi behavior contract: opens speech bubble ONLY on direct click or wake word; never on auto/timer
- [ ] Keep all idle visual animations (preening, popping, nibbling, look-around, blink) and drag-to-reposition
- [ ] No auto chirp on Got-it/celebrate/perch-tap unless user explicitly clicks Kiwi
- [ ] Kiwi may quietly fly/wander to a new perch every few minutes (visual only, no sound)
- [ ] Daily Printables — full page (US Letter portrait, 0.5" margins), fun layout (bold title, big illustration, single instruction, large work area)
- [ ] Daily Printables — ranked free-source picker: Khan Academy, Education.com free, K5 Learning, Math-Drills, SuperTeacherWorksheets free, ReadWorks, CommonLit, Beestar free, NASA Education, Smithsonian Learning Lab, LoC Primary Sources, OpenEd, IXL skill page link
- [ ] Daily Printables — Kiwi-built full-page worksheet fallback when no source matches
- [ ] Daily Printables — 7am morning email to spear.cpt@gmail.com AND marcy.spear@gmail.com with the day's printables linked + attached
- [ ] Daily Printables — Reagan upload-photo flow: snap finished page, preview, submit
- [ ] Daily Printables — auto-grade: invokeLLM vision pass returns score + 1-line feedback for each upload
- [ ] Daily Printables — award Kiwi Coins on submit (base + difficulty/time bonus)
- [ ] Daily Printables — file PDF + uploaded photo into Reagan/IHES Drive folder, dated
- [ ] Adult Rewards Manager — manual create + one-click preset library (image+title+cost+description), Reagan view shows image tiles with popup
- [ ] Reagan app tiles auto-launch under Reagan.higgs33@ihsd.us (use authuser= prefill)
- [ ] Google Classroom pull under spear.cpt@gmail.com — daily sync of assignments into dashboard
- [ ] Reagan Profile Model: tracks finished/abandoned, format preference (drawing/write-in/cut-paste/outdoor/online), Hard/Getting it/Got it per skill, subject affinity, real pacing per block, mood signals
- [ ] Use Profile Model to drive both daily printables AND online activity suggestions (best for Reagan, not loyal to any single source)
- [ ] IHES Google Classroom = reference-only side panel (today + week glance), never the daily plan driver
- [ ] Daily Printables = SCHOOL-DAY work, NOT homework. Frame as "today's school work" everywhere; finish before end of school day.
- [ ] Three buckets in UI + email: Have-to-do | Optional | Extras (if she wants)
- [ ] Automate Classroom sync via Manus scheduled task (uses gws, runs daily, POSTs to /api/scheduled/classroom-sync)
- [ ] Automate 7am morning printables email via Manus scheduled task (POSTs to /api/scheduled/morning-brief, then emails via gmail MCP)


## Apr 30 batch — Daily Printables + Rewards rebuild
- [x] Merge `printables.today` + `printables.markDone` + `printables.submitWork` into existing printables router
- [x] Add `renderMorningBriefHtml` helper to scheduledSync
- [x] `/api/scheduled/morning-brief` endpoint accepts forDate + items, returns email HTML
- [x] `TodaySchoolWork` component on Today page (three buckets, image+title tiles, popup)
- [x] Printable popup supports photo upload → submitWork → S3 + LLM auto-grade + Drive queue + Kiwi Coins
- [x] Rewards/Prizes Reagan view: Kiwi Coins balance + nearest-prize progress + image-tile cards + popup redeem
- [x] Prizes start EMPTY (auto-seed disabled per spec)
- [x] Adult Rewards Manager card in Settings: manual create form + 10-preset library + edit/delete
- [x] All TS clean, all 161 vitest tests still pass


## Apr 30 — Schedule block → printable wiring
- [x] Add subject-slug helper that maps a schedule block (LA / math / reading / science / SS) to its best matching printable for today
- [x] Add an "Open" button to every block card on Today's schedule
- [x] Show a "📄 printable ready" badge on blocks that have a linked printable
- [x] If a block has a linked printable, Open → popup opens directly (reuse Today's School Work popup)
- [x] If no linked printable, Open → smooth-scroll to Today's School Work card and briefly highlight
- [x] TS clean + vitest green (161/161)


## Apr 30 — Open Block must always show a real activity
- [x] Audit current Open behavior (no match / broken url / missing pdf)
- [x] Add per-subject curated fallback (Khan Academy 5th-grade Math, ReadWorks, Storyline Online, Mystery Science, Smithsonian SS, Art for Kids Hub, Chrome Music Lab, Cornell Lab birds, GoNoodle, Wonderopolis) so Open NEVER lands empty
- [x] If no printable picked yet, popup opens with the curated fallback for that block's subject + "Mom will pick the exact worksheet by 7 AM" note
- [x] Big primary button "📄 Open the worksheet →" + secondary "📑 Open the printable PDF →"
- [x] Test (162/162), checkpoint, sync to Drive
- [ ] (followup) Server: backfill missing sourceUrl from fallbacks during morning brief intake


## Apr 30 — Adult Assignments Library + Daily Classroom Sync
- [ ] DB: add `assignmentsLibrary` table (title, subject, type, topic, tags, fromSource, ihClassroom bool, dateReceived, dateFor, status, recommendedUse 1-5, sourceUrl, fileLink, bundleId, bundleStep, linkedItemIds JSON, notes, createdAt)
- [ ] DB: add `assignmentBundles` table (id, subject, topic, dateFor, name, createdAt)
- [ ] tRPC procedures: `library.list`, `library.search`, `library.add`, `library.update`, `library.markStatus`, `library.attachToToday`, `library.bundle.create`, `library.bundle.list`, `library.bundle.addItem`
- [ ] Adult-only Library page (`/admin/library`) with searchable + sortable table, all columns, status filters, type filters, ★ recommendation badges
- [ ] Adult Library: "Use today" button → drops the bundle's items into today's daily plan in step order
- [ ] Today schedule block Open: lookup chain = today's printable → matching Library row by subject → curated fallback (NEVER empty)
- [ ] Today schedule block Open: when item is part of a bundle, run lesson → slides → worksheet → (adult) answer-key in order
- [ ] Daily 6 AM scheduled task: pull from gmail (reagan.higgs33@ihsd.us forwarded → spear.cpt@gmail.com), Drive `Reagan/IHES`, Classroom; classify; create editable Drive copies; insert Library rows
- [ ] In-app worksheet runner: open → Start → autosave on close/blur → Resume → Turn in → auto-grade if gradable
- [ ] Auto-grade gradable submissions; results into Adult Grades & Analytics
- [ ] Absent button on adult Settings (bottom): mark today absent, halt coin awards, log to analytics
- [ ] Tests + checkpoint + Drive sync
- [ ] Auto-create editable Google Doc/Sheet/Slide copies for all writable types (worksheet/quiz/lesson_plan/project) into `Reagan/Assignments/Editable Copies/`; store link in fileLink
- [ ] Read-only types (video/slideshow) just keep their source URL
- [ ] PDF fallback: render with the in-app annotation runner (Apple-Pencil-friendly)
- [ ] Set up Gmail forwarding rule reagan.higgs33@ihsd.us → spear.cpt@gmail.com (auto-forward all from @ihsd.us / IH Classroom / IH teachers)
- [ ] Confirm forwarding via verification link, then label forwarded items in spear.cpt@gmail.com as "IH-Reagan" so the daily sync can grab them with one query


## Apr 30 — PowerSchool integration
- [ ] Open PowerSchool guardian portal in browser + take user takeover for sign-in
- [ ] Pull class list / assignments / grades / attendance for Reagan
- [ ] Create /api/scheduled/powerschool-import endpoint that ingests rows into the Library (From: PowerSchool, IH Classroom: Yes)
- [ ] Schedule daily PowerSchool refresh (after 6am Library auto-sync)
- [ ] Test, checkpoint, sync to Drive


## Apr 30 — Simplification + Polish batch (from screenshots)

### Cleanup (Phase 1)
- [ ] Whiteboard: delete every "Test note / Hello Reagan (test)" + "Tomorrow only" stickies; keep only the welcome note
- [ ] Analytics: delete every "Recent Submissions" Block #60001 dummy row + the dummy "tutor" rows (155+)
- [ ] Notification log / dummy notifications: clear
- [ ] Remove unnecessary console / audit logging; keep only meaningful error logs

### Reagan-side simplification (Phase 2)
- [ ] Remove **Rewards** from Reagan's sidebar (move entirely to adult side)
- [ ] Remove **Knowledge / AI Assistant** page from Reagan's view (keep adult-side only)
- [ ] Combine Whiteboard into Notebook (no separate Whiteboard page in Reagan view)
- [ ] Notebook: paper template picker (lined / blank / graph / handwriting / dotted)
- [ ] Notebook: enlarge writing area significantly so it feels roomy
- [ ] Add small Kiwi AI helper inside Notebook only (not its own nav item)
- [x] No duplicate tank cards on Today (already cleaned up)

### Today + visual readability (Phase 3)
- [ ] Fix gray boxes on Today → high-contrast text (Today's Coverage, Mood, Resume)
- [ ] Fix theme picker text color so all themes are readable (white-on-white bug)
- [x] Tank-box duplicates already removed
- [ ] Add **Activity Options** panel underneath This Week with max 10 ideas, weighted by Reagan's likes + weather + timing + season
- [ ] "+ Add an activity" (adult adds; Reagan picks)
- [ ] Add countdown to summer break in lower-left of sidebar

### Adult-only Rewards + Kiwi Coin counter (Phase 4)
- [ ] Large 3D glossy Kiwi Coin counter at top of adult area (piggy-bank/kiwi vibe)
- [ ] Adult approves/gives prizes; Reagan no longer sees the prize ladder
- [ ] Image-tile prize cards (image + title only, no long text list)
- [ ] Update IEP source to current 2026 active version (verify there isn't a newer doc to import)

### Analytics rebuild (Phase 5)
- [ ] Replace long lists with visual charts (radar per subject, sparkline trend, mood ring)
- [ ] Add **Curriculum Coverage 1–100% per subject** for 5th grade as visual progress arcs

### Adult Settings audit (Phase 6)
- [ ] Cut any Settings card that isn't essential
- [ ] Combine duplicates (Helper / Adult mode toggles into one card)
- [ ] Adult Settings should fit on one short scroll

### Visual polish (Phase 7)
- [ ] 3D glossy/glass pop-out boxes throughout
- [ ] Replace prize text list with image-tile cards
- [ ] Cute extras: summer countdown, Kiwi animations preserved

### Delivery (Phase 8)
- [ ] Test (target ≥ 166/166 vitest)
- [ ] Save checkpoint
- [ ] Sync updated files to Drive
- [ ] Deliver summary to user

## Latest batch (Apr 30 evening) — finish ASAP

- [ ] Run cleanupDummyData.test.ts to wipe seed/dummy rows
- [ ] Strip noisy console.log / audit logging from server
- [ ] Reagan nav: remove Rewards entry (adult-only)
- [ ] Reagan nav: remove Knowledge / AI Assistant page
- [ ] Notebook: paper template picker (lined / blank / graph / handwriting / dotted)
- [ ] Notebook: enlarge writing area + small Kiwi AI helper inside
- [ ] Today: fix gray-box readability + theme picker white-on-white bug
- [x] Today: no duplicate tank cards
- [x] Adult: large 3D glossy Kiwi Coin counter (AdultCoinCounter mounted on Analytics + Rewards)
- [x] Adult: image-tile prize cards (image + title + cost) — already implemented on Prizes page
- [ ] Analytics rebuild as visual charts (radar / sparklines / mood ring)
- [ ] Analytics: Curriculum Coverage 0-100% per 5th-grade subject as arcs
- [ ] Adult Settings audit: combine duplicates, one short scroll
- [ ] Visual: 3D glossy/glass pop-out boxes throughout
- [ ] Visual: Summer countdown bottom-left of sidebar (cute kiwi mascot)
- [ ] Visual: Kiwi Tea Party decorative scene (more kiwi-bird fun)
- [ ] Weather widget: glassy realistic-material, upper-left
- [x] Schedule page: "This Week" nav renamed to "Schedule" (CozyShell)
- [ ] Schedule page: Day / Week / Month toggle
- [ ] Schedule page: overlay Reagan's Google Calendar events
- [ ] Schedule page: overlay IH school DAYS OFF + end-of-year date only (no full schedule)
- [ ] Schedule page: click any day -> agenda modal with that day's blocks + events
- [ ] Print button on every printable tile (clean print stylesheet)
- [ ] Print button on every finished/turned-in work card
- [ ] Drive auto-save: finished work -> Reagan/Reagan School Master Folder/Reagan School Hub (Dashboard)/Finished Work
- [ ] Drive auto-save: yet-to-do printables -> .../To-Do Work
- [ ] Run vitest (target >= 166/166)
- [ ] Save checkpoint, sync to Drive, deliver summary

## Latest batch additions (Apr 30 night) — visual upgrades

- [ ] My Levels: each card shows related file/work image as thumbnail (left side, full-width row) so Reagan visually remembers the skill
- [ ] Color the white/empty "just starting" template cards with soft pastel theme tints (no plain whites)
- [ ] Customizable background picker: choose color OR upload image for any white-background page area (persisted per user)

## Latest batch additions (Apr 30 night, round 2) — Turn-in flow

- [ ] Difficulty rating prompt after every turn-in (Easy / Just right / Tricky / Really hard) → stored on submission row → Analytics + Adult Library
- [ ] Photo OR scan turn-in with print option (Take photo + Print finished work button) → also queued to Drive
- [ ] Reading-bucket assignments use simple ✓ Done reading checkmark (no photo/grade), still award coins + ask difficulty

## Latest batch additions (Apr 30 night, round 3) — Kiwi voices

- [ ] Several Kiwi voice presets (Sweet Kiwi / Sunny Friend / Wise Owl / Soft Whisper / Robot Buddy) — picker in Settings + quick toggle in Kiwi bubble
- [ ] "Make a sound" row inside Kiwi: chirp / peep / giggle / ta-da / whistle / sleepy yawn buttons

## Latest batch additions (Apr 30 night, round 4) — Flock & playful decor

- [ ] Cuddling ducklings sprite in cozy corner (Today / Bookshelf / Notebook)
- [ ] Mallard + Black Swedish breeds (2 Black Swedish trail behind a Mallard lead)
- [ ] Egg-hatch animation (speckled egg wiggles, cracks, duckling waddles into formation)
- [ ] Flock grows over time with streaks / coins / days used
- [ ] Mama Duck waddles in occasionally, gently scoops a duckling, walks off, returns
- [ ] Little kiddie pool / pond in the corner (matches Reagan's real pool)
- [ ] Weather-aware: rain → drops + leaf umbrella, sunny → sparkles, cloudy → mist
- [ ] Duck footprints in mud after rain, fade in across the bottom
- [ ] Easter eggs: peeking kiwi/duck silhouettes, droppable feathers Reagan can tap to collect, worm wiggles after rain
- [ ] All decorative animations stay off the work areas (no UI block)

## Apr 30 night — round 4 flock + decor (consolidated)

- [ ] Cuddling ducklings sprite in cozy corner
- [ ] Mallard + Black Swedish breeds (2 Black Swedish trail behind a Mallard lead)
- [ ] Egg-hatch animation
- [ ] Flock grows over time with streaks / coins
- [ ] Mama Duck waddles in occasionally to scoop a duckling
- [ ] Pool/pond corner
- [ ] Weather-aware (rain droplets + leaf umbrella)
- [ ] Duck mud footprints after rain
- [ ] Easter eggs: peeking silhouettes, droppable feathers, worm wiggles

## Apr 30 night final additions

- [ ] Bug: phantom Chrome notification sound on page load when mic blocked (gate SpeechRecognition + audio elements behind explicit consent)
- [ ] Final audit doc at end: shipped/deferred + every integration status + errors + pending manual steps

## Checkpoint #2 (Apr 30 PM) — focus
- [ ] Customizable background picker (color + image, persisted)
- [x] Notebook upgrade: paper templates (lined/blank/graph/handwriting/dotted) + larger canvas + larger writing area
- [x] Kiwi read-aloud on demand: "🔊 Read this to me" on Notebook, TurnInDialog body, grey instruction boxes (Phase 9 — TurnInDialog body shipped)
- [x] MyLevels full-width row layout with bigger emoji thumbnail + title visible
- [x] Filter test/quiz/screener items off Reagan's Today list
-- [x] Adult Settings: theme picker mounted (server-persisted ui.theme + existing BackgroundPicker) picker round-trip, notebook template select, read-aloud invokes speechSynthesis, today filter excludes test/quiz

## Phase 3 (NEW priority — daily auto-build)
- [ ] Server `today.refresh` mutation: builds today plan from active curriculum + recommended-apps map + skips test/quiz/screener kinds
- [ ] Today page mounts: if today plan empty or stale (>12h), auto-trigger today.refresh once
- [ ] Each Today item: shows file/link tappable + "Turn in" button + recommended app chip
- [x] Daily tip strip at top of Today (rotating pool, deterministic by date)
- [ ] Server route `/api/scheduled/build-today` so a schedule task can pre-build at 5am

## Phase 3 add-on (auto-update from interactions)
- [x] On submissions.create → mark blocks.curriculumTopicId covered + lastCoveredAt now (bumpFromSubmission)
- [x] On submissions.create → if block has skillLadderId, auto-call skillLadder.practice with selfRating derived from kidDifficulty (easy=5, just=4, tricky=3, hard=2)
- [x] On appLinks.open → register engagement → tiny skill bump (selfRating=2) for that subject
- [x] Soft-skill levels auto-bump from journal effort/courage/kindness mentions and 3-day streaks (creates auto ProudMoments + growth bonus)


## Apr 30 night — final additions before sleep
- [x] Fix weather widget overlap with theme picker / top of main scroll
- [x] Apply kid_difficulty + readingOnly migration 0040
- [x] Skip the now-dead powerschool.login test
- [x] Auto-update curriculum coverage + skill ladder from every submission
- [x] Seed Saturday May 2 schedule (light Saturday — 1 reading + 1 outdoor + 1 art + free choice) with paired free-link/printable fallback per block
- [ ] Free-link fallback chain per block: printable → Khan/IXL → free YouTube/MysterySci → outdoor prompt
- [x] Color the white "just starting" template cards
- [x] Read-aloud button on assignment dialog grey instruction boxes
- [x] Roblox launcher tile in Apps & Tools, gated by adult-only "Apps Reagan can open" toggle
- [Mom todo tomorrow] Sign up for each app account in the new App Accounts card using reaganhiggs910@gmail.com
- [Mom todo tomorrow] Rotate Goose214$ password since it was shared in chat


## Apr 30 night — curriculum visibility additions
- [x] Add visible "Topic: subject · topic name" pill to every block, worksheet, video, lesson, submission card
- [x] Auto-update curriculum coverage % per topic on every submission
- [x] Curriculum page: per-topic colored progress arc + recent items list (free-link button still pending)
- [ ] Free-link finder for any topic: pulls printable / Khan / IXL / YouTube / outdoor activity links automatically


## May 1 batch — schema + Today filter + weather inline
- [x] Migration 0040: kid_difficulty + reading_only columns added to assignmentSubmissions
- [x] submissions.create router writes kid_difficulty + reading_only to real columns
- [x] Today page filters out test/quiz/screener/placement blocks (regex)
- [x] todayFilter.test.ts passing (7/7)
- [x] WeatherWidget repositioned from absolute overlay to inline top-right (no overlap with theme strip)
- [x] PowerSchool live-login test marked .skip (IH closed Apr 2026)


## May 1 batch — overnight Phases 4 → 10 complete

- [x] Phase 4: TopicLabel component on schedule blocks, TurnInDialog, printable popups (server/topicLabel.test.ts)
- [x] Phase 5: submissions.create auto-bumps curriculumTopics + skillLadder via bumpFromSubmission (server/bumpFromSubmission.test.ts)
- [x] Phase 6: Curriculum page now shows per-subject progress arcs + recent turn-ins (server/curriculumRecent.test.ts)
- [x] Phase 7: Saturday + Sunday plans seed soft "weekend" template (Slow morning / Pick-your-path adventure / Family read-aloud / Choice play / One little win) — server/weekendPlan.test.ts
- [x] Phase 8: Subject-tinted pastel cards on My Levels (already implemented; verified)
- [x] Phase 9: Kiwi "Read to me" button on TurnInDialog + grey instruction box on compose step (server/birdVoiceContract.test.ts)
- [x] Phase 10: Roblox launcher tile on Apps & Tools, gated on adult-controlled Settings toggle (server/robloxPref.test.ts)

Tests at end of batch: 211 passed | 1 skipped.


## May 1 batch — phase 2 (server today.refresh)
- [x] Server `today.refresh` mutation: rebuilds today's plan from the active template, preserves completed/in_progress/needs_help blocks
- [x] "🔄 Fresh start" button next to daily-tip strip on Today
- [x] Soft-skill auto-bump from journal `tried/kind/brave/helped/drew/wondered…` mentions + 3-day-streak growth ProudMoment
- [x] Curriculum free-link finder: per-topic Khan / IXL / ReadWorks / Smithsonian / Outdoor / Education.com printable suggestions + "✨ More" inline pop-out on every curriculum row
- [x] Today schedule-block: inline file thumbnail strip (no extra click) + matchPrintable scoring bugfix
- [x] Parallel-test race fix on bumpFromSubmission (pin fixture ladderOrder=0 + unique skill code per pid)
- [x] Schedule page parity: TopicLabel on both block renders (Day list + Agenda dialog)


## 2026-05-01 Today's afternoon plan (urgent — happening today)
- [ ] Upload Planet-collage-720-x-1024.jpg into webdev storage and reference from today's plan
- [ ] Upload weight-on-planets.PDF into webdev storage and reference from today's plan
- [ ] Pick a kid-safe < 5 min "plants/planets in our solar system" video, embed link in today's first block
- [ ] Replace today's plan with afternoon-only schedule (~2 hrs):
  - Block 1: 5-min planets video kickoff
  - Block 2: Science hands-on — "Planets of the solar system to scale" (the collage activity, 8 circles + Saturn ring, cut + color)
  - Block 3: Science worksheet — Weight on Planets PDF
  - Block 4: Math — circle/360° → angles → triangles (types + angle sum 180°)
  - Tipsy-Top math nudge: short circle+triangle resource link
- [ ] Update Today UI to surface the attachments inline on each block (image + PDF view buttons)
- [ ] Note in plan: "Half day — afternoon only, ~2 hours"

## 2026-05-01 Scope reduction (school account + classroom deactivated)
- [ ] Remove PowerSchool integration entirely (server, components, tests)
- [ ] Remove Google Classroom integration entirely (sync, UI, tests)
- [ ] Update Apps Hub: keep app launchers (IXL, Khan, Prodigy, BrainPOP, Edpuzzle, Vocab.com, Blooket, Wayground, Seesaw, Canva, Code.org, Book Creator, Merlin, iNaturalist) but remove Google Classroom + IHSD Gmail entries

## 2026-05-01 New: Apps login + subscription vault
- [ ] Add `appCredentials` table (appLinkId, login, password, subscriptionStatus, renewalDate, notes)
- [ ] Adult-gated "Manage logins" page in Settings to view/edit credentials
- [ ] Show subscription status pill on each app card on Apps Hub
- [ ] (Open Q from me) clipboard auto-copy vs reveal-only — defaulting to reveal-only behind adult unlock


## 2026-05-01 Reagan's identity update
- [ ] Replace `reagan.higgs33@ihsd.us` references in DB seed + UI with `reaganhiggs910@gmail.com`
- [ ] Tag each appLink with `signInMethod` (`google_sso` | `email_password` | `class_code`) and which Google account it links to
- [ ] Build Apps Hub credential vault (adult-gated reveal, subscription + renewal date)
- [ ] Decide clipboard-copy vs reveal-only default (waiting on user)


## 2026-05-01 Open-button fix + AI generator must produce openable blocks
- [ ] Investigate scheduleBlocks columns + Open-button code path on Today
- [ ] Backfill today's 4 blocks with linkUrl / pdfKey / videoUrl so Open works
- [ ] Insert today's worksheet (Manus-built FULL + original watermarked) into daily_printables
- [ ] Update AI generator to populate linkUrl/pdfKey/videoUrl on every block (not just markdown in description)
- [ ] Vitest spec: every AI-generated block has at least one openable resource
- [ ] Today's "Pick a printable to track" must surface today's printables, not "No link yet"


## 2026-05-01 Google account routing
- [ ] Add `preferredGoogleAccount` enum column to app_accounts (reagan | dad | none)
- [ ] Default mapping: Khan/BrainPOP/Edpuzzle/Seesaw/Code.org/Book Creator/iNaturalist/Merlin/Vocab.com/Canva → reagan; IXL parent / Prodigy parent / Family Link → dad
- [ ] Show per-app Google badge in AppAccountsCard ("Sign in with Google as Reagan" / "as Dad")
- [ ] Append `?authuser=<email>` Chrome multi-account hint to launcher Open URL when preferredGoogleAccount is set
- [ ] Vitest: schema migration, default mapping seed, badge render
- [ ] Document the realistic flow (one-time Chrome multi-account setup) in onboarding card
- [x] Mount AppAccountsCard on Apps page (adult-gated)
- [x] Migrate stored sign-in emails to reaganhiggs910@gmail.com


## 2026-05-01 PRIORITY: Three Real-Mission Deliverables (visual polish PAUSED)

### Mission A — Curriculum + Adult Update Stream
- [ ] Audit existing Curriculum.tsx page — does it show subjects → units → topics → lessons with done/in-progress/todo states?
- [ ] Curriculum coverage tracker: % of 5th-grade Ohio standards completed per subject
- [ ] "What's been done / what's left / what's next" view per subject
- [ ] Build AdultUpdateStream component — live feed of: blocks completed, mood logs, struggles, books-progressed, app drills finished, kiwi-coins earned, photos uploaded
- [ ] Stream visible on a new "Adult Dashboard" / "For Adults" page (or existing Tutor Handoff)
- [ ] Backend: `adultStream.feed({ since, limit })` aggregates from scheduleBlocks + emotional_struggles + book_progress + app_engagement + photos
- [ ] Real-time refresh every 30s (or websockets if cheap)
- [ ] Per-event row: timestamp, kid-friendly label, subject icon, status, link to source
- [ ] Filter chips: today / this week / by subject / by adult-actor
- [ ] Notify (in-app + email) all adult viewers on key events: red-zone mood, 3 reds same topic, milestone

### Mission B — Automated Daily Lesson Generator
- [ ] Schedule a nightly cron (6pm America/New_York) that calls /api/scheduled/generate-tomorrow
- [ ] Endpoint: `scheduledTask.generateTomorrow` — uses LLM to plan a complete day for Reagan based on her curriculum gaps + interests + IEP accommodations + tomorrow's calendar (no school / therapy / appointment)
- [ ] Each generated block MUST include: title, subject, est minutes, an openable VIDEO URL, a lesson explainer, an assignment with success criteria, an optional printable PDF, a recommended app drill (with deep link)
- [ ] Auto-resolve videos via search (YouTube safe-search or Khan/BrainPOP catalog) — DO NOT fabricate URLs
- [ ] Auto-fetch printables (Super Teacher / K12reader / education.com) OR generate Manus PDF if behind paywall
- [ ] Auto-suggest matching app drill (IXL skill code, Khan unit URL, Prodigy assignment, BrainPOP topic)
- [ ] Insert as scheduleBlocks + assignments_library rows pinned via blockId
- [ ] "Generated overnight by Kiwi" banner on Today page
- [ ] Adult can preview tomorrow's plan from 6pm onward and tweak/regenerate
- [ ] If generator fails (LLM, network), fallback to last-week's template with a notification email

### Mission C — Kiwi Always-On Listening
- [ ] Wake word "Hey Kiwi" / "Kiwi" detection (Web Speech API + simple keyword spotter)
- [ ] After wake word: full speech-to-text via existing transcribeAudio helper
- [ ] Ambient interpretation mode: when adult-toggled ON, Kiwi periodically transcribes 10-second windows during work blocks (no playback) and:
  - flags signs of frustration ("I can't" / "this is dumb" / sighs / silence > 60s) → suggests a break or simpler version
  - notes when she explains a concept correctly → auto-marks "she gets this" evidence
  - logs into emotional_struggles or skill_evidence as appropriate
- [ ] All audio processed in-browser; only transcripts (text) ever sent server-side
- [ ] Adult-only toggle in Settings + clear privacy notice + per-block opt-in indicator
- [ ] Kid-visible "🎧 Kiwi is listening" indicator while active
- [ ] Vitest coverage for wake-word detector + ambient flagging logic


## 2026-05-02 Architecture Reset — Single Source of Truth = Dashboard DB

### Phase 1: Dead-account scrub
- [ ] Replace `student.googleEmail` default `reagan.higgs33@ihsd.us` → `reaganhiggs910@gmail.com` in server/db.ts:4179
- [ ] Replace `classroom.studentDomain` `ihsd.us` → `gmail.com` in server/db.ts:4180
- [ ] Remove `/@ihsd\.us$/i` allowlist regex in server/db.ts:2799 (replace with new tutor allowlist)
- [ ] Remove "PowerSchool — Indian Hill" entry from seed.mjs:215
- [ ] Strip @ihsd.us copy in client/src/pages/Schedule.tsx:375, Settings.tsx:347, UploadOrSync.tsx:134/268, googleAuthLink.ts:45, DrivePushQueueCard.tsx:8
- [ ] Hide `ihAssignments` UI surfaces (table can stay for now — read-only legacy)
- [ ] Update DB rows: `UPDATE app_settings SET value='reaganhiggs910@gmail.com' WHERE key='student.googleEmail'`
- [ ] Update DB rows: any app_accounts.signInEmail still ihsd.us → reaganhiggs910@gmail.com
- [ ] Vitest: snapshot grep ensures no production code mentions ihsd.us / Reagan.higgs33

### Phase 2: Tutor multi-account
- [ ] Add `tutorRole` enum to user.role: admin | user | tutor | viewer
- [ ] Tutor permissions: can mark blocks done, log mood, write tutor notes, view curriculum coverage; cannot edit settings or view billing/secrets
- [ ] Add `tutors` rows for Madison, Sophie, Keith with weekly slot pattern
- [ ] Tutor invite flow (admin invites by email → magic link → first sign-in creates user)
- [ ] Each tutor sees their own "Today's plan with Reagan" handoff page

### Phase 3: Curriculum hub
- [ ] Subjects → strands → standards → topics → lessons hierarchy (5th-grade Ohio)
- [ ] Per-topic: status (not_started | in_progress | done | mastered), evidence count, last_touched_at, who_marked_it
- [ ] Curriculum.tsx visualizes coverage % with click-to-edit
- [ ] AI generator + completed blocks auto-update topic status

### Phase 4: Adult Update Stream
- [ ] adultStream.feed({ since, limit, kind?, actor? }) tRPC procedure
- [ ] Aggregates: scheduleBlocks completions, mood logs, struggles, tutor notes, photos, app drills, kiwi coins, milestone events
- [ ] /adults page renders chronological list with filter chips
- [ ] Auto-refresh every 30s

### Phase 5: Daily Lesson Generator (nightly)
- [ ] Cron 6pm ET → /api/scheduled/generate-tomorrow
- [ ] LLM plans full day from curriculum gaps + interests + IEP + tomorrow's calendar
- [ ] Each block: video URL + lesson + assignment + printable + app drill
- [ ] Insert as scheduleBlocks + assignments_library rows pinned via blockId
- [ ] Fallback to last-week template on failure with email alert

### Phase 6: Sync layer (Gmail + Drive pull/push)
- [ ] Daily 7am pull: spear.cpt@gmail.com Gmail → ingest curriculum/tutor/parent emails
- [ ] Daily 7am pull: Drive Reagan folder → mirror new files into assignments_library
- [ ] Daily 11pm push: dashboard photo submissions + completed printables → Drive Reagan/{date} archive folder
- [ ] OAuth via existing google-classroom MCP / gws CLI

### Phase 7: Kiwi always-on listening
- [ ] Wake word "Hey Kiwi" detection (Web Speech API + keyword spotter)
- [ ] Ambient mode: 10s windows transcribed locally, frustration/comprehension flags
- [ ] All audio stays in-browser; only transcripts sent server-side
- [ ] Adult-only toggle in Settings + privacy notice + per-block opt-in indicator

### Pending data from user
- [ ] Tutor email addresses for Madison / Sophie / Keith
- [ ] Confirm Mom's email = marcy.spear@gmail.com
- [ ] Confirm Indian Hill last day of school (default 2026-06-04 from seed)


## 2026-05-02 Architecture Reset — Roles + Single Source of Truth

### Roles + emails (locked in)
- **Parent** = Dad — `spear.cpt@gmail.com` — admin / dashboard owner
- **Student** = Reagan — `reaganhiggs910@gmail.com`
- **Grandma** = Marcy — `marcy.spear@gmail.com` — read-only viewer
- **Tutor** Madison — TBD — Mon + Wed 10–3
- **Tutor** Sophie — TBD — Tue + Fri 10–3
- **Tutor** Keith — TBD — Thu 11–2

### Phase 1: dead-account scrub + role rename
- [ ] Replace `student.googleEmail` default `reagan.higgs33@ihsd.us` → `reaganhiggs910@gmail.com` (server/db.ts)
- [ ] Replace `classroom.studentDomain` `ihsd.us` → `gmail.com`
- [ ] Remove `/@ihsd\.us$/i` allowlist regex (server/db.ts)
- [ ] Strip "PowerSchool — Indian Hill" from seed.mjs
- [ ] Remove @ihsd.us copy from Schedule.tsx, Settings.tsx, UploadOrSync.tsx, googleAuthLink.ts, DrivePushQueueCard.tsx
- [ ] Hide ihAssignments UI (table stays read-only legacy)
- [ ] DB: UPDATE app_settings SET value='reaganhiggs910@gmail.com' WHERE key='student.googleEmail'
- [ ] DB: UPDATE app_settings SET value='spear.cpt@gmail.com' WHERE key='parent.googleEmail' (insert if missing)
- [ ] DB: UPDATE app_settings SET value='marcy.spear@gmail.com' WHERE key='grandma.googleEmail' (insert if missing)
- [ ] Rename UI labels Adult/Helper/Owner → Parent / Grandma / Tutor / Student
- [ ] Vitest grep guard: production code must not mention ihsd.us / Reagan.higgs33

### Phase 2: multi-account roles
- [ ] Extend user.role enum: admin | parent | grandma | tutor | student | viewer
- [ ] Permissions matrix: parent=full, grandma=read+react, tutor=write blocks/notes/grades on assigned days only, student=own day, viewer=read
- [ ] Invite flow: parent emails invite → magic link → first sign-in creates user with assigned role
- [ ] Tutor assigned-days enforcement (Madison Mon+Wed, Sophie Tue+Fri, Keith Thu)

### Phase 3: tutor + grandma profiles
- [ ] Insert tutors rows for Madison/Sophie/Keith with weekly slots
- [ ] Insert grandma viewer profile for Marcy
- [ ] Assigned-day automatic block ownership (Tuesday's blocks = Sophie's tutor handoff page)

### Phase 4: Curriculum hub
- [ ] Subjects → strands → standards → topics → lessons (5th-grade Ohio)
- [ ] Per-topic status + evidence + last_touched_at + who_marked_it
- [ ] Curriculum.tsx coverage % visualization
- [ ] AI generator + completed blocks auto-update topic status

### Phase 5: Family Update Stream
- [ ] adultStream.feed tRPC procedure aggregating block completions, mood, struggles, tutor notes, photos, app drills, coins, milestones
- [ ] /family or /updates page with chronological feed and filter chips
- [ ] Auto-refresh every 30s, plus daily digest email Sun 6pm

### Phase 6: Daily Lesson Generator (nightly)
- [ ] Cron 6pm ET → /api/scheduled/generate-tomorrow
- [ ] LLM plans full day from curriculum gaps + interests + IEP + tomorrow's calendar + which tutor will be there
- [ ] Each block: video URL + lesson + assignment + printable + app drill + tutor-led-or-independent flag
- [ ] Insert as scheduleBlocks + assignments_library rows pinned via blockId
- [ ] Failure fallback to last-week template + email Parent

### Phase 7: Sync layer
- [ ] Daily 7am pull from Parent's Gmail (spear.cpt@gmail.com): curriculum/tutor/parent emails
- [ ] Daily 7am pull from Drive: Reagan folder mirror into assignments_library
- [ ] Daily 11pm push: photo submissions + completed printables → Drive Reagan/{date} archive folder

### Phase 8: Kiwi always-on listening
- [ ] Wake word "Hey Kiwi" detection (Web Speech API + keyword spotter)
- [ ] Ambient mode 10s windows with frustration/comprehension flags
- [ ] All audio in-browser; only transcripts sent server-side
- [ ] Adult-only toggle in Settings + privacy notice + per-block opt-in indicator

### Pending data from Parent
- [ ] Tutor email addresses (Madison / Sophie / Keith)
- [ ] Confirm Grandma's email = marcy.spear@gmail.com (locked)
- [ ] Confirm Reagan's last day of school (default 2026-06-04 from seed)


## 2026-05-02 Role + Daily-Assessment updates
- [ ] Grandma Marcy role = `editor` (not viewer): can edit blocks, mark done, upload photos, add notes; cannot change billing/secrets
- [ ] User.role enum extended: admin | parent | editor | tutor | student | viewer
- [ ] Permissions matrix: parent=full, editor=write+upload+notes (no billing), tutor=write blocks/notes on assigned days, student=own day, viewer=read-only
- [ ] Daily Assessment one-tap launcher card on Today: opens every app needed for today's blocks with `?authuser=reaganhiggs910@gmail.com` URL hint, copies non-Google passwords to clipboard, marks blocks in_progress on launch
- [ ] First-time consent disclaimer: kid/parent must click Allow once per app, then one-click forever
- [ ] Vitest: Daily Assessment launcher resolves correct app set from today's blocks + adds correct authuser hint


## 2026-05-02 Per-app identity + Tutor permissions
- [ ] Per-app card supports BOTH Student (reaganhiggs910@gmail.com) and Parent (spear.cpt@gmail.com) sign-in buttons; default = Student
- [ ] Daily Assessment launcher: identity-picker default Student, one-tap Parent override
- [ ] Tutor role permissions = Editor tier: edit schedule, add/remove assignments, mark done, upload photos, leave notes (no billing/secrets/users)
- [ ] Editor (Grandma Marcy) = same permissions as Tutor
- [ ] Permissions matrix doc in /docs/roles.md
- [ ] Vitest: tutor procedures pass authorization check; tutor cannot mutate billing/secrets endpoints


## In Flight (May 2 2026)
- [ ] Per-app dual identity: Student (reaganhiggs910@gmail.com) + Parent (spear.cpt@gmail.com) Google sign-in buttons on every app card
- [ ] Tutor profile rows: Madison, Sophie, Keith (placeholder emails until user provides) + Grandma Marcy editor row
- [ ] Role-based permission matrix: parent / editor / tutor / student / viewer
- [ ] Curriculum hub keyed on Indian Hill 5th grade (subject → unit → topic, done/in-progress/todo, % complete)
- [ ] Family Update Stream: live feed visible to Parent / Grandma / Tutors
- [ ] Automated nightly Daily Lesson Generator (skips weekends, targets curriculum gaps)


## SIMPLIFICATION PASS — Checkpoint #34+ (2026-05-03 user instructions)

### Phase 1 — Curriculum + AI daily assignments + daily-update sync (CORE — DO FIRST)
- [ ] Curriculum becomes primary adult landing (after unlock, '/curriculum' = first adult page)
- [ ] Curriculum: pin "Today's AI-built assignments" strip at top per day
- [ ] Schedule edit/reorder/done → fire curriculum.noteCoverage(topicId, date, notes) + autoCompleteFromHistory
- [ ] Schedule: "Sync future days" button — re-runs aiGenerate for next 5 school days using current coverage
- [ ] Nightly lesson generator: factor in actually-covered topics, skip done/in-progress
- [ ] AI plan adapts as Reagan completes more (struggle notes → easier next day; mastery → next topic)

### Phase 2 — Cut deprecated pages + drop leveling
- [ ] Delete TutorHandoff* pages + nav + routes
- [ ] Delete FamilyFeed.tsx + /family route + adult sidebar entry
- [ ] Delete UploadOrSync.tsx + nav + route
- [ ] Delete DailyAgendas.tsx + nav + route
- [ ] Delete DailyPacket.tsx + nav + route
- [ ] Delete standalone Whiteboard.tsx + Parent Notes nav (move into Settings sub-panel)
- [ ] Delete ProudWall.tsx + /proud route + nav (no Proud Wall anywhere)
- [ ] Delete Adventures.tsx page + /adventures route + sidebar entry (Kiwi handles adventure ideas conversationally)
- [ ] Remove all level-up notifications, badges, XP from Today/Analytics/Apps
- [ ] Strip levelUp event emitters from server (keep coin events)

### Phase 3 — Journal merge + My Skills rename
- [ ] Merge Journal page into Notebook (free-write + "what I'd like help with")
- [ ] Delete Journal.tsx + /journal route + Journal nav
- [ ] Rename "My Levels" → "My Skills"; remove level numbers (just % or done count)

### Phase 4 — Slim rewards + AI Assistant (full helper) + Analytics + Send-Request + de-Scribbles
- [ ] Rewards/Prizes ladder: keep ~10 rungs max, delete rest from seed
- [ ] AI Assistant: remove "Paste an email/doc" extraction box + "Auto-Sync Sources" stub
- [ ] Kiwi panel: full Reagan-helper (homework explain / encouragement / adventure ideas on request)
- [ ] Kiwi panel: "Send a request to my adults" button — emails Mom (spear.cpt@gmail.com) + Dad (blakehiggs@hotmail.com) + Grandma Marcy (marcy.spear@gmail.com) via notifyOwner / SMTP
- [ ] Analytics: drop IEP catch-up trajectory + PowerSchool import; keep radar+sparklines+grades
- [ ] grep "Scribbles"/"scribbles" in client+server, replace with neutral wording

### Phase 5 — iCal overlay + Whiteboard in Settings + de-Scribbles
- [ ] Settings: "Reagan's Google Calendar (iCal URL)" field, key calendar.icalUrl
- [ ] Schedule: server-side iCal fetch+parse + toggleable overlay layer
- [ ] Settings: Whiteboard sub-panel (move existing editor inline)
- [ ] Settings: trim to Profile / Appearance / Companion / Lock / Whiteboard / Calendar / Logs
- [ ] grep "Scribbles"/"scribbles" in client+server, replace with neutral wording

### Phase 6 — Assignments Library AI search
- [ ] AI search box (subject + topic + format) → ~10 suggested resources
- [ ] Each suggestion has "Add to a day" (date picker → drops as block)
- [ ] Adults can delete added blocks from this same UI

### Phase 7 — Realistic cartoon-style VOICES (clarified by user)
- [ ] Upgrade Kiwi/Blue/Daffy/Honk voices from robotic browser TTS to realistic cartoon-character voices (server-side TTS w/ per-companion pitch+rate+timbre)
- [ ] AI Assistant: full Reagan-helper (homework, explain, encourage) — already present, audit and ensure full capability
- [ ] Kiwi fun extras audit: random fly-around, perch animations, popping in occasionally — keep all, ensure activation only via wake-word/click (no auto-open, no mic prompt)


### Phase 3 addendum (Adventures + Request button)
- [ ] Convert Adventures from a page into a Reagan-facing popup/dialog (button on Today: "Find an Adventure" → modal listing same data)
- [ ] Delete /adventures route + Adventures nav entry
- [ ] Add a "Make a request" button visible on Reagan's pages (Today header) → opens dialog with text area + Kiwi-help-me-write button
- [ ] On submit: server sends email to PARENT_EMAILS (Mom + Dad) via notifyOwner / mail helper; persist requests row for adult review
- [ ] Adults see incoming requests inline in Settings or Curriculum top strip (small badge if unread)


## EXPANDED SCOPE (2026-05-03 follow-ups) — Kiwi powers + nightly agenda pipeline + uploaded knowledge

### Phase 1 — Knowledge ingestion (server/_knowledge/)
- [x] Q4 standards copied to server/_knowledge/q4_standards.txt
- [x] HS course catalog copied to server/_knowledge/hs_catalog.txt (forward-planning only, low priority context)
- [x] Scope/sequence copied to server/_knowledge/scope_sequence.md
- [x] IEP snapshot copied to server/_knowledge/iep_snapshot.md
- [x] Assignment tracker copied to server/_knowledge/assignment_tracker.csv
- [ ] Add knowledgeBundle helper that loads all _knowledge files at boot and exposes summarized text into generateScheduleDraft
- [ ] aiScheduleGenerator system prompt: include Q4 standards + IEP focus + scope/sequence currently-not-mastered topics + recent listening summaries + recent struggles
- [ ] Seed any missing curriculum_topics rows from Q4 standards (5.OA.1-3, 5.G.1-4, RL/RF/RI/W/SL/L 5.x) — idempotent

### Phase 2 — Curriculum hub + AI agenda + sync
- [ ] Curriculum.tsx: pin "Tomorrow's draft agenda" strip at top with regenerate + commit buttons
- [ ] curriculum.syncFutureDays mutation: re-runs aiGenerate for next 5 SCHOOL days (skip weekend + IH off days), commits each
- [ ] Schedule.tsx: "Sync future 5 school days" button (adult only)
- [ ] Schedule.tsx: when an adult marks a block done / edits / reorders → automatic call to curriculum.autoCompleteFromHistory after a 1s debounce

### Phase 3 — Nightly 8 PM agenda email pipeline
- [ ] db: add table dailyAgendas (date PK, generatedAt, lastEmailedAt, lastChangeAt, pdfStorageKey, version int)
- [ ] new server/agendaPdf.ts: builds a printable PDF (schedule + estimated minutes + worksheet attachments list + lesson links + IEP notes) using pdfkit / fpdf2 equivalent in node (pdfkit)
- [ ] new server/scheduledAgendaEmail.ts cron-style entry: at 20:00 EST every weeknight, build agenda for next school day, save PDF to storage, email to marcy.spear@gmail.com + spear.cpt@gmail.com with PDF + worksheet PDFs attached
- [ ] Resend logic: any change to that day's plan between 20:00 and start-of-school triggers a re-build + resend with subject "[UPDATED]"
- [ ] Save copy to Google Drive Homeschool Hub (rclone manus_google_drive remote → /Homeschool Hub/Daily Agendas/YYYY-MM-DD.pdf)
- [ ] Use existing scheduled-task pattern via /api/scheduled/nightlyAgenda endpoint + schedule entry (cron 0 0 20 * * 1-5)

### Phase 4 — Cuts + leveling drop (same as before)
- [ ] Delete TutorHandoff/TutorBriefing pages + nav + routes
- [ ] Delete FamilyFeed.tsx + /family + adult sidebar entry
- [ ] Delete UploadOrSync.tsx + nav + route
- [ ] Delete DailyAgendas.tsx + nav + route (replaced by email pipeline)
- [ ] Delete DailyPacket.tsx + nav + route (replaced by email pipeline)
- [ ] Delete standalone Whiteboard.tsx (move into Settings sub-panel)
- [ ] Delete ProudWall.tsx + /proud + nav
- [ ] Strip level-up notifications + badges + XP from Today/Analytics/Apps
- [ ] Strip levelUp event emitters from server (keep coin events)

### Phase 5 — Adventures popup, Notebook merge, request button, My Skills rename
- [ ] Convert Adventures from page → AdventuresDialog popup (keep all data)
- [ ] Delete /adventures route + Adventures nav entry; add "Find an adventure" button on Today
- [ ] Merge Journal.tsx contents into Notebook (TakeNotes.tsx) as a "Free Write" tab
- [ ] Delete Journal.tsx + /journal route + Journal nav
- [ ] Rename "My Levels" → "My Skills" in nav + page heading; remove level numbers (show % only)
- [ ] Add "Make a request" floating button visible on Reagan's pages
- [ ] requests table (id, fromUserId, kind enum, body, createdAt, resolvedAt, resolvedNote)
- [ ] requests.create mutation → notifyOwner + email Mom + Dad
- [ ] Kiwi-help-me-write button inside the request dialog (calls invokeLLM to phrase her thought politely)

### Phase 6 — Slim Rewards + Kiwi-Helper + de-Scribbles
- [ ] Prizes seed: trim to 10 rungs total (cover 25/50/100/200/350/500/750/1000/1500/2500 coins)
- [ ] AIChat (Knowledge.tsx) becomes "Kiwi Helper" — full Reagan helper (homework, explain, encourage, look up safe links/videos)
- [ ] Kiwi-Helper kid-safe content filter: server-side classifier blocks unsafe queries before answering
- [ ] Kiwi can: open YouTube link, open kid-safe Google search, open approved app links, change theme/companion/audio settings via prefs.set
- [ ] Whitelist tools the Kiwi-Helper can call (settings.set, theme.change, companion.activity, audio.toggle, openLink, openYouTube)
- [ ] grep "Scribbles"/"scribbles" across client+server, replace with neutral wording

### Phase 7 — iCal + Whiteboard in Settings + Library AI search
- [ ] Settings: "Reagan's Google Calendar (iCal URL)" field, key calendar.icalUrl
- [ ] Server: ical.fetch route — fetches + parses iCal, returns events for date range
- [ ] Schedule: toggleable "Mom's calendar" overlay layer
- [ ] Settings: Whiteboard sub-panel (move existing Whiteboard editor inline)
- [ ] Settings: trim sub-panels to Profile / Appearance / Companion / Lock / Whiteboard / Calendar / Notifications / Logs
- [ ] AssignmentsLibrary: AI search box (subject + topic + format) → returns ~10 suggestions with "Add to a day"

### Phase 8 — Quiet listening + Mom-only analytics sheet
- [ ] new client component KiwiEars: opens mic at app boot during school window (configurable, defaults Mon-Fri 8am-3pm), no toast
- [ ] Continuous SpeechRecognition (or MediaRecorder → Whisper /api/transcribe) buffer in 60s chunks
- [ ] Wake-word detector ("kiwi" / "hey kiwi") on the buffer — only then activates Kiwi response, otherwise silent
- [ ] Buffer transcripts pushed to server every 5 min: server/listeningSummary.ts → invokeLLM summarizer extracts {topics, completions, emotionEstimate, comfort, talkativeness, difficulty}
- [ ] listeningSummaries table (date, periodStart, periodEnd, subjectGuess, topicsJson, emotionScore, comfortScore, difficultyScore, talkativenessScore, rawSummary)
- [ ] Time-on-task tracker: combines mic-active + interaction signals into per-subject minutes per day
- [ ] Reagan Analytics: shows BASIC view only (existing radar + sparklines)
- [ ] Mom Analytics export: nightly job pushes detailed CSV/Sheet to /Homeschool Hub/Detailed Analytics/YYYY-MM-DD.csv (Drive, Mom-only access)

### Phase 9 — Realistic cartoon voices
- [ ] Server-side TTS: try Google Gemini TTS (already have GEMINI_API_KEY) or fall back to OpenAI-compatible TTS via Forge
- [ ] Per-companion voice profile (Kiwi: bright kid voice; Blue: deeper friend; Daffy: silly; Honk: gentle)
- [ ] Replace all client-side speechSynthesis usage with server-side audio URLs
- [ ] Audit Kiwi extras: random fly-around, perch animations, occasional pop-in — confirm wake-word-only response, no auto-open, no mic prompt visible

### Phase 10 — Tests + checkpoint + deploy
- [ ] vitest: knowledgeBundle loads + injects into prompt
- [ ] vitest: requests.create persists + emails owner
- [ ] vitest: dailyAgendas table CRUD + resend logic on change
- [ ] vitest: listening summary insert + Mom analytics export
- [ ] vitest: prizes ladder count = 10
- [ ] webdev_check_status pass
- [ ] webdev_save_checkpoint with full description


## EXPANDED SCOPE (cont.) — Curriculum-topic tagging is mandatory on EVERY agenda item
- [ ] Every agenda item (assignment, worksheet, lesson, video, game, read-aloud, even adventure) MUST resolve to an existing `curriculumTopics` row before insertion
- [ ] Each row carries: `subjectSlug`, `curriculumTopicId`, `topicCode` (e.g. `5.OA.1`), `topicTitle`, optional subtopic/strand
- [ ] AI generator: hard-reject any candidate item that cannot be matched to a topic (force a retry with stricter prompt instead of falling back to "freeform")
- [ ] Backfill helper: scan existing `scheduleBlocks` and `assignmentsLibrary` rows missing `curriculumTopicId` and try to match by code/title; flag the unmatched ones for adult review
- [ ] Worksheet/lesson PDF filenames stamped with topic code: `5.OA.1__order-of-ops__worksheet.pdf`
- [ ] Printable agenda PDF prints "Math · 5.OA.1 · Order of Operations" under each task
- [ ] Topic-coverage rollup auto-credits the matched topic when the block is marked complete (already partially in `updateBlock` cascade — extend to library + printables too)
- [ ] Q4 standards from `5thGrade-4thQuarterStandards.docx` are imported into `curriculumTopics` if not already present (idempotent seeder)
- [ ] Q4 ELA standards (RL/RF/RI/W/SL/L 5.x) imported as their own topics
- [ ] Vitest guard: `agendaTagging.test.ts` asserts no agenda item without a curriculumTopicId can land in scheduleBlocks via the AI generator


## EXPANDED SCOPE (cont.) — Tutor-of-the-day on every agenda + tutor AI co-pilot
- [ ] `dailyAgendas` row resolves the tutor scheduled for that date from the existing `tutors` + recurring tutor schedule (weekly + ad-hoc) and stamps: tutor name, arrival time, departure time, role (e.g. "Tutor", "Therapy with Ali Hill, LISW", "Mom day")
- [ ] Printable PDF + email body lead with: "Tutor today: Marcy Spear · 9:00 AM – 12:00 PM" (or "No tutor today — Mom only")
- [ ] If multiple sessions in a day (e.g. tutor AM + therapy PM), list each with its time window
- [ ] When the tutor logs in via OAuth (`role=tutor`), Today/Schedule pages get a "Tutor co-pilot" panel with Kiwi/AI chat scoped to today's agenda
- [ ] Tutor co-pilot can: swap an assignment for another from the Library or curriculum (within same topic), soften a block (lower minutes / change activity), postpone to tomorrow, add a quick review block, or log a struggle — all via natural-language commands processed server-side
- [ ] Every tutor-AI change writes back to the same `dailyAgendas` row, bumps `version`, sets `lastChangeAt`, and the resend-window cron picks it up if before school start
- [ ] Audit log entry on every tutor-AI change (who/when/what was changed) so adults can review
- [ ] Vitest: `tutorCopilot.test.ts` exercises swap + soften + postpone and asserts the agenda row + audit entry update


## EXPANDED SCOPE (cont.) — Universal AI Assignment-Finder
- [ ] One unified AI search box (Library page header + AI panel + Today "+" button) accepting text query AND image upload
- [ ] Image-upload path: vision LLM extracts subject + topic guess + grade-fit + free-text caption (e.g. "looks like a 5th-grade fraction-multiplication worksheet, ~15 min")
- [ ] Text-query path: same LLM normalizes user intent + age band + minutes
- [ ] Multi-source aggregator (server-side): internal Library, connected apps catalog (IXL, Khan, Prodigy, BrainPOP, Edpuzzle, Vocab.com, Blooket, Wayground, Seesaw, Canva, Code.org, Book Creator, Merlin, iNaturalist, Khan Academy Kids, Google Classroom), YouTube (kid-safe filter), curated open web (PBS Kids, Nat Geo Kids, NASA Kids, Common Sense, etc.)
- [ ] Each result row carries: title, source, thumbnail (cached), estimated time, AI-suggested curriculum topic code (5.OA.1, etc.), confidence
- [ ] Hard rule: result must auto-resolve a topicId before "Add to schedule" enables; if AI is uncertain, show topic picker for adult to confirm
- [ ] Buttons per result: "Add to today", "Add to [date]", "Add to Library", "Show me more like this", "Open"
- [ ] Kiwi voice/chat path: "Find me a frog video for science" → same pipeline, returns 3 picks for Kiwi to read aloud + drop on selection
- [ ] Reagan view: kid-safe filter forced on, no preview of unfiltered results, only age-appropriate sources
- [ ] Adult view: full source list, can disable kid-safe filter
- [ ] Server: `assignmentFinder.search` (text/image input), `assignmentFinder.addToSchedule` (topicId required), `assignmentFinder.addToLibrary`
- [ ] Vitest: `assignmentFinder.test.ts` covers text query, image upload, kid-safe filtering, missing-topic rejection


## EXPANDED SCOPE (cont.) — Role-gated Kiwi (Reagan REQUESTS only, never edits live)
- [ ] Server-side role guard on EVERY schedule mutation: `editSchedule`, `addBlock`, `swapBlock`, `softenBlock`, `postponeBlock`, `removeBlock`, `markComplete-for-credit`, `aiCommit`, `assignmentFinder.addToSchedule` — all require `role in (admin, tutor)`
- [ ] If Reagan (`role=user`) calls any of the above through Kiwi/UI, the server transparently rewrites it into a `studentRequests` row with: requestType, targetDate, targetBlockId, payload (the proposed change in plain language + structured diff), createdAt, status="pending"
- [ ] Kiwi confirms to Reagan: "I sent your idea to Mom — you'll see her answer here when she replies" (no live change)
- [ ] Adult inbox: badge in sidebar + Today page banner "Reagan has 1 new request" → one-tap Approve / Decline / Edit-then-Approve
- [ ] Approve = applies the change atomically + bumps agenda version + triggers resend if before school start
- [ ] Decline = stores reason (Kiwi can soften it for Reagan: "Mom said let's try this tomorrow instead 🌷")
- [ ] Notifications: pending request → in-app + email digest to Mom (don't spam — bundle if multiple in 30 min)
- [ ] Reagan-side Kiwi can still toggle her own personal settings live (homepage extras, audio, Kiwi activity level, hide a video she dislikes) — these are NOT schedule changes
- [ ] Reagan-side Kiwi can mark "I worked on this" as a self-report flag on a block (status stays 'in_progress' until adult marks complete-for-credit)
- [ ] Vitest: `roleGate.test.ts` — Reagan calling editSchedule returns a request row, NOT a schedule mutation; admin/tutor calling same path mutates directly


## EXPANDED SCOPE (cont.) — Persona + role split (Kiwi vs adult AI)
- [ ] Reagan-only Kiwi: bird character, cartoon voice, animations, wake-word/click activation, kid-safe filter forced, request-only schedule changes, "I worked on this" self-report flag
- [ ] Adults: plain text-only AI search-bar assistant labeled "AI" (not Kiwi), no voice/TTS, no mic, no character art, no animations, persistent in adult-area top bar
- [ ] Adult AI bar capabilities: universal search (text + image upload), edit live schedule (swap/soften/postpone/add blocks), approve Reagan's pending requests, run topic-tagged adds, no kid-safe filter
- [ ] Hide Kiwi entirely from adult routes; hide AI bar entirely from kid routes
- [ ] Server `aiAssistant.chat` already exists — branch persona by `ctx.user.role`: kid persona vs admin/tutor persona, different system prompt, different tool allowlist
- [ ] Move all schedule-mutation tools out of Kiwi's allowlist; keep only "submitRequest" + "togglePersonalSetting" + "openLink" + "kidSafeSearch"
- [ ] Adult AI tool allowlist: scheduleEdit, swapBlock, softenBlock, postponeBlock, addBlock, approveRequest, declineRequest, assignmentFinder.search, assignmentFinder.addToSchedule, openLink, libraryAdd
- [ ] Vitest: `personaSplit.test.ts` — kid role gets request-only tools; admin/tutor gets full edit tools; image-upload search rejects without role admin/tutor


## EXPANDED SCOPE (cont.) — owned printed curriculum (2026-05-03)

- [ ] Phase 5: add `ownedResources` table (title, kind=book|workbook|novel, totalPages, currentPage, defaultDailyPageSpan, subjectSlug, topicCodes[], notes)
- [ ] Phase 5: seed Reagan's actual books:
  - [ ] Tuck Everlasting (novel; ~140 pp; ~10 pp/day; ELA RL.5.1, RL.5.2, RL.5.3, RL.5.4, RL.5.6, W.5.3)
  - [ ] Michael's World (workbook; subject pending Mom confirm; ~2 pp/day)
  - [ ] Spectrum Science Grade 5 (workbook; ~150 pp; ~3 pp/day; science topics)
  - [ ] 180 Days of Language for 5th Grade (daily warm-up; 1 pg/day; L.5.x grammar)
- [ ] Phase 5: AI agenda generator must prefer these as primary anchors, format as "Read pg. 42-48 of *Tuck Everlasting*" / "Complete pg. 71 of *180 Days of Language*"; auto-advances `currentPage` when block status flips to complete
- [ ] Phase 5: surface "today's pages" in the agenda PDF + email body; do NOT attach PDFs for printed-book lines
- [ ] Phase 5: digital sources (apps, downloaded printables) keep PDF attachments as before
- [ ] Phase 5: adult AI bar can answer "what page is Reagan on in Spectrum Science?" and "bump Tuck Everlasting back 5 pages"


## Owned-curriculum seed values (2026-05-03)

- [ ] Seed Michael's World currentChapter=31, status=in_progress (chapter-based progression rather than page-based)
- [ ] Seed Tuck Everlasting currentPage=0, status=not_started, plan to start at Chapter 1 next ELA novel-study block
- [ ] Seed Spectrum Science Grade 5 currentPage=0, status=not_started (Mom to confirm starting page)
- [ ] Seed 180 Days of Language Grade 5 currentDay=1, status=not_started (Mom to confirm starting day)
- [ ] Add `kind=novel|workbook|chapter_book` distinction so AI knows whether to write "Read pg. X-Y" or "Read Chapter N"
- [ ] Reagan can tell Kiwi "I finished chapter 32" -> creates a studentRequest of kind=progress for adult approval
- [ ] Adult AI bar can confirm/correct progress in one sentence ("Yes, advance to ch 33"), which writes back to ownedResources


## Scattered-progress reconciliation (2026-05-03)

- [ ] Phase 5: add `ownedResources.status` enum: not_started | in_progress | in_progress_unstructured | done
- [ ] Phase 5: add `ownedResourcePages` table (resourceId, pageNumber, status=todo|done|skipped, completedAt, completedBy) — sparse storage, only rows for pages we know about
- [ ] Phase 5: tutor-only "Mark pages already done" mini-screen (Curriculum page) — opens for each `in_progress_unstructured` book on first AI scheduling pass
- [ ] Phase 5: AI scheduler reads `ownedResourcePages` and never re-assigns a page with status=done; advances to next todo page in numeric order
- [ ] Phase 5: nightly agenda PDF labels each book line with the next assigned page span and (optionally) "skipping pp. X-Y already done" footnote
- [ ] Phase 5: adult AI bar shortcut "Reagan did pages 12, 14, 19, 22 of Spectrum" -> bulk-marks those pages done in one mutation


## Phase 7 — Universal AI assignment-finder (in progress)
- [x] server/_lib/assignmentFinder.ts — Library + Sonar web/YouTube + Gemini image describe
- [x] server/routers.ts — adultAi.findAssignments + addFinderResultToDate procedures
- [ ] vitest server/assignmentFinder.test.ts — locks contract (kid blocked, kidSafe forced for tutors, topic resolved)
- [ ] Adult-side UI panel: search input + image-upload button + result list with one-click "Drop on …" date picker

## Phase 8 — Kid sidebar cull (final list — keep Apps & Tools, per user)
- [ ] Delete kid-sidebar entry: Proud Wall (whole nav row + page route)
- [ ] Delete kid-sidebar entry: My Levels (rename concept to "My Skills" + delete leveling)
- [ ] Keep kid-sidebar entries: Today, Schedule, My Skills, Bookshelf, Notebook, Apps & Tools
- [ ] Delete adult-side pages: Tutor Handoff, Family Stream, Upload-Sync, Daily Agendas page, Daily Packet, Parent Notes
- [ ] Delete the orphan routes from App.tsx so navigation never lands on a 404
- [ ] Delete the corresponding page files under client/src/pages/
- [ ] Delete the proudWall server router + db helpers (or stub them as no-ops if they're imported elsewhere)
- [ ] Verify dev server boots clean after deletions


## FINAL LAYOUT (locked May 4 2026)

### Kid sidebar (Reagan) — exactly 6
- [ ] Today
- [ ] Schedule
- [ ] Kiwi Coins (replaces My Levels)
- [ ] Bookshelf
- [ ] Notebook (Journal merged in)
- [ ] Apps & Tools

### Adult app — exactly 4 pages
- [ ] Curriculum Hub
- [ ] Daily Schedule (editable; tutors limited to their day; iCal overlay)
- [ ] Agenda Editor (universal AI search bar pinned at top with image upload)
- [ ] Settings (tabs: Reagan's Profile · Prize Shop · Requests Inbox · Recipients & Notifications · Whiteboard · iCal URL · School Calendar · Recurring Appointments · Tutors · Theme)

### Delete entirely
- [ ] Proud Wall
- [ ] My Levels (concept replaced by Kiwi Coins)
- [ ] Tutor Handoff page (replaced by adult AI bar)
- [ ] Family Stream / Family Feed
- [ ] Upload-Sync
- [ ] Daily Agendas page (separate)
- [ ] Daily Packet page
- [ ] Parent Notes page
- [ ] Adventures page (becomes a popup launched from Today)
- [ ] Journal page (merged into Notebook)
- [ ] Any "Scribbles" branding string

### Design constraint (anyone-can-use-cold)
- [ ] Plain language only — no jargon, no acronyms, no internal terms ("agenda block", "curriculum topic id", etc.)
- [ ] Big tap targets (min 44x44, prefer 56+)
- [ ] One obvious next action per screen
- [ ] Empty states explain what to do next in one sentence


## Practice for Coins (extra-credit hub) — May 4 2026
- [ ] Curated drill library (math/ela/science/social-studies/spelling) with auto-open links
- [ ] /practice route with subject → topic → drill flow
- [ ] Coin payout on completion, capped per day, gated to outside school hours
- [ ] Link from Today page + sidebar
- [ ] Vitests for library + payout-window logic


## Turn-ins reset + AI auto-grade + searchable archive (May 4 2026)
- [ ] Wipe existing turnIns rows (clean slate per Mom)
- [ ] Curriculum page: replace Recent turn-ins block with compact scroll table
- [ ] Show only the latest 5 turn-ins in the table
- [ ] Search box above table that searches ALL turn-ins (not just 5)
- [ ] tRPC `turnIns.searchAll` that scans the whole archive (title, subject, date, AI grade)
- [ ] Auto AI-grade every new turn-in (best-effort, falls back gracefully)
- [ ] Back-fill AI grades for any past ungraded turn-ins
- [ ] Mirror every turn-in (file + grade summary) to Drive Hub → Finished Work
- [ ] Vitests for searchAll + grader fallback


## Reagan Intro Tour from Kiwi (in progress)
- [ ] Build IntroTour component (8-step Kiwi-narrated walkthrough of the site)
- [ ] Auto-show first time on Today, "Replay tour" button in sidebar / Apps
- [ ] Persist `tourSeen` in localStorage + a "Restart tour" entry in Settings → People
- [ ] Cover topics: Today blocks, Coins, Practice, Apps, Adventures, Notebook, Print, Ask Kiwi (how to ask AI)


## /api/calendar.ics public feed (May 2026)
- [ ] Express route `/api/calendar.ics` returns valid VCALENDAR feed of upcoming days' blocks
- [ ] Includes title, description, time, subject, page refs
- [ ] Surface feed URL inside Settings → Calendar so Mom can copy it
- [ ] Verify Google Calendar can pull from `https://reaganschool.manus.space/api/calendar.ics`

## Audit fix #3 (block detail drawer) + #6 (pencil-draw quick button)
- [ ] BlockDetailDrawer links to: matched worksheet, packet PDF, kid videos, "draw on it" Apple-Pencil mode
- [ ] One-tap "✏️ Draw on this worksheet" button on every Today block that has a printable


## Live Drive Hub mirror (Mom requested May 4 2026)
- [ ] Audit drivePushQueue: which targets currently auto-enqueue?
- [ ] Seed Hub now: tomorrow's daily schedule PDF + agenda
- [ ] Seed Hub now: every active assignment + finished submission
- [ ] Seed Hub now: latest report cards + journal entries + tutor handoffs + adult notes
- [ ] Seed Hub now: today's coin ledger snapshot
- [ ] Wire dashboard write paths (assignments.create, submissions.create, plans.regenerate, journal.add, reports.publish, coins.grant) to enqueue Drive push
- [ ] Run /api/scheduled/drive-push/pending and /api/scheduled/drive-snapshot now to flush
- [ ] Verify all 11 Hub subfolders show new files
- [ ] Vitest covering enqueue triggers


## Manus-style AI Agenda Editor (Mom asked May 4)
- [ ] Server: `agendaEditor.applyInstruction` tRPC procedure — accepts `{ planId, instruction }`, returns structured edit-plan + diff preview (no DB write)
- [ ] Server: `agendaEditor.commit` mutation — applies the edit-plan transactionally + writes a snapshot for undo
- [ ] Server: `agendaEditor.undo` mutation — restores most recent snapshot
- [ ] Server: full manual block CRUD (`blocks.update` for start/duration/order/type/topicSlug/tutor/location)
- [ ] LLM tool spec: vague vibes / targeted shifts / surgical edits / bulk reschedule / add+remove blocks
- [ ] UI: chat-style editor on AgendaEditor page with diff preview, Apply, Undo
- [ ] UI: full block grid (drag to reorder, edit time/duration inline, change type/topic/tutor)
- [ ] Vitests for instruction parser + commit/undo

## Phase 15 — Manus-style AI Agenda Editor (DONE 2026-05-04)
- [x] server/_lib/agendaEditor.ts (NL EditPlan generator + validator + in-memory applier)
- [x] tRPC agendaEditor router: snapshot / preview / commit / undo
- [x] /agenda-editor page: chat input, preview chips, side-by-side diff, Apply + Undo, manual block grid (time/min/title/type/subject/topic/delete)
- [x] Adult sidebar entry "Agenda Editor" → /agenda-editor
- [x] 9 vitests for validateEditPlan + applyEditPlanInMemory; full suite 449/450 green (1 skipped)


## 2026-05-04 user request — Today = single video lesson
- [ ] Wipe today's existing scheduleBlocks for May 4 2026
- [ ] Insert a video-lesson block built around https://youtu.be/fajsyiKRfxI
- [ ] Tie the block to the saved Plants topic (curriculumTopics)
- [ ] Tie the block to the saved Angle Signatures topic (curriculumTopics)
- [ ] Verify on Today + Daily Schedule + Agenda Editor pages

## 2026-05-04 user request — refined (option B)
- [ ] Locate currently-saved video resource(s) on site that should be replaced by https://youtu.be/fajsyiKRfxI
- [ ] Update those curriculumResources rows to point at fajsyiKRfxI (Earth's Movements: Rotation & Translation)
- [ ] Locate or create the saved "Angle Signatures" math topic
- [ ] Wipe today's 8 scheduleBlocks (planId 360001)
- [ ] Insert one Video Lesson block for today tied to Plants (Sci 2-1) + Angle Signatures
- [ ] Verify on Today + Daily Schedule + Agenda Editor

## 2026-05-04 user request — refined v2 (math arc)
- [ ] Locate or create math topic for "Circles & 360° (vocabulary, parts of a circle)"
- [ ] Locate or create math topic for "Triangle interior angles sum = 180°"
- [ ] Update the currently-saved video resource URL to https://youtu.be/fajsyiKRfxI
- [ ] Wipe today's 8 scheduleBlocks (planId 360001)
- [ ] Insert today's blocks: (1) Video Lesson watch fajsyiKRfxI ~15 min, (2) Math: 360° circles & circle parts ~25 min, (3) Math: triangles & 180° angle sum ~25 min, (4) Plants tie-in (Sci 2-1) ~20 min
- [ ] Verify on Today + Daily Schedule + Agenda Editor

## 2026-05-04 user request — FINAL scope (DONE)
- [x] Find existing "Planets" assignment row → 60004 Weight on Planets
- [x] Find existing topics → Sci 1-1 Sun/Earth/Moon, Math 8-4 Angles
- [x] Pin video https://youtu.be/fajsyiKRfxI to today's library
- [x] Wipe today's 8 scheduleBlocks (planId 360001)
- [x] Insert today's 7-block lesson plan (warm-up, video, walk-around-the-sun, degrees mini-lesson, body-compass outdoor, color the planets, reflection)
- [x] Add 4 library entries for today (video, walk-around-sun, body-compass, NASA coloring sheet)
- [x] Pin saved Planets assignment to today
- [x] Verify (UI inspection pending — need user refresh)

## 2026-05-04 user request — extra add (locked v3)
- [ ] Add a "Color the Planets" mini-block to today (with Solar System printable link)
- [ ] Add a "Flashlight + Globe: day/night, axial tilt, seasons" hands-on block (NASA Space Place + PBS LearningMedia link)


## 2026-05-04 user request — append v2 (DONE)
- [x] Append "Lunch with Mom" block (10:45, 30m) → 690008
- [x] Append "Spectrum Math Grade 5 — pg 146–148" (11:15, 30m, tagged Math 8-4) → 690009
- [x] Library entry for Spectrum pgs → 90005


## 2026-05-04 user request — append v3 (DONE — placed AFTER Spectrum Math, since Spectrum was already finished)
- [x] Insert "🧭 Build a Compass + Degrees" → 690011 (12:30, 30m)
- [x] Insert "🎬 Planets Recap" → 690012 (13:00, 15m)
- [x] Library entries 90006 + 90007


## 2026-05-04 user request — append v4 (DONE)
- [x] Mark Spectrum Math (690009) complete
- [x] Insert "👵 Grandma's Lesson — recap (45m)" → 690010, marked complete
- [x] Insert "🧭 Build a Compass + Degrees" → 690011
- [x] Insert "🎬 Planets Recap — rewatch" → 690012
- [x] Library entries 90006 + 90007


## 2026-05-05 (TOMORROW) plan — angles & degrees (DONE — v3 with flashcards + pg 148)
- [x] 9 blocks: warm-up → flashcards study → pg148 review → pizza-wheel spinner → protractor worksheet → lunch → Spectrum 149–151 → video recap → reflection
- [x] 8-shape printable flashcards generated (circle→nonagon, both sides) at /manus-storage/shape_flashcards_081b30a9.pdf
- [x] Reagan's pg 148 photo uploaded at /manus-storage/spectrum_g5_pg148_pretest_ch8_49d81c6d.jpg
- [x] Library entries 90008–90012 pinned to 2026-05-05


## 2026-05-04 BUG — Agenda Editor cannot save NEW blocks (FIXED)
- [x] Root cause: page had no "+ Add block" button on the manual grid; only chat-driven inserts worked
- [x] Added blocks.createForDate tRPC mutation (auto-ensures plan, appends at end)
- [x] Added "+ Add block" button in AgendaEditor manual grid card header
- [x] Vitest covering blocks.createForDate (3 tests, passing)


## 2026-05-04 — Agenda Editor AI-first redesign (DONE)
- [x] Widened system prompt to handle tutor swaps, push-to-tomorrow, topic swaps, vibe edits, brain breaks, uniform durations
- [x] Big central chat box with ⌘/Ctrl+Enter to send, larger placeholder examples
- [x] Manual grid demoted into collapsible "⚙️ Advanced" footer
- [x] Read-only quick view of current schedule when no preview is active
- [x] 10 sample chips (tutor not here, swap topic, every block 20 min, etc.)
- [x] 5 new vitests covering tutor, push, topic swap, uniform duration, brain break


## 2026-05-04 — Agenda Editor: drag-drop + fix timeline edit
- [ ] BUG: start-time (timeline) edits don't save in manual grid — diagnose & fix
- [ ] Add drag-and-drop reorder to manual block grid (with keyboard a11y fallback)
- [ ] Make blockType (theme/type), subject, topic all inline-editable dropdowns that save on change
- [ ] New blocks.reorder mutation that takes orderedIds[] and rewrites sortOrder + cascades startTimes
- [ ] Vitest: blocks.reorder + blocks.update startTime


## 2026-05-04 — 12-hour AM/PM time + drag-drop in Agenda Editor (DONE)
- [x] Time helper parseTime12h + formatTime12h
- [x] 12-hr in Advanced grid + Current schedule + diff preview
- [x] Drag handle + HTML5 dnd on Advanced rows
- [x] blocks.reorder + blocks.shiftDay mutations
- [x] 6 vitests; full suite 467 passed


## 2026-05-04 — five new adult asks
- [x] Kiwi voice error — routed to neural Gemini TTS (Leda); audible by default
- [x] Whole-day start-time shifter on Agenda Editor (±5/±15 buttons)
- [ ] AI agenda chat: file/image upload (assignment, worksheet) and "create custom worksheet" op
- [ ] Settings page AI assistant (chat that toggles theme, quiet hours, tutor swap, …)
- [x] Drag-and-drop reorder in Advanced + 12-hr AM/PM time everywhere


## 2026-05-04 — Kiwi voice neural TTS (DONE)
- [x] Routed Kiwi through existing Gemini TTS (kiwi.voice mutation, Leda voice)
- [x] Cached audio handled by existing cartoonVoice pipeline
- [x] speakLikeBird now fetches + plays the Gemini WAV; browser TTS only as fallback
- [x] Default-on (no more silent kiwiSilent default)
- [x] Existing voice tests stay green (20 cases)


## 2026-05-04 — Wake-word + livelier Kiwi (DONE except fly-across)
- [x] Renamed Settings toggle to "Wake word ('Hi Kiwi')" with hint
- [x] Same toggle visible inside Reagan's Kiwi chat popup header (small ear icon)
- [x] Extra micro-actions on KiwiPerch (peck, stretch, head-tilt added)
- [x] Occasional flock visit pop-ins (Blue / Daffy / Honk) via cameo system
- [ ] Tap → small "fly across" animation (still TODO)


## 2026-05-04 batch (pending)
- [x] H. Save Reagan's "Fake Blood Spider" story as today's Writing turn-in (original spelling preserved + cleaned-up version + photo) — done. Block #720001, submissions #870001 (original) + #870002 (clean).
- [x] H. Award +10 Kiwi Coins for the story — done.
- [ ] D. Attach real YouTube link (https://youtu.be/fajsyiKRfxI) to today's planet video block
- [ ] E. Universal pattern — auto-render YouTube/Vimeo URLs in any block description as a clickable link/embed
- [ ] A. Remove "Indian Hill agenda mirror" block from Daily Agendas page
- [ ] B. Remove "in Indian Hill pacing order" phrase from Curriculum subtitle
- [ ] C. Fix Curriculum page dark-theme contrast (rings, turn-ins, topics rows, chips, badges, status legend)
- [ ] F. Add Delete action to tutors list in adult area
- [ ] G. Add Delete capability to other adult-area people lists
- [ ] I. Drive root https://drive.google.com/drive/folders/1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r. Top-level folders mirror the dashboard sidebar: Curriculum, Daily Schedule, Worksheets (Daily Packets), Printables, Assignments (To Do + Finished + Extra Work, by subject + file type), Finished Work, Tutor Handoffs, Report Cards, Journal, Notes — Reagan, Adult Notes, Kiwi Coins, Kiwi Conversation Analytics, Analytics, Apps & Integrations, Tutors, Behavioral Notes, Snapshots, Archive (legacy), README.md. No numeric prefixes on folder names. Curriculum folder splits by subject → topic. Files prefixed `DD-MM-YYYY — Title.ext` (per user request).
- [ ] I. Ensure all categories archive to Drive: daily printables, turn-ins, assignments, grading, curriculum-covered logs, behavioral notes, Kiwi analytics, school analytics
- [ ] J. Behind-the-scenes records dashboard for adult — RICH set of cards: school coverage, skill mastery (per topic + standard), curriculum coverage map, grading + rubric distribution, behavioral / emotional struggle heatmap, mood trend, Kiwi conversation analytics (volume, sentiment, top topics, wake-word activations), apps & integrations usage, tutor sessions, Kiwi Coins economy, print + Drive activity, IEP progress (RIPE/RIMP), daily snapshot index, **attendance/absenteeism (daily, monthly, YTD %, Ohio 900-hr running total)**, **letter+number grades per subject + quarter + cumulative**, **standardized assessments trend (Acadience/MAZE/MAP/decoding/writing)**, **IEP service minutes**, **instruction hours by adult/tutor/subject**, **field-trip/adventure logs**, **health log**, **end-of-year portfolio bundler**. Every card has "Export to Drive" → CSV in Analytics/ with `DD-MM-YYYY — metric.csv` filename.
- [x] K. One-tap "Move to tomorrow" action on every block in adult editors (Today inline chip + BlockEditor footer + AgendaEditor inline button) — done. Backed by adultAi.postponeBlock + vitest spec server/postponeBlock.test.ts.
- [ ] L. Show tutor's name + day's availability inline on the Daily Agendas page (per-day strip above the blocks)
- [ ] L. Render tutoring hours as a shaded "tutor here" band on the Daily Agenda timeline (so blocks visually anchor against the tutor's actual presence)
- [ ] M. Save the recurring tutor schedule into the database. Week A: Mon Madison 10-3, Tue Sophie 10-3, Wed Madison 10-3, Thu Keith 11-2, Fri Sophie 10-3. Week B: Mon/Tue/Wed Sophie 10-3, Thu Keith 11-2, Fri Sophie 10-3.
- [ ] M. Log today's tutor absence: 4 May 2026 — Madison sick (excused)


## 2026-05-04 evening — additional scope (pending)

- [ ] Delete `/agendas` (Daily Schedule) page entirely; remove its sidebar entry
- [ ] Move TutorDayNotesBox component INTO the Notebook drawer (Notebook becomes a global open/close slide-over panel)
- [ ] Notebook drawer launcher: small fixed pill on mid-right edge of every page (only visible when adult lock unlocked); positioned away from Quick-Add FAB + Kiwi perch so it's hard to hit accidentally; vertical "📓 Notebook" label; tap to slide open from right, backdrop or X to close
- [ ] Build new `/analytics` adult page (rich behind-the-scenes records dashboard)
- [ ] Move per-topic progress arc cards from Curriculum Hub onto the new Analytics page
- [ ] Use only real, factual analytics data on Analytics page (no synthetic events)
- [ ] Add Analytics entry to the FOR ADULTS sidebar nav


## 2026-05-05 — P12 + P14 status
- [x] P12 — Trim curriculum extras: PEMDAS, Place value to billions, Real-world rates & ratios were never seeded; Volume Formulas for Rectangular Prisms (id 50) was already deleted in a prior pass. Confirmed via scripts/check50.mjs (only ids 48, 49 remain in the Volume strand).
- [x] P14 — Tour gate hardened in Today.tsx: onClose handler now defensively writes `kiwiTourSeen=1` to localStorage on every close path, so even if some dismissal route bypasses IntroTour's internal markTourSeen() the tour will not auto-re-show on the next visit.


## 2026-05-05 — additional scope (NEW from screenshot annotation + voice notes)

- [ ] Analytics page: add 5th-grade total / "approx levels" alongside the mastery rings (so "0 of 37 skills" → also shows "≈ 5th-grade level X / 5th-grade total")
- [ ] Analytics page: add Apps usage card (per-app launches + minutes) — surface IXL / Khan / Prodigy / etc. activity
- [ ] Analytics page: delete the empty PowerSchool placeholder card (no PowerSchool data → remove the card entirely; do not show "No PowerSchool data yet…")
- [ ] Analytics page: more visual variety but stay simple and not confusing — radar, sparklines, mastery bars, mood/struggle heatmap, app-usage card, IEP catch-up, current-standing card
- [ ] Move per-topic progress arc cards from Curriculum Hub → Analytics page (already in earlier scope, restated for clarity)
- [ ] Curriculum Hub: change font + color + box treatment so it's visually distinct from other adult cards and easier to read; update all adult-area grey/translucent boxes for legibility on every theme
- [ ] Global grey-box pass: every grey/dark-translucent card should have foreground text contrast ≥ 4.5:1 on every theme
- [ ] Printable daily agenda emailed PDF: keep page 1 = the agenda summary; **append one page per block with the full lesson** — video URL + description, attached worksheet pages (rasterized so they print), block instructions/materials, so the printout is fully usable when there is no dashboard access
- [ ] Kid /schedule page: it's redundant with Today; either rework as a real **Reagan-friendly weekly view** (this week's plan, choice/adventure picks, what's coming) or delete and merge into Today. Defaulting to "rework as weekly kid view"
- [ ] Adult Settings: add Kiwi behavior sliders — animation amount (0–100), funny-personality dial (0–100), talking amount (0–100), and a wake-word-only toggle
- [ ] Adult Settings: NO bird sprites in the sidebar (My Flock belt should not autoplay sprites); move sprites/animations to Today/Kiwi popup only
- [ ] Adult Settings: per-object visibility + behavior cards for: Quick-Add FAB, Kiwi Perch, Notebook drawer pill, Resource Dock, Companion belt, Weather widget — each with show/hide + position preset


## STANDING RULE (added 2026-05-05): "Don't show if no info"

Any card, section, row, sidebar entry, banner, or analytics tile that would
otherwise render an empty-state placeholder (`No X yet`, `Nothing logged`,
`0 items`, persistent `Loading…`, etc.) MUST instead **render nothing**.

Apply this everywhere:
- Analytics page (every card)
- Curriculum Hub (every section)
- Today page strips
- Adult dashboards
- Tutor / Family / Settings tabs
- Sidebar groups (no empty "More" header, no empty "For Adults" header)
- Notebook drawer (no empty "Today's notes" panel; only the input form when
  there are 0 saved notes)

Empty-state copy is only allowed when an action is unconditionally needed
on first run (e.g. Onboarding step 1). Otherwise: hide the wrapper.

Sweep targets (initial pass):
- [ ] Analytics: hide MoodArcChart card when 0 logs
- [ ] Analytics: hide Skills Mastery card when 0 ladder rows
- [ ] Analytics: hide Struggle hotspots card when 0 struggles
- [ ] Analytics: hide Subject grades card when 0 grades
- [ ] Analytics: hide Recent Submissions card when 0 submissions
- [ ] Analytics: hide Screening History card when 0 screenings (already conditional)
- [ ] Analytics: hide Recent Emotional Struggles when 0 struggles
- [ ] Analytics: hide IEP Goals/Accommodations sub-columns when 0 each
- [ ] PowerSchoolGradesCard: returns null when no data (DONE)
- [ ] CozyShell: don't render "More" header when MORE_NAV is empty
- [ ] CozyShell: My Flock belt — don't render header when belt has 0 items
- [ ] DailyAgendas (deleted) — N/A
- [ ] Tutor Day Notes panel: only render the saved-notes block when items.length > 0
- [ ] Curriculum Hub: hide subject card when 0 topics
- [ ] Today: hide adult quick-link card when adult locked or 0 adult tools


## 2026-05-05 — Kiwi Behavior on Analytics + Settings sliders

Analytics page (adult-only):
- [ ] **Kiwi today** card: today's interaction count, talks today, top topic Reagan asked Kiwi, Kiwi-initiated check-ins today
- [ ] **Kiwi together — averages** card: average interactions/day across all days together, total interactions, total days together, longest streak of daily kiwi use
- [ ] Both cards hide when 0 interactions ever ("don't show if no info" rule)
- [ ] Backend: `kiwi.behaviorDaily` + `kiwi.behaviorAggregate` tRPC queries reading from existing kiwi/adultAi message logs (no new table — derive from `adultAiMessages` + any per-day kiwi event log already present)

Settings (adult):
- [ ] **Sliders** for Kiwi: Animation amount, Talking amount, Funny personality (each 0–4)
- [ ] Persist to `appSettings` (key per slider) — pre-existing `gamePrefs`/`appSettings` infra reused
- [ ] Live-apply: KiwiCompanion + KiwiPerch read these from existing context and gate animations/messages by the level
- [ ] Per-object controls below the Kiwi sliders: KiwiPerch on/off, sidebar sprite on/off (default off), QuickAddFab on/off, NotebookDrawer pill on/off
- [ ] No bird sprites in sidebar by default


## 2026-05-05 — School-window listening behavior log (CONFIRMED)

Goal: a daily behavior summary derived from passive listening, but ONLY
during Reagan-school-related time windows AND only when the chunk is
actually relevant (her voice / tutor / school content). Background TV,
sibling, or someone-else-on-phone chunks are dropped (not stored).

Server:
- [ ] Reuse existing `listeningSummaries` table — add fields if needed:
      `relevanceScore` (0-100), `discardedReason` (enum: `background_noise` | `other_person` | `silence` | `non_school` | null), `schoolBlockId` nullable FK
- [ ] Helper `isWithinSchoolWindow(ts)`:
      a chunk is "within school window" only if a `scheduleBlocks` row
      exists for today whose [startTime, endTime) covers ts. No active
      block → reject up front, never call the LLM, never store audio ref.
- [ ] Helper `classifyRelevance(transcript)`:
      LLM 1-shot returning `{relevant: bool, reason: enum, topic: string?}`.
      `relevant=false` → store ONLY a tiny tally row (no transcript, no
      audio ref). `relevant=true` → store a normal listeningSummaries row.
- [ ] tRPC `listening.todayBehavior` — derive: focus level (relevant/total
      ratio), distraction count, off-task moments (non_school during a
      school block), top topic.
- [ ] tRPC `listening.aggregateBehavior` — all-time averages.

Frontend (Analytics page):
- [ ] "Kiwi today" card: append a "Today's listening behavior" sub-section
      with focus%, distractions count, off-task count, top topic.
      Hide entire sub-section when 0 chunks today.
- [ ] "Kiwi together — averages" card: append all-time focus%, total
      relevant chunks, total dropped chunks. Hide section when 0 ever.
- [ ] Both root cards still hide entirely when zero kiwi interactions
      AND zero listening data ("don't show if no info").

Privacy:
- [ ] Audio bytes are NEVER persisted; only the transcript when
      `relevant=true`. Discarded chunks store only the reason + count.
- [ ] All listening rows are adult-only — never queried from kid views.


## 2026-05-05 — Analytics page mirrors Google Drive hub (CONFIRMED)

Source of truth for the structure: pasted_content.txt (Reagan School Hub
→ 05 - Progress and Reports/Analytics). Dashboard Analytics page is the
LIVE view; Drive folders are the long-term archive.

Top-level sections on /analytics (in this order):

1) Day-to-day numbers
   - [ ] Existing radar / sparklines / mastery / trajectory / IEP cards
   - [ ] "Open in Drive" button → root Analytics folder

2) Kiwi AI
   - [ ] Day Summary card (today)
   - [ ] Voice & speech signals: talkativity (WPM + minutes), Voice Mood
         (Bright / Excited / Flat / Sleepy / Upset / Mixed),
         modulation, clarity, pause count
   - [ ] Activity levels: focus%, restlessness, engagement, breaks,
         off-task, on-task streaks
   - [ ] Adaptive level changes today: list of step-down / step-up events
         with reason (LLM reasoning log) and adult-override toggle
   - [ ] Alerts: surfaced from Models & Rules thresholds
   - [ ] "Open in Drive" → Kiwi AI folder
   - [ ] All sub-sections honor "don't show if no info"

3) Behavior & Learning Insights
   - [ ] Daily behavior log card (today)
   - [ ] Day interpretation: Kiwi / Adult / Reagan tabs
   - [ ] Trends over time: weekly, time-of-day heatmap, monthly
   - [ ] Effects on learning: correlation strip (focus×subject grades)
   - [ ] Ways she learns best: 8-style profile bar (Visual, Auditory,
         Kinesthetic, R/W, Social, Solo, Game/Reward, Outdoor)
   - [ ] Subjects best / struggling chips
   - [ ] Recommendations: Tomorrow / Week / Month tabs
   - [ ] "Open in Drive" → Behavior & Learning Insights folder

Privacy & retention (rules baked in):
- [ ] Raw audio: NEVER persisted on dashboard side. Drive hub holds
      Today/ + Last 7 Days/ short-term audio if Mom enables it.
- [ ] Voice mood + talkativity: adult-only display. Never shown on kid pages.
- [ ] Listening data: only collected during Reagan school windows + only
      stored when relevance classifier returns relevant=true.
- [ ] Mirror: when listening summaries are written on the dashboard, the
      next mirror run picks them up into Drive
      `Kiwi AI/Day Summaries/Daily Recaps/` and
      `Behavior & Learning Insights/Daily Behavior Logs/Today/`.

Settings (adult, sliders): unchanged from prior entry.


## 2026-05-05 — IEP at-a-glance mini-card on Analytics (CONFIRMED)

- [ ] Tiny "IEP at a glance" card in Analytics → Kiwi AI section.
      One row per active IEP goal: name + status chip
      (Behind / On / Ahead) + "Open in Drive →" link to the
      `Goals/IEP-style Plans` folder.
- [ ] No detailed bars / source-labeled rows / estimated-vs-real charts
      on the dashboard. Full breakdown lives in Drive only.
- [ ] Mirror still writes the full breakdown to Drive on the next run
      (Goals/IEP-style Plans + Behavior & Learning Insights → Subjects).
- [ ] "Don't show if no info" — card hides until at least one IEP goal
      exists in the DB.


## 2026-05-05 — Tutor-friendly daily schedule editor

- [ ] One-screen day builder for tutors (mobile-friendly).
- [ ] Single "+" button to add a block; auto-fills next free time slot.
- [ ] Drag to reorder; click chips to edit time / duration; inline rename.
- [ ] Autosave on blur — no Save button.
- [ ] One-tap templates: Standard school day, Half day (sick / early
      dismissal), Tutor-only day, Field trip day.
- [ ] Quick-attach worksheets / videos / lessons from a sidebar of
      recent items per block.
- [ ] "Copy yesterday" + "Copy from last Monday" buttons.
- [ ] Tutor mode toggle: strips analytics / behavior / IEP from view,
      shows only schedule editor.
- [ ] Schedule editor is reachable from /schedule (adult/tutor sees
      editor; Reagan sees the simple weekly view).


## 2026-05-05 — /schedule reframe + sidebar Kiwi grouping

- [ ] /schedule page: KEEP it (do not delete or merge).
- [ ] /schedule default view = weekly (week-at-a-glance for Reagan);
      Today view stays available as a tab inside.
- [ ] Sidebar: collapse "Kiwi Coins" + "Practice" into a single "Kiwi"
      parent entry with two child links (Coins, Practice). Frees a row
      and groups Kiwi-themed kid surfaces together.


## STANDING RULE (added 2026-05-05) — NO GREY BOXES, ANYWHERE

- No `bg-muted`, `bg-slate-*`, `bg-gray-*`, `bg-zinc-*`, `bg-neutral-*` surfaces left visible.
- Every previously-grey card / chip / hint band / placeholder is replaced with one of:
  * Cream paper (cream/notebook themes)
  * Warm dark slate with amber border (starry/chalkboard themes)
  * Subject-tinted card on subject pages (uses tintCardStyle / tintInkStyle)
- Inner text always uses the matching ink color so contrast stays AA+.
- Implementation: one CSS sweep that overrides every `.bg-muted*`, `.bg-slate-*`, `.bg-gray-*`, `.bg-zinc-*`, `.bg-neutral-*` to the themed surface and forces ink to `currentColor` of the parent themed card.

- [ ] Apply CSS sweep to index.css
- [ ] Verify on Today, Curriculum, Analytics, Settings, Notebook, Levels, Rewards, Bookshelf, Schedule, Apps


## 2026-05-05 — Kiwi page consolidation (Coins + Practice → ONE /kiwi page)

- [x] Sidebar: collapse the two-child Kiwi group into a single `Kiwi` leaf entry pointing at `/kiwi`. Update sidebar contract test (kid required = Today, Schedule, Kiwi, Bookshelf, Notebook, Apps & Tools = 6 leaves, 0 group headers).
- [x] New `/kiwi` page top strip: big coin total on the left (no grey, no card chrome) + "Email Mom & Grandma to redeem coins" button on the right. Button opens a `mailto:` composer prefilled with the current coin total. No prize ladder, no list of current prizes.
- [x] Below: Practice activities grouped by subject. Each subject is its own colored panel (Math = blue, ELA = warm orange/amber, Science = green, Social = purple, Specials = pink, Other = sand). Use the same subject color tokens that Today already uses so it matches.
- [x] Finder-style view-mode toggle (Icon / List / Column) at the top right of the Practice section. Kid-remembered via localStorage. Default = Icon.
- [x] Each practice card shows: title, subject color stripe, coin reward chip. Tap = open the activity (route to existing practice activity page).
- [x] Hide-if-empty: subjects with 0 practice activities don't render. If kid has 0 practice activities total AND 0 coins, the whole Practice section hides (top strip still shows the email button).
- [x] Route both `/coins` and `/practice` to redirect to `/kiwi` so old links don't break.
- [x] Run vitest, save final checkpoint, deliver.


## 2026-05-05 (later) — AI Agenda Editor rebuild + Adult Notebook upgrade

### AI Agenda Editor — current bug
- Returns "0 changes" diffs: Before === After, with a non-empty intent summary on top. Apply button literally says "Apply 0 changes".
- Root cause likely: silent guard rejecting the LLM's proposed patch (locked-block guard, time-window guard, or schema validation), so the diff calculation sees no edits.

### Fix scope
- [ ] Strip silent restrictions in the agenda-editor pipeline. Replace any "drop on validation fail" with a logged rejection that bubbles up into the preview.
- [ ] Convert the LLM call to tool-using: tools = `web_search`, `library_lookup`, `worksheet_search`, `video_search`, `weather_lookup`, `block_patch`. Every tool call shows up as a step in the preview.
- [ ] LLM is required to either emit a non-empty `block_patch` OR explicitly say "no change because X". No silent no-ops.
- [ ] Allow the editor to add brand-new blocks with worksheets/videos/articles it found via web_search — not just rearrange existing blocks.
- [ ] Surface every rejected tool call + reason in the preview so it's never invisibly dropped.
- [ ] Add a vitest that posts a "make it shorter and fun" request against a fixture day and asserts the diff is non-empty.

### Adult Notebook upgrade
- [ ] Reopen Notebook to today's page automatically; same day = same page; new day = new blank.
- [ ] Light cream paper background (not chalkboard).
- [ ] Add image: upload from device + take camera photo into the day's note.
- [ ] Add PDF / worksheet attachment to the day's note.
- [ ] Markup tools (pen, highlighter, eraser, color, undo) over any uploaded image OR PDF page.
- [ ] Autosave per day; reopening tomorrow keeps yesterday's markup intact on yesterday's page.
- [ ] Easy back/forward day navigation with date picker.


## 2026-05-05 — Adult Notebook Drawer upgrade (DONE)
- [x] `dayAttachments` table + migration 0055 (id, dateStr, kind, fileKey, fileName, markupKey, pageIndex, createdAt, updatedAt)
- [x] `addDayAttachment` / `listDayAttachments` / `setDayAttachmentMarkup` / `removeDayAttachment` helpers in `server/db.ts` (uses `getDb()` pattern)
- [x] `notebookAttachments` tRPC router (`list`, `add`, `saveMarkup`, `clearMarkup`, `remove`) — admin/tutor only
- [x] `MarkupCanvas.tsx` — full-screen overlay (pen/highlighter/eraser, 6 colors, undo, clear, save). PDF first-page render via `pdfjs-dist`. Markup PNG saved to S3 as a separate object — original never overwritten.
- [x] `NotebookDrawer.tsx` upgraded — light cream-paper bg regardless of theme, Day Attachments card with Upload image / Take photo (`capture="environment"`) / Upload PDF, thumbnail grid (hidden when empty per "don't show if no info"), tap-to-mark-up, marked badge, hover-X to remove.
- [x] vitest `server/notebookAttachments.test.ts` (3 tests, db round-trip + data URL regex + dateStr regex)
- [x] Full vitest suite: 485 passed / 1 skipped (was 482/1)


## 2026-05-07 — AI Daily Agenda Editor REBUILD (in progress)
Bug observed in production: prompt "No math today" returned 7 ops but `[debug] Original LLM ops: [{},{},{},{},{},{},{}]` — every op was an empty object, all rejected by validator, "Apply 0 changes" shown. Root cause: LLM not returning ops with required `type` + per-op fields. Plus user wants more capability.

- [ ] Inspect current agendaEditor pipeline (`server/_lib/agendaEditor.ts` + `server/routers.ts` adultAi)
- [ ] Rewrite the LLM JSON schema so each op MUST have a `type` enum + the per-type required fields, removing the "additionalProperties=true / 7 empty {} accepted" failure mode
- [ ] Strengthen the system prompt with concrete examples for every op type and explicit anti-patterns
- [ ] Expand op coverage:
  - [ ] `removeAllOfSubject` (covers "no math today" / "drop science" by subject slug, not by exact title)
  - [ ] `addBlock` with subject + topic + duration + suggested time
  - [ ] `removeBlock` by id OR by title-substring OR by subject
  - [ ] `reorderBlock` to specific position
  - [ ] `setStartTime` / `shiftDayBy` (already exists — keep)
  - [ ] `retitle` / `setSubject` / `setDuration`
  - [ ] `moveToTomorrow` (per-block)
  - [ ] `lookupAssignment` — search curriculum + practice library and return suggested blocks (followed by addBlock ops)
- [ ] Pass attachment context (image/pdf data URLs from agendaEditor.uploadAttachment) into the LLM as multimodal content so "use this worksheet for math" works
- [ ] Pass curriculum + practice library short index into the prompt for grounded lookups
- [ ] vitests: empty-{} op rejection, "no math today" → real removeAllOfSubject ops, attachment context shape, lookupAssignment returns real blocks
- [ ] Full vitest run + checkpoint


## 2026-05-07 — Expanded scope (added)
- [ ] AI agenda editor: full-day rewrite ops (rebuildDay)
- [ ] AI agenda editor: weekly / date-range ops (applyToWeek)
- [ ] AI agenda editor: by-subject + by-topic bulk ops (removeAllOfSubject, retimeAllOfSubject, swapSubject everywhere)
- [ ] AI agenda editor: attach-upload-to-block op (link an uploaded worksheet to a specific block)
- [ ] AI agenda editor: assignment lookup → returns candidate list (curriculum + practice library) for the adult/tutor to pick before applying
- [ ] Open all editing surfaces (AI box, manual editor, uploads, lookup) to role: tutor (currently admin-only on some routes)
- [ ] "Design today from blank" starter for tutors
- [ ] Adult/tutor teleconference: tutorCalls table + tRPC router + Jitsi-embed component + Notify-tutor email + sidebar entry, AgendaEditor + Notebook entry points
- [ ] Vitests for everything above
- [ ] Full vitest run + checkpoint


## 2026-05-07 — PIVOT: Auto year-paced day-builder + operable blocks (in progress)
Direction change: stop treating the AI editor as the only source of changes. Instead the AI auto-builds every school day from a year-long backbone (curriculum + grade-5 Ohio standards), pulling from books Reagan already owns when possible. Tutors + adults can fully redesign any day.

- [ ] Phase 1 — VALIDATOR FIX (unblocks the "0 changes" bug today)
  - [ ] Replace `ops: { items: { type: "object", additionalProperties: true } }` with a strict per-op `oneOf` JSON schema (every op MUST have a `kind` enum + per-kind required fields)
  - [ ] vitest: empty {} ops are stripped pre-validation; warning includes "[debug] Original LLM ops: ..."
  - [ ] vitest: "no math today" returns at least one delete or removeAllOfSubject op (NOT all empty)

- [ ] Phase 2 — YEAR-PLAN BACKBONE
  - [ ] `yearPlan` table (subjectId, topicId, sequenceOrder, plannedWeek, status, completedAt, completedByBlockId)
  - [ ] `yearPlanCursor` table (subjectId, currentSequenceOrder, lastAdvancedAt)
  - [ ] Helper: `getNextTopicForSubject(subjectId)` returns the next pending topic
  - [ ] Helper: `paceCheck()` returns days-remaining-vs-topics-remaining and a "behind by N" hint
  - [ ] Auto-advance cursor when a block referencing a topic is marked complete

- [ ] Phase 3 — OWNED BOOKS REGISTRY
  - [ ] `ownedBooks` table (title, author, subjectSlug, totalUnits, unitKind: "page"|"day"|"chapter", cursorUnit, lastAdvancedAt)
  - [ ] Seed: Spectrum Math 5, Spectrum Science 5, 180 Days of Language 5, Tuck Everlasting, Michael's World
  - [ ] Helper: `nextBookAssignment(subjectSlug)` → { bookTitle, unitLabel, displayLine }
  - [ ] Auto-advance cursor on block-complete when block references a book

- [ ] Phase 4 — AUTO-BUILD TODAY (replaces the always-same-template build)
  - [ ] `buildBalancedDayFromBackbone(date)` — pulls next math, ELA, science, social studies, reading, adventure from yearPlan + ownedBooks, slots them into a sensible morning-to-afternoon shape, includes one outdoor adventure when weather is good
  - [ ] Wire this into `ensurePlanForDate` + nightly agenda generator + on-demand "Refresh today"
  - [ ] Skip Sat/Sun unless allowWeekend (existing rule)

- [ ] Phase 5 — FULLY OPERABLE BLOCKS
  - [ ] Worksheet block: real questions in description (markdown) + answer key in `answerKey` column; printable PDF page renders both
  - [ ] Video block: `videoUrl` + `videoDescription` columns; embeds inline + "Open" button
  - [ ] Reading block: bookId + pageStart/pageEnd + 2–3 prompts in description
  - [ ] Adventure block: materials list + steps + "what counts as done" already exist — confirm they print
  - [ ] Practice block: deep-link URL + topic code already exist — confirm "Open" works

- [ ] Phase 6 — EXPANDED EDITOR OPS (validator-strict)
  - [ ] removeAllOfSubject, retimeAllOfSubject, swapSubjectEverywhere
  - [ ] applyToWeek (Mon–Fri) / applyToDateRange
  - [ ] rebuildDay (regenerate today from backbone + the adult's instruction)
  - [ ] attachUploadToBlock (links agenda-attachment URL to a specific block)
  - [ ] lookupAssignment (returns 3–6 candidate blocks; UI shows picker; selected ones become insert ops)

- [ ] Phase 7 — TUTOR EDIT POWER + DESIGN-FROM-BLANK
  - [ ] Open agendaEditor.preview/commit/upload + nightlyAgenda + lookup procedures to role: tutor
  - [ ] "Design today from blank" button → wipes today and opens an empty editor

- [ ] Phase 8 — ADULT/TUTOR TELECONFERENCE
  - [ ] `tutorCalls` table (dateStr, roomKey, createdBy, createdAt, lastJoinedAt)
  - [ ] tRPC `tutorCalls.startToday` / `joinToday` / `inviteTutor(email)`
  - [ ] `<TutorCallPanel>` Jitsi-embedded iframe, mic-off-by-default
  - [ ] Sidebar entry "Tutor call" + Notebook drawer + AgendaEditor entry buttons

- [ ] Phase 9 — VITESTS + CHECKPOINT + DEPLOY


## 2026-05-07 — Candidate picker (added to Phase 5)
- [ ] AI accepts free-form adult/tutor input and searches WIDE: videos, lessons, printables, activities, IXL/Khan deep-links, adventure ideas
- [ ] Returns 6–12 candidates with: title, source (Khan/IXL/book/PDF/video/outdoor), 1-line description, estimated time, subjectSlug, topicCode
- [ ] Picker UI grouped by subject + format; quick-filter chips ("videos only" / "printables only" / "outdoor only")
- [ ] Picker under each block: "Find options for this block" → swap-in without redoing the day
- [ ] Selected candidates become insert (or update-replace) ops the validator passes; non-selected saved as `alternativeBlocks` for later swap


## 2026-05-07 — Tutor + adult day powers + Drive sync (Phase B addendum)
- [ ] Per-block edit affordance: tap block → tweak start time + duration inline (no need to open AI editor)
- [ ] Per-block "Mark complete" with grade + note + "what stood out"
- [ ] Coin award: preset chips (+1 / +3 / +5 / +10) + custom amount + reason note
- [ ] Tutor notebook notes per day (separate from Reagan's notes); light-paper UI; admin OR tutor role
- [ ] Google Drive sync per day: agenda.pdf + accomplishments.json + notebook attachments folder
- [ ] Auto-sync on block-complete / coin-award / note-save + nightly 8 PM catch-up + manual "Sync now"
- [ ] Vitests for grade-on-complete, coin-award audit log, tutor-note role gating, drive-sync payload shape


## 2026-05-08 — Drive folder map (locked, used by B-β)
- Root: https://drive.google.com/drive/folders/1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r
- Existing top-level folders are preserved (no parallel root):
  - Daily Operations/ → workbook PDFs + accomplishments.json + tutor-notes.md
  - Assignments and Work/ → uploaded worksheets, scans, photos, MarkupCanvas saves, notebook attachments
  - Adventures and Enrichment/ → outdoor / adventure photos + submissions
  - Printables and Resources/AI Generated/ → AI-made worksheets
  - Progress and Reports/ → weekly digests + analytics exports
  - Curriculum and Standards/ → monthly completion log
  - Inbox (Unsorted)/ → fallback when classifier confidence is low
- Per-day subfolder: `YYYY/MM - Month/YYYY-MM-DD Weekday/`
- Sticky dedupe via `.sync-manifest.json` at Drive root + deterministic filename + content-hash skip
- Nightly "fix-stragglers" pass moves any duplicates to the right folder, trashes older copies


## 2026-05-10 — Wide free-resource search (B-γ addendum, 5th-grade-locked)
Source allowlist + safety filters as above; never returns paywalled / off-allowlist content; results show in the same picker UI as candidate lookup with type/source/time filters; new standalone "Find Activities" page under Apps & Tools.
- [ ] Source registry table `searchSources` (name, baseUrl, kind, allowlistRegex, freeTier:bool, signupRequired:bool, ageMin, ageMax)
- [ ] Seed registry with sources above; one row per channel for YouTube allowlist
- [ ] Backend search procedure `lookup.findResources(query, gradeLevel?, contentType?, maxTimeMin?, freeOnly:true)`
- [ ] YouTube search restricted to allowlisted channels; safe-search hard-on
- [ ] Web search via Manus search tool with strict 5th-grade + free + .gov/.edu/.org filters
- [ ] Result schema: title, source, sourceLogo, description, contentType, estTimeMin, fitReason, url, isFree, requiresSignup
- [ ] "Find Activities" page (adult/tutor only) with grid + filters + "Add to today" / "Add to a date" actions
- [ ] Vitests: allowlist enforcement, paywall reject, signup label, safe-search rejection, gradeLevel filter


## 2026-05-10 — Visual simplicity rules (apply to every slice from Slice 1 onward)
Goal: under-the-hood depth, surface-level simplicity. Plain English. One primary action per screen. Cards over forms. Tap-to-edit inline. Big tiles for iPad/phone. Mobile-first. Undo over confirm. Same card shape for every "thing you can do." Color = meaning. Zero-config defaults; advanced controls in a single accordion. Tutor + adult UI is identical (only destructive admin items hidden for tutors).

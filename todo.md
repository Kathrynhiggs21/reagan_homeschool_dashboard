# Reagan's Homeschool Dashboard — TODO

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
- [ ] Struggle button opens a gentle dialog (intensity yellow/red, what helped, did it pass) instead of always logging yellow
- [ ] Whisper joy drops: jokes endpoint + funny-animal-video endpoint + carrot/song hooks
- [ ] Whisper end-of-day "you did great" recap procedure
- [ ] Knowledge ingestion sync button (Gmail + Drive scan via MCP) + manual paste fallback
- [ ] Email digest to spear.cpt + marcy.spear via notifyOwner on red zone or 3+ struggles in a week
- [ ] Print PDF packet (today + week) using weasyprint
- [ ] Tutor handoff "Print packet" + "Email Grandma" buttons wired
- [ ] Final vitest tests for joy, struggle, knowledge, recap procedures

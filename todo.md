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
- [ ] Collapse to 5 subjects: Math / Science / Social Studies / ELA / Specials (+ Other fallback)
- [ ] Pick vibrant palette: Math orange, Science green, SocStudies purple, ELA coral, Specials teal, Other gold
- [ ] Update `subjectColors.ts` palette + accent border 8px, stronger background tint
- [ ] Update Subject Color Key to exactly 5+1 entries
- [ ] DB remap: merge History/Geography → social; Reading/Writing/Spelling/Grammar → ela; Music/Art/PE/Health → specials
- [ ] Remap blocks, skills, skillsMastery, adventures, weeklyTopics to new 5-subject slugs
- [ ] Smoke-test tints on Today/Week/Curriculum/Adventures/Bookshelf

## 📚 Historical grade import (Round 4b-ii — blocked on user export)
- [ ] Extend `academicRecords` schema: grade (K/1/2/3/4/5), schoolYear (e.g., 2023-24), term (Q1/Q2/S1/YR), teacher, courseName
- [ ] Per-subject rolling GPA helper reads schoolYear filter
- [ ] Academic Record UI: timeline grouped by schoolYear → course → term → assignment
- [ ] CSV uploader (PowerSchool / Canvas) — file upload, extract via LLM
- [ ] PDF/screenshot uploader — vision OCR → structured rows
- [ ] Bulk-insert pipeline with dedupe (by schoolYear+course+term+title hash)
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

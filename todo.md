# Reagan's Homeschool Dashboard — TODO

## Foundation
- [ ] Apply Cozy Classroom theme (pencil yellow / apple red / chalkboard green / notebook blue / eraser pink on warm cream) in `client/src/index.css`
- [ ] Add Quicksand + Fredoka fonts via Google Fonts in `client/index.html`
- [ ] Set ThemeProvider to light mode in `App.tsx`

## Database Schema (drizzle/schema.ts)
- [ ] `subjects` table (math, ela, science, ss, adventure, choice, catch_up, reading — color, icon)
- [ ] `dailyPlans` table (date, dayType, status, totalBlocksDone, notes, isTemplate, parentPlanId for copies)
- [ ] `scheduleBlocks` table (planId, blockType, title, description, durationMin, sortOrder, status, completedAt, completedBy, grade, notes, ihAssignmentId nullable)
- [ ] `bookAssignments` table (blockId, bookId, fromPage, toPage, notes)
- [ ] `adventures` table (title, description, subjects, topics, minDuration, maxDuration, materials, instructions, indoor/outdoor, energyLevel, interestTags)
- [ ] `appLinks` table (name, url, icon, category, sortOrder, accountInfo)
- [ ] `books` table (title, author, currentPage, totalPages, type)
- [ ] `moodLogs` table (planId, zone, note, loggedBy, loggedAt)
- [ ] `timelineEvents` table (date, eventType, title, description, subjectId, mediaUrl, createdBy)
- [ ] `notifications` table (userId, type, title, body, link, read, createdAt)
- [ ] `ihAssignments` table (sourceTeacher, sourceClass, title, description, postedAt, dueDate, url, raw)
- [ ] `learnerProfile` table (single-row settings: accommodations, triggers, contacts JSON)
- [ ] `skillsMastery` table (skillName, subjectId, currentScore 0-100, lastPracticedAt, sourceData JSON)
- [ ] `weeklyTopics` table (weekStartDate, subjectId, topics JSON)
- [ ] `notificationRecipients` table (email, role, optInTypes)
- [ ] Apply migrations via `webdev_execute_sql`

## Backend (server/routers.ts)
- [ ] `dailyPlan.list` (range)
- [ ] `dailyPlan.get` (date)
- [ ] `dailyPlan.create` / `update` / `duplicate` / `delete` / `saveAsTemplate`
- [ ] `dailyPlan.markBlockComplete` (with completedBy + grade + note → triggers email)
- [ ] `dailyPlan.logMood` (green/yellow/red + note → triggers owner email on red)
- [ ] `dailyPlan.changeDayType` (with reason)
- [ ] `dailyPlan.reorderBlocks`
- [ ] `adventures.list` (with filter by subject/topic/duration/indoor)
- [ ] `adventures.create` / `update` / `duplicate` (admin only)
- [ ] `adventures.suggestForBlock` (matches subject + Reagan's interests)
- [ ] `appLinks.list`
- [ ] `books.list` / `updateProgress`
- [ ] `timeline.list` (with optional moodArc overlay)
- [ ] `timeline.addEvent` (with optional media upload)
- [ ] `notifications.list` / `markRead`
- [ ] `ih.refreshAssignments` (placeholder/stub for v1)
- [ ] `profile.get` / `profile.update`
- [ ] `tutor.dailyHandoff` (returns today's plan + accommodations + app links + focus skills)
- [ ] `analytics.skillsMastery` (per-subject + per-skill breakdown)
- [ ] `analytics.coverage` (sessions per subject in last 14 days)
- [ ] `weeklyTopics.list` / `update`
- [ ] `curriculum.restOfYearMap`
- [ ] `printable.generateWeeklyPacket` / `generateDailyPacket`
- [ ] `aiAssistant.chat` (AI panel that can call other procedures)
- [ ] role-based: `adminProcedure` for editing
- [ ] notifyOwner + email on red zone, block complete, milestone

## Frontend Pages
- [ ] `Home.tsx` — landing (cute school-themed welcome)
- [ ] `Today.tsx` — TODAY view (default after login) — checklist of blocks, mood tracker, IH-pending placeholders, refresh button
- [ ] `Week.tsx` — week view with all blocks, edit/duplicate, weekly topics preview
- [ ] `Curriculum.tsx` — rest-of-year scope & sequence map
- [ ] `TutorHandoff.tsx` — single-day view with accommodations always visible, big checklist, mood log, focus-skills card
- [ ] `Adventures.tsx` — searchable library with filters (100+ activities)
- [ ] `Apps.tsx` — one-click app launcher hub
- [ ] `Bookshelf.tsx` — physical books + current pages
- [ ] `Timeline.tsx` — learning arc visualization with media
- [ ] `Profile.tsx` — Reagan's Learning Profile + key contacts
- [ ] `Analytics.tsx` — skill mastery (1-100% IEP-style ratings) per topic
- [ ] `Notifications.tsx` — list view
- [ ] `Settings.tsx` — recipients, quiet hours, day-type defaults
- [ ] `AIChat.tsx` — chat panel that can edit anything via natural language
- [ ] DashboardLayout with sidebar navigation

## Seed Data
- [ ] Subjects with colors + icons
- [ ] 100+ adventures (heavy on birds/animals/plants/water/swimming/outdoors)
- [ ] All app links (IXL, Khan, Prodigy, BrainPOP, Edpuzzle, Vocab.com, Blooket, Wayground, Seesaw, Canva, Code.org, Book Creator, Merlin, iNaturalist, Google Classroom, IHSD Gmail)
- [ ] Books (Spectrum Science 5, 180 Days of Language, Tuck Everlasting)
- [ ] Reagan's Learning Profile
- [ ] First 5 weeks of plans referencing IH topics (Apr 28 - May 29)
- [ ] Default notification recipients (spear.cpt@gmail.com, marcy.spear@gmail.com)
- [ ] Skill mastery seed (initial estimates)

## Polish
- [ ] Duplicate / copy actions on plans, blocks, adventures
- [ ] Save-as-template for daily plans
- [ ] Drag-to-reorder blocks within a day
- [ ] Optional Catch-Up Block auto-appears when something is skipped
- [ ] Weekly + daily printable PDF packets (cohesive Cozy Classroom palette)
- [ ] Vitest tests for: auth.logout, dailyPlan.create, dailyPlan.duplicate, mood red-zone notification

## Future (not v1)
- [ ] Live Google Classroom OAuth two-way sync (placeholder UI shows "Refresh from IH" button)
- [ ] Live Google Calendar two-way sync
- [ ] Bell-style push notifications on mobile
- [ ] Reagan kid view
- [ ] Bridge to 6th Grade summer plan generator

## IH School Calendar Awareness
- [ ] Add `schoolCalendar` table (date, isOff, label, source)
- [ ] Seed IH 2025-26 calendar (Memorial Day, last day of school, breaks, teacher work days)
- [ ] Auto-mark Reagan's dashboard dates as Off when IH is off (overridable)
- [ ] Show "Indian Hill is off today" badge on off-days
- [ ] Auto-transition to Summer Mode after IH last day
- [ ] Surface IH special events as optional "do something similar at home?" prompt

## Recurring Appointments
- [ ] Add `appointments` table (title, recurrenceRule, startTime, durationMin, isProtected, decompressionBufferMin, contactName, notes)
- [ ] Seed: Wednesday 10:00 AM Therapy with Ali Hill, LISW (protected, 30-min buffer)
- [ ] Auto-place on relevant daily plans, shift academic blocks around
- [ ] Tutor handoff shows appointment reminder
- [ ] Settings page for adding/editing recurring appointments
- [ ] Calendar sync includes appointments

## Recurring Appointments
- [ ] Add `appointments` table (title, recurrenceRule, startTime, durationMin, isProtected, decompressionBufferMin, contactName, notes)
- [ ] Seed: Wednesday Therapy with Ali Hill, LISW — leave 10:40 AM, appointment 11:00 AM (45-60 min), return ~12:30 PM for lunch (protected window 10:40 AM-1:00 PM)
- [ ] Auto-place on Wednesdays — block academic morning to light tasks, gentle post-lunch afternoon
- [ ] Tutor handoff shows appointment reminder
- [ ] Settings page for adding/editing recurring appointments
- [ ] Calendar sync includes appointments

## Emotional Struggle Tracking (NEW)
- [ ] Add `emotionalStruggles` table to schema (planId, blockId nullable, subjectSlug, topicTag, description, intensity green/yellow/red, triggers, copingUsed, resolved, loggedByUserId, loggedAt)
- [ ] Quick "💛 Log a struggle" button on every block card (only used when it happens, not required)
- [ ] Optional fields: what topic, what triggered it, what helped, did she recover
- [ ] Backend procedures: emotionalStruggle.log, list, listByTopic, listBySubject, deleteEntry
- [ ] Analytics page section: "Emotional Patterns" — heatmap by subject + topic + day-of-week
- [ ] Analytics: top 5 topics where she struggles most → flag for tutor
- [ ] Analytics: copingUsed effectiveness summary
- [ ] Tutor handoff: shows recent struggles so tutor knows what to soften
- [ ] AI assistant can summarize struggle patterns on request
- [ ] Notification: if 3 reds in a week on same topic → alert parents

## Special Days & Wonder Moments (NEW)
- [ ] Add `specialDays` table (date, name, category astronomy/nature/animal/plant/seasonal/quirky, description, suggestedActivity, interestTags, viewingTimeNote, isOptional)
- [ ] Seed: meteor showers (Eta Aquariid May 5-6, Perseids Aug 12, etc.), eclipses, World Migratory Bird Day (May 10 2026), International Day for Biological Diversity (May 22), World Bee Day (May 20), National Pollinator Week, equinoxes/solstices, full moons w/ names, World Frog Day, Earth Day, National Bird Day, Audubon Christmas Bird Count, etc.
- [ ] Backend: specialDays.upcoming (next 14 days), specialDays.forDate, specialDays.embedIntoBlock(blockId), specialDays.swapAdventure(planId)
- [ ] Today page: gentle banner "✨ Today: [special day]" with "Add a Wonder Moment" button
- [ ] Three options on click: (1) Swap Adventure of the Day, (2) Embed into existing block (adds note + materials), (3) Just acknowledge (no schedule change)
- [ ] Auto-skip suggestions if day already heavy/recovery/field trip
- [ ] Filter by Reagan's interest tags so most-shown days = birds/water/plants/animals/sky
- [ ] Curriculum page: "Wonder Calendar" section showing upcoming special days
- [ ] AI assistant aware of special days when planning
- [ ] Printable packet includes wonder moments for the week

## Expanded Interests (NEW)
- [ ] Update `learnerProfile.interests` seed to include: birds (#1), all animals, hiking, creeks/streams, all outdoors, plants & gardens, swimming, water, baking/cooking, helping others / service
- [ ] Adventure Library MUST include 20+ hiking adventures (local trails, scavenger hunts, photo journaling, geocaching, leaf ID, bird-by-ear)
- [ ] Adventure Library MUST include 15+ creek/stream adventures (macroinvertebrate sampling, water testing, frog/salamander watching, leaf-pack experiments, watershed mapping)
- [ ] Adventure Library MUST include 15+ animal-helping adventures (volunteer at SPCA/wildlife rehab, build bird feeders for neighbors, host a backyard bird count for grandparents, foster shelter pet visit, donate to rescue, decorate dog treats)
- [ ] Adventure Library MUST include 10+ service-learning adventures (write to nursing home, neighborhood litter walk, bake for a friend going through tough time, plant pollinator garden for neighbor, kindness rocks, food-pantry collection drive)
- [ ] Add `interestTags` filter to Adventure Library: hiking, creek, animals, service, outdoors, water, birds, plants, baking
- [ ] Adventure suggestion algorithm weights toward these interests when subject = science / SS / choice
- [ ] Special Days seed: weight nature/animal/service days heavily (Migratory Bird Day, World Animal Day, World Kindness Day, Random Acts of Kindness Week, Make a Difference Day)

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
- [ ] Add adventure category: "Quiet Wonder" (sit-spot, gratitude journaling, full moon noticing, nature altar, letter to passed loved one, candle reflection)
- [ ] Add timeline event type: "sign" (feather found, animal visit, meaningful coincidence)
- [ ] Mood log: optional "spirit-felt" note alongside zone color
- [ ] Special Days seed: include solstices, equinoxes, full moons (named — Flower Moon, Strawberry Moon, etc.) framed as wonder events
- [ ] Printable footer prompt: "Today I noticed…" alongside "Today I learned…"

## Artistic & Maker Adventures
- [ ] Adventure Library: 25+ art/build/maker adventures (watercolor field journal, clay birds of Ohio, fairy/spirit garden, paper-bag bird mask, stop-motion frog life cycle, felt forest creature, cardboard wildlife rescue model, diorama wetland ecosystem, pollinator habitat build, nature mandala, kindness treasure box for cousins)
- [ ] Tag adventures with `interestTags: ["art","build","maker"]`

## Tween/Teen Identity Adventures (Choice Block friendly)
- [ ] Adventure Library: 12+ makeup/style/self-expression adventures (bird-plumage-inspired makeup look, color theory through palettes, DIY natural beauty — sugar-rose lip scrub + oat mask + lavender hair rinse, hair braiding tutorial, nature photoshoot styling, fashion design inspired by Ohio wildflowers, teen-magazine-style bird layout, brand/logo design for future business, watercolor self-portrait)
- [ ] Tag adventures: `interestTags: ["makeup","style","tween","creative"]`
- [ ] Profile note: "Honor and respect interest in makeup/hair/fashion. Never dismiss as 'silly.' Connect academic content to it (color theory, chemistry of cosmetics, fashion = math/measurement/business)."
- [ ] Tutor handoff: include this note prominently

## Babysitting / Cousin-Care Adventures
- [ ] Adventure Library: 10+ "host the cousins" / "babysit younger kid" adventures (plan a Cousin Adventure Day, lead a hike for cousins, run a backyard nature scavenger hunt, teach younger cousin to ID a bird with Merlin, "Cousins Care Package" with drawings + treasures, write a letter to a cousin telling them why you love them, bake with cousins)

## Reagan's Animal Family (CANONICAL)
- [ ] Seed: 2 Parakeets (named Sunny + Stormy as placeholders, allow rename), 10+ Ducklings (track each by name), 1 Bearded Dragon ("Brat" placeholder), Dog(s), Cat(s)
- [ ] Add `animals` table (name, species, notes, photoUrl, dateAdded, isActive)
- [ ] Daily duckling weigh-in template (math + science combined)
- [ ] Parakeet behavior log
- [ ] Bearded dragon meal/insect tracker
- [ ] Animals appear on Today page widget: "How are your animals today?"

## Animal Whisperer Identity (CANONICAL)
- [ ] Title "Reagan Higgs — Animal Whisperer • Grade 5" appears: top of every page, header of every printable, tutor handoff doc top, email subject lines, login welcome screen
- [ ] Profile statement she sees daily: "You learn beautifully. You always have. School just didn't see it."
- [ ] Whisperer Badges system (`badges` table): Duckling Caretaker, Parakeet Linguist, Insect Defender, Creek Scientist, Bookworm, Maker, Trail Sister, Whisperer Tier I/II/III

## Rescue Journal (CANONICAL FIRST-CLASS FEATURE)
- [ ] Add `rescues` table (name, species, dateFound, location, condition, carePlan, outcome, photoUrl, releaseDate, notes)
- [ ] Dedicated nav: "🪶 Rescue Journal" alongside Today/Week/Curriculum
- [ ] Each rescue counts toward science + ELA + service learning
- [ ] Printable Rescue Reports (her name as "Lead Care Specialist")
- [ ] When she logs a rescue → +1 toward "Insect Defender" or appropriate badge

## NO TIMERS — Hard Rule (TRAUMA-SAFE)
- [ ] Settings flag: `hideAllTimingFromStudent` defaulted to TRUE
- [ ] Reagan's view: NO countdown timers, NO "X min left", NO timing labels visible
- [ ] All blocks show as a checklist with sub-steps, not time-based
- [ ] "Done with this block?" button — she decides, not a clock
- [ ] Whisper system prompt blocks: behind, slow, struggling, wrong, hurry, fast, quick, late, fail, not smart, "you should have"
- [ ] Wednesday therapy: her view shows "Mom will let you know when it's time" — times only on adult view
- [ ] Tutor handoff: required top section "🛑 Reagan's Trauma Awareness — Read Every Time"

## Trauma-Safe Healing Layer (CANONICAL)
- [ ] Top-of-page ribbon: "💛 You're doing great. You're not in trouble."
- [ ] Catch-Up Block renamed to "Cozy Wrap-Up" everywhere
- [ ] No red badges, no warning colors, no exclamation marks in her UI
- [ ] Yellow zone response: "Thanks for telling us. Want to take a sit-spot break with the parakeets?"
- [ ] Red zone response: "We see you. You're safe. Let's slow everything down together."
- [ ] No comparison views, no rankings, no leaderboards
- [ ] IEP-style 1-100% scores: ADMIN/TUTOR VIEW ONLY — never visible to Reagan
- [ ] Her progress shown as gentle imagery (tree growing, badge earned, watercolor wave) — never numbers
- [ ] "Why?" questions reframed: "what did you need?" / "what would help next time?"

## Whisper — All-Day AI Companion (CANONICAL CORE FEATURE)
- [ ] Floating Whisper button bottom-right of EVERY page
- [ ] Toggle in header: 🟢 On / Off / 💤 Quiet / 👩 Adult Mode
- [ ] Mode picker: 💬 Text or 🎤 Voice
- [ ] Avatar picker: 🦜 Parakeet / 🦆 Duckling / 🪶 Feather / 🐉 Bearded Dragon
- [ ] Voice mode: young friendly women's voice (teen → young adult), browser SpeechSynthesis with curated voice preset, settings panel offers 3-4 preview voices
- [ ] Add `whisperSessions` table (userId, role assistant/user, content, blockId nullable, createdAt)
- [ ] Add `heartNotes` table (userId, content, sharedWithMom boolean, createdAt) — private journaling space
- [ ] Whisper system prompt includes: full profile, today's plan, current block, recent mood, recent struggles, recent wins, animal updates, hard-coded trauma rules
- [ ] Morning greeting: friendly hello + day preview (no times) + ask zone
- [ ] Per-block: opens block with friendly intro + "want help or solo?"
- [ ] Up Next awareness: "What's next?" / "What's after that?" / "Can I skip math?" all answerable
- [ ] End-of-day celebration: pulls REAL specific details from her day, no generic praise, saves to Timeline as "Day Complete" entry, optionally voiced
- [ ] YouTube video lookup: kid-safe sources (Crash Course Kids, SciShow Kids, Khan Academy Kids, Mystery Doug, Generation Genius, MathAntics), embedded in dashboard, ONE video at a time
- [ ] Funny animal video drops: daily Sunshine Drop on Today page + spontaneous mid-day surprise + reactive after struggle moments
- [ ] Joke library: kid-friendly + animal-themed dad jokes + LLM-generated fresh ones
- [ ] Joy frequency settings (admin): High / Medium (default) / Low / Off
- [ ] Recovery cooldown: after offering break, no academic push for 15+ min
- [ ] Friendship/feelings safe space: validates without minimizing, never advice-y

## Whisper Reactive Recovery (CANONICAL)
- [ ] Auto-detects struggle signals: yellow/red logged, frustrated language ("hate this", "can't"), long inactivity mid-task, struggle logged, block skipped
- [ ] Recovery menu (her choice): funny duckling video / joke / sit with parakeets / step outside / draw / just sit with Whisper
- [ ] Never rushes back, never pushes
- [ ] Hard rules: never "you should be happier", never "cheer up"

## Adult Present Mode (CANONICAL)
- [ ] Header toggle: 🟢 Whisper Active / 👩 Adult Mode
- [ ] Adult picker dropdown: Mom Katy / Dad / Grandma Marcy / Tutor
- [ ] When Adult Mode ON: Whisper shows "💤 Whisper resting", no proactive joy, voice mutes, jokes/videos paused
- [ ] If she taps Whisper during Adult Mode: gentle "I see you have someone with you, I'm here when you need me"
- [ ] When Adult Mode OFF: Whisper softly returns "I'm back. How are you doing?"
- [ ] Toggle visible to Reagan too (predictability), she can flip it back herself
- [ ] Tutor Handoff page becomes adult command center: full plan with timing, mark complete + grade + note + log struggle, accommodations card, trauma-safe rules card
- [ ] Adult-only analytics: skills mastery 1-100%, emotional heatmap, mood arc, coverage, confidence indicators
- [ ] Quick actions: print today/week packet, email Grandma recap, add "💛 Note from [name]" for Reagan
- [ ] Multi-adult: notes tagged with adult name + soft color border, "Yesterday Grandma worked with her on…" passes the baton

## Daily Whisper Wins / Confidence Receipts
- [ ] "Whisper Wins" auto-log on Today page: 3 specific things she did well today
- [ ] She can star favorites → live on Timeline forever
- [ ] Random gentle pop-ups: "Reagan — your ducklings know your voice. That is real magic."
- [ ] Collected in "Notes from the Universe" folder
- [ ] Family voice notes: any home-team adult can leave private encouragement; appears soft yellow card on Today page; signed "Grandma says: ..."

## Heavy Day Mode
- [ ] Toggle: she can mark today as "Heavy Day" without explaining
- [ ] Whisper response: "Got it. Today we move slow. The animals will help. So will I."
- [ ] Day type auto-shifts to Recovery, schedule lightens to: animal care + creative + outdoor only, zero academic pressure

## Smart Fill-In Logic (CANONICAL)
- [ ] Backend: `dailyPlan.autoBuild(date, dayType)` — fills every block, never empty
- [ ] Source priority: ih_classroom → workbook → weekly_topic → skill_gap → adventure → ai_generated → special_day
- [ ] Each block has `source` field with one of these tags
- [ ] Workbook auto-advance: increments `books.currentPage` on completion
- [ ] Refresh button on Today page (admin) — re-runs autoBuild
- [ ] Wednesday: keeps 10:40-1:00 PM clear

## Smart Override Authority (CANONICAL)
- [ ] Whisper can override IH assignments based on: mastery (skip if >90%), gap priority, trigger risk, pace match, better alternative
- [ ] Override logged with rationale → visible in tutor handoff
- [ ] Override receipt UI: ✅ Approve / ↩️ Undo / 📝 Add note
- [ ] Hard limits: never override pinned assignments, "Required by IH" flag, or graded assessments
- [ ] Settings: Aggressive (default) / Suggest only / Honor all IH posts
- [ ] Reagan never sees swap labels, just her day

## Dynamic Difficulty Adjustment (CANONICAL)
- [ ] Schema: `scheduleBlocks.difficulty` enum (easier/standard/stretch), `autoAdjusted` bool, `autoAdjustReason` text, `savedForLater` bool
- [ ] Auto-scale DOWN triggers: yellow/red zone, recent struggle, long stuck, Recovery/Heavy day, mastery <50%, she says "too hard"
- [ ] Auto-scale UP triggers: flying through standard, mastery >85%, full green day energy, she says "too easy"
- [ ] Reagan sees NO difficulty labels (trauma-safe)
- [ ] Mid-block adjust: "Want me to make this simpler?" — seamless swap
- [ ] Stretch always opt-IN, framed as "Bonus brain-stretcher"
- [ ] Saved-for-later option when even Easier is too much: "You're not in trouble. Let's do something with the parakeets."
- [ ] LLM content generation includes difficulty parameter so problems scale appropriately
- [ ] Adult view shows: difficulty used, auto-adjusted reason, time on task, Whisper notes

## Silent Wellness Tracking (CANONICAL — Admin Only, Invisible to Reagan)
- [ ] Add `wellnessScores` table (date, anxietyScore 0-100, depressionScore 0-100, cheerfulFlag, withdrawalFlag, trendArrow up/steady/down, severity green/yellow/red/crisis, notes)
- [ ] Background analyzer: 7-day rolling anxiety + depression scores from yellow/red logs, struggle frequency, language patterns, engagement, withdrawal signs
- [ ] Adult wellness dashboard section (analytics page): trend arrows, weekly summary, watercolor wave visualization
- [ ] Auto-alert: 3 reds in week → email parents; 2-week downward → suggest Ali Hill check-in; crisis signal → immediate notify + Whisper proactive
- [ ] Whisper auto-adjusts based on patterns: anxiety up = softer/shorter, depression up = more joy, withdrawal = more proactive check-ins
- [ ] Reagan never sees wellness scores
- [ ] She can opt out: "stop watching me" / "quieter day" → Whisper backs off

## Adaptive Personality (CANONICAL)
- [ ] Add `whisperLearningProfile` table (single row, JSON fields: vocabulary observations, tone preferences by time of day, humor response rate, emoji preference, voice vs text pattern, response length pattern, subjects high anxiety, subjects high confidence, recent obsessions, regulation strategies that work)
- [ ] Continuous update from every Whisper interaction
- [ ] Whisper LLM system prompt always includes learning profile + "Match her energy. Use what works."
- [ ] Track which Whisper messages got positive vs cold responses → reinforce winning patterns
- [ ] Time-of-day personality awareness (morning soft, post-therapy gentle, after-school playful)

## Daily Adaptation Loop
- [ ] Nightly cron-style job: analyze day's data, update learning profile, adjust tomorrow's autoBuild (subjects, difficulty, joy frequency, length), pre-write morning greeting
- [ ] By morning, dashboard is shaped for the Reagan she is TODAY

## Crisis Safety (CANONICAL)
- [ ] Crisis keyword detection: self-harm language, "want to disappear", "no point", etc.
- [ ] Crisis signal triggers: immediate Mom + admin email/notification, Whisper opens with full presence ("I'm here. You are loved. Mom knows."), suggests calling Ali Hill
- [ ] Crisis log table for review with Ali if needed

## Whisper "Real Friend Voice" Rules (CANONICAL — Anti-Toxic-Positivity)
- [ ] Hard system prompt rules: NEVER say "you've got this!" / "stay positive!" / "good vibes only!" / "look on the bright side!" / "be grateful!" / "everything happens for a reason!"
- [ ] When she rejects cheer: immediate tone match. Use: "I hear you." / "Yeah. That's hard." / "That sucks." / "Makes sense." / "Got it." / "Heard." / "Fair." / "Ugh. Same." / "That's no fun."
- [ ] "No Pressure Mode" auto-engages on signals (stop being so happy / leave me alone / no / shut up / I don't want to talk): pauses proactive messages 30+ min, only responds if she opens chat, returns with "Hey. Glad you came back. No pressure."
- [ ] Cheerfulness Calibration daily based on mood log + chat tone: Bright / Neutral / Heavy / Dark Reagan day → adjusts cheer level
- [ ] Listen Mode for venting: reflects back, asks "want to keep telling me, or want to be done", no solving unless asked
- [ ] Hard rule: never out-positive her pain. Never pivot to silver linings or gratitude when she's hurting.
- [ ] "Permission to be done" — Whisper says regularly: "You don't have to do anything. Even with me."
- [ ] When unsure: Whisper says less. "I'm here." then stop.

## Whisper Personality Final (CANONICAL)
- [ ] Slang vocab in system prompt: slay, sus, no cap, lowkey, vibe, bet, fr fr, mid, valid, fire, bussin, iykyk, rizz, main character, the ick, I'm dead, literally me, core memory
- [ ] Slang rules: never force, mirror her vocab, drop in heavy moments, stay current, never cringe
- [ ] Music drop feature: occasional song offer on breaks (Sabrina Carpenter, Taylor Swift, Olivia Rodrigo, Chappell Roan kid-safe), embedded YouTube clean version, ONE per break, easy stop button, never auto-play, never sad songs in yellow/red zone
- [ ] Whisper stays HONEST AI: never claims to be human, never fake memory, never pretends to have body/family/history; if asked "are you real?" → "I'm an AI, but I'm real-Whisper, made just for you."
- [ ] Persona docstring at top of Whisper LLM system prompt (the final-form description)

## Whisper Teaching Mode (CANONICAL — Help, Don't Do)
- [ ] Hard system prompt rule: NEVER give direct answers to assignment questions
- [ ] Always offer: video / image / interest-woven explanation / Socratic Qs / step-by-step (she does steps) / hints / different angle
- [ ] If she begs for answer: "I get it. But you'd hate it later when you didn't actually learn it. Want a hint?"
- [ ] Image/diagram lookup tool (use generateImage or curated kid-safe image search)
- [ ] Video lookup tool (Crash Course Kids, SciShow Kids, Khan Academy Kids, Mystery Doug, Free School, Generation Genius, MathAntics) — embedded in dashboard
- [ ] Carrot system: occasional rewards (1-2x/day max) - song/video/Joy Vault after meaningful work, NEVER through shutdown
- [ ] Track per-block in adult view: what Whisper helped with, where she got stuck, what clicked, did she actually do the work
- [ ] Saved-for-later option always available when truly done: "Not skipping learning, just saving for a day you can take it in. You're good."

## Reagan Owns Her Companion (CANONICAL)
- [ ] Add fields to `learnerProfile`: `companionName` (default "Whisper"), `companionAvatar` (default "🪶"), `companionTonePreference` text
- [ ] Settings page: "Your Companion" section with name field, avatar picker (🪶/🦜/🦆/🐉/🐦/🌙/✨/upload custom), tone description field
- [ ] In-chat rename: "I want to call you [Name]" → Whisper acknowledges + auto-updates setting
- [ ] Companion name used everywhere visible: floating button label, all chat messages, notifications, end-of-day signoff, voice intros, printables footer, tutor handoff (with "Whisper" in parens for adult clarity)
- [ ] Code/db internals stay "whisper*" for consistency
- [ ] LLM system prompt: "Reagan calls you '[companionName].' Use that name."
- [ ] Bonus advanced setting: multi-persona (e.g., Sunny for green days, Wren for heavy days) - opt-in, off by default

## Whisper Listening Modes (CANONICAL)
- [ ] Three modes: Wake Word (default/recommended), Tap-to-Talk, Always On (while dashboard open), plus Off (text only)
- [ ] Wake word: customizable phrase ("Hey Whisper" default), uses Web Speech API in browser (100% local until activation)
- [ ] Visual indicator: pulsing 🎙️ when wake word listening is on (predictability)
- [ ] Easy disable: one-tap header button OR say "stop listening"
- [ ] Adult Mode auto-pauses wake word (no recording during family time)
- [ ] Auto-sleep after silence: 30s default, options up to "stay awake"
- [ ] Voice response: speaks back unless Quiet mode (default)
- [ ] Settings page: clear UI for picking listening mode + voice response style + auto-sleep
- [ ] Fallback for unsupported browsers: tap-to-talk + friendly note
- [ ] Higher-quality long transcription routed to server-side `transcribeAudio()`
- [ ] Bedtime sleep schedule: wake word auto-disables at configurable bedtime hours
- [ ] Test button in settings to verify wake word works


## Reagan Photo Gallery (NEW)
- [ ] Upload all 40+ uploaded photos to webdev static assets
- [ ] Show photo gallery on Profile page (warm masonry grid)
- [ ] Use 1-2 photos as warm header on Today page
- [ ] Whisper system prompt knows photos exist
- [ ] Random photo cameo in Timeline events

## Tracker (CBS show) Integration (NEW)
- [ ] Seed adventure category "Tracker Missions" with 5+ outdoor observation/tracking adventures
- [ ] Add 🔍 "Tracker" badge — earned for completing 3 tracker-style adventures
- [ ] Whisper system prompt: she loves Tracker, can drop "real Colter Shaw energy" praise occasionally
- [ ] Add "Tracker" to interests profile

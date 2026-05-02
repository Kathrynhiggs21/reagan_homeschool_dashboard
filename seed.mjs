import mysql from "mysql2/promise";
const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: false });
console.log("Connected. Seeding Reagan's dashboard...");

async function ins(table, row) {
  const cols = Object.keys(row);
  const vals = Object.values(row);
  const ph = cols.map(() => "?").join(",");
  const sql = `INSERT INTO \`${table}\` (${cols.map(c=>`\`${c}\``).join(",")}) VALUES (${ph})`;
  try {
    const [r] = await conn.execute(sql, vals);
    return r.insertId;
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return null;
    throw e;
  }
}

async function clear(table) {
  await conn.execute(`DELETE FROM \`${table}\``);
}

/* ============================== PROFILE ================================== */
await clear("learnerProfile");
await ins("learnerProfile", {
  studentName: "Reagan Higgs",
  gradeLevel: "5",
  accommodations: JSON.stringify([
    "NEVER mention timing, timers, or how long things take",
    "Voice/draw/dictate alternatives for writing always",
    "Sit beside her, not across from her",
    "Catch her doing well 5x more often than correcting",
    "Always say out loud: 'You're not in trouble. You're doing great.'",
    "Use her title: The Animal Whisperer",
    "Math is her strength — let her feel brilliant",
    "Switch to animal care, art, or sit-spot if she shuts down",
  ]),
  triggers: JSON.stringify([
    "Being timed (stopwatches, countdowns, 'how long did this take?')",
    "Being told she's behind, slow, or struggling",
    "Feeling watched or judged",
    "Feeling like she did something wrong when she didn't",
    "Comparison to other kids",
    "Public attention / spotlight",
    "Visible clocks during work",
  ]),
  whatWorks: JSON.stringify([
    "Animals as the lens for any subject",
    "Math puzzles (her brilliance)",
    "Hands-on building & creating",
    "Choice and autonomy",
    "Whisper present but not pushing",
    "Funny duckling videos when she needs a break",
    "Time with parakeets / ducklings as a regulator",
    "Creek + hiking days",
    "Helping others, especially family + cousins",
    "Art + watercolor field journaling",
  ]),
  whatHarms: JSON.stringify([
    "Timed work",
    "Cheerful pushback when she's hurting",
    "Direct answers to homework (steals her learning)",
    "Forcing her back to task when she's dysregulated",
    "Empty praise without specifics",
    "Saying 'you've got this' or 'stay positive' when she's down",
    "Comparing her to peers or 'kids your age'",
  ]),
  contacts: JSON.stringify([
    { name: "Mom (Katy)", role: "parent", email: "spear.cpt@gmail.com" },
    { name: "Grandma Marcy", role: "grandparent", email: "marcy.spear@gmail.com" },
    { name: "Ali Hill, LISW", role: "therapist", phone: "(513) ---" },
    { name: "Mr. Froehlich", role: "IH teacher" },
    { name: "Mrs. Marlow", role: "IH teacher" },
    { name: "Mrs. Taylor", role: "IH teacher" },
    { name: "Mr. Wells", role: "IH teacher" },
  ]),
  interests: JSON.stringify([
    "🪶 Animal Whisperer — animal rescue is her core identity",
    "🦜 Parakeets (her 2 birds)",
    "🦆 Ducklings (her 10+)",
    "🐉 Bearded dragon",
    "🐕 Dogs", "🐈 Cats",
    "🥾 Hiking", "🌊 Creeks", "🌳 All outdoors",
    "💛 Helping family, cousins, animals, the planet",
    "🎨 Art, watercolor, drawing, building",
    "🧁 Baking",
    "💄 Makeup, hair, fashion (early teen identity)",
    "🪶 Spirit, signs, wonder, the unseen",
    "🔢 Math puzzles (her strength)",
    "📚 Read-aloud + audiobooks",
    "😂 Funny animal videos",
  ]),
  notes: "Reagan has been depressed and is finding her way back to cheerful at her own pace. Wants to be seen, loved, and safe in friendships without insecurity. Her companion is named Whisper by default; she can rename it anytime. Goal: ready and confident for 6th grade Fall 2026.",
});
console.log("✓ Profile seeded");

/* ============================== ANIMALS ================================== */
await clear("animals");
const animals = [
  { name: "Sky", species: "Parakeet", isActive: 1, sortOrder: 1, notes: "One of Reagan's two parakeets — her bird babies." },
  { name: "Sunshine", species: "Parakeet", isActive: 1, sortOrder: 2, notes: "The second parakeet. Named for her energy." },
  { name: "Brutus", species: "Bearded Dragon", isActive: 1, sortOrder: 3, notes: "Reagan's bearded dragon ('Brat's dragon')." },
  { name: "Family Dog", species: "Dog", isActive: 1, sortOrder: 4 },
  { name: "Family Cats", species: "Cat", isActive: 1, sortOrder: 5 },
  { name: "Ducklings (10+)", species: "Duckling", isActive: 1, sortOrder: 6, notes: "Her flock of 10+ ducklings — daily care, weighing, playing. Real-life biology lab." },
];
for (const a of animals) await ins("animals", a);
console.log("✓ Animals seeded");

/* ============================== SUBJECTS ================================= */
await clear("subjects");
const subjects = [
  { slug: "morning_warmup", name: "Morning Warm-Up", color: "#FFD580", emoji: "☀️", sortOrder: 1 },
  { slug: "math", name: "Math", color: "#A0D8EF", emoji: "🔢", sortOrder: 2 },
  { slug: "ela", name: "Reading & Writing", color: "#F4B4C0", emoji: "📚", sortOrder: 3 },
  { slug: "science", name: "Science", color: "#B5E3B7", emoji: "🔬", sortOrder: 4 },
  { slug: "social_studies", name: "Social Studies", color: "#D4A5E8", emoji: "🌍", sortOrder: 5 },
  { slug: "adventure", name: "Adventure of the Day", color: "#FFB892", emoji: "🪶", sortOrder: 6 },
  { slug: "read_aloud", name: "Read-Aloud", color: "#E8D5A0", emoji: "📖", sortOrder: 7 },
  { slug: "choice", name: "Choice Block", color: "#C5B0E0", emoji: "💖", sortOrder: 8 },
  { slug: "rescue", name: "Rescue & Animal Care", color: "#FFB8A0", emoji: "💛", sortOrder: 9 },
  { slug: "art", name: "Art & Making", color: "#F4B870", emoji: "🎨", sortOrder: 10 },
];
for (const s of subjects) await ins("subjects", s);
console.log("✓ Subjects seeded");

/* ============================== ADVENTURES (50+) ========================= */
await clear("adventures");
const adventures = [
  // Animal whisperer / rescue (core)
  { title: "Daily Duckling Weigh-In", description: "Weigh each duckling, log it, chart growth over time.", subjectSlugs:["math","science","rescue"], topicTags:["measurement","data","ducklings"], interestTags:["ducklings","math","animals"], materials:["kitchen scale","journal"], instructions:"Weigh each duckling. Record weight in grams. Mark on a chart. Notice who's growing fastest.", minDurationMin:20, maxDurationMin:45, setting:"either", energyLevel:"low" },
  { title: "Parakeet Vocabulary Tracker", description: "Sit with the parakeets. Tally every word, sound, or whistle they make.", subjectSlugs:["science","ela"], topicTags:["observation","language","birds"], interestTags:["parakeets","science"], materials:["tally sheet","pen"], instructions:"Sit quietly near Sky and Sunshine. Tally every distinct sound. Try to mimic one back. Note their reaction.", minDurationMin:15, maxDurationMin:30, setting:"indoor", energyLevel:"low" },
  { title: "Bearded Dragon Meal Math", description: "Calculate Brutus's insect-to-greens ratio for the week.", subjectSlugs:["math","science","rescue"], topicTags:["fractions","percents","reptiles"], interestTags:["bearded dragon","math"], materials:["calculator","food log"], instructions:"Track what Brutus eats for 3 days. Calculate insect % vs greens %. Plan tomorrow to hit the right ratio.", minDurationMin:20, maxDurationMin:40, setting:"indoor", energyLevel:"low" },
  { title: "Insect Rescue Release Form", description: "Any bug Reagan brings inside today gets a release form like a real wildlife rehab.", subjectSlugs:["ela","science","rescue"], topicTags:["forms","writing","insects"], interestTags:["rescue","insects"], materials:["release form printable"], instructions:"For each insect rescued: ID species, where found, condition, care given, release plan. Sign as Lead Care Specialist.", minDurationMin:15, maxDurationMin:30, setting:"either", energyLevel:"low" },
  { title: "Build a Bird Recovery Box", description: "Design and build a safe recovery box for an injured bird.", subjectSlugs:["science","art","rescue"], topicTags:["engineering","birds","care"], interestTags:["rescue","birds","building"], materials:["cardboard","soft cloth","tape","scissors"], instructions:"Design a small box with airflow, soft bedding, a quiet zone, and easy cleaning. Test it with a soft toy.", minDurationMin:30, maxDurationMin:60, setting:"either", energyLevel:"medium" },
  { title: "Duckling Behavior Ethogram", description: "15 minutes of real animal behavior science with the ducks.", subjectSlugs:["science"], topicTags:["ethology","data","ducks"], interestTags:["ducklings","science"], materials:["clipboard","timer-free tally sheet"], instructions:"Sit with the ducklings. Every minute, note what each duck is doing (eating, swimming, preening, sleeping, playing). Find patterns.", minDurationMin:15, maxDurationMin:30, setting:"outdoor", energyLevel:"low" },
  { title: "Compare Beaks: Parakeet vs Duck vs Wild Bird", description: "Sketch and label different beaks. Why do they differ?", subjectSlugs:["science","art"], topicTags:["adaptations","birds","drawing"], interestTags:["birds","art","science"], materials:["sketchbook","pencils"], instructions:"Sketch a parakeet beak, a duck bill, and one wild bird beak you've seen. Write what each is for.", minDurationMin:20, maxDurationMin:45, setting:"either", energyLevel:"low" },
  { title: "Design Enrichment Toys for the Parakeets", description: "Make new toys to keep them happy and busy.", subjectSlugs:["art","science","rescue"], topicTags:["enrichment","crafts","birds"], interestTags:["parakeets","building","art"], materials:["safe ropes","wood beads","paper","scissors"], instructions:"Design 2 toys. Build them. Hang in the cage. Watch which they prefer.", minDurationMin:30, maxDurationMin:60, setting:"indoor", energyLevel:"medium" },
  { title: "Watercolor Field Journal — Today's Birds", description: "Paint every bird you saw today in a real field journal.", subjectSlugs:["art","science","ela"], topicTags:["birds","watercolor","journaling"], interestTags:["birds","art","watercolor"], materials:["watercolor","paper","Merlin app"], instructions:"For each bird you saw or heard today, paint a small portrait. Write a 1-sentence note about it.", minDurationMin:30, maxDurationMin:60, setting:"either", energyLevel:"low" },
  { title: "Stop-Motion Frog Life Cycle", description: "Make a clay or paper stop-motion of egg → tadpole → froglet → frog.", subjectSlugs:["science","art"], topicTags:["life cycle","amphibians","animation"], interestTags:["animals","art","building"], materials:["clay or paper","phone","tripod"], instructions:"Sculpt the four stages. Take photos to make a stop-motion. Show it to Mom.", minDurationMin:45, maxDurationMin:90, setting:"indoor", energyLevel:"medium" },

  // Creek / hiking / outdoors
  { title: "Creek Macroinvertebrate Hunt", description: "Find tiny water critters and ID them — they tell us creek health.", subjectSlugs:["science","adventure"], topicTags:["water","ecology","creek"], interestTags:["creek","outdoors","animals"], materials:["white tray","net","ID guide"], instructions:"Scoop creek water into a white tray. Find the tiny critters. ID with the guide. More variety = healthier creek.", minDurationMin:45, maxDurationMin:90, setting:"outdoor", energyLevel:"medium" },
  { title: "Sit-Spot Practice", description: "Sit quietly outside for a while. Notice everything.", subjectSlugs:["science","choice"], topicTags:["mindfulness","nature","observation"], interestTags:["outdoors","spiritual","wonder"], materials:["just yourself"], instructions:"Pick a spot outside. Sit still. Notice 5 sounds, 4 sights, 3 textures, 2 smells, 1 surprise.", minDurationMin:15, maxDurationMin:30, setting:"outdoor", energyLevel:"low" },
  { title: "Water Quality Day at the Creek", description: "Test the creek water and journal what you find.", subjectSlugs:["science","ela"], topicTags:["water","testing","data"], interestTags:["creek","science","outdoors"], materials:["pH strips","thermometer","journal"], instructions:"Measure pH and temperature at 3 spots along the creek. Note differences. Hypothesize why.", minDurationMin:45, maxDurationMin:90, setting:"outdoor", energyLevel:"medium" },
  { title: "Trail Walk + Bird Count", description: "Hike a trail. Count every bird you see/hear with Merlin.", subjectSlugs:["science","adventure"], topicTags:["birds","data","hiking"], interestTags:["hiking","birds","outdoors"], materials:["Merlin app","journal"], instructions:"Walk a trail. Use Merlin to ID every bird. Tally each species. Submit to eBird as citizen science.", minDurationMin:45, maxDurationMin:90, setting:"outdoor", energyLevel:"high" },
  { title: "Build a Pollinator Garden Patch", description: "Plant flowers that bees, butterflies, and hummingbirds love.", subjectSlugs:["science","art","rescue"], topicTags:["pollinators","plants","ecology"], interestTags:["outdoors","animals","helping"], materials:["seeds","trowel","water"], instructions:"Pick a sunny spot. Plant native pollinator flowers. Map what you planted. Watch over weeks.", minDurationMin:45, maxDurationMin:90, setting:"outdoor", energyLevel:"medium" },
  { title: "Frog & Salamander Search", description: "Flip rocks and logs (carefully, then put back!) to find amphibians.", subjectSlugs:["science"], topicTags:["amphibians","ecology","creek"], interestTags:["creek","animals","outdoors"], materials:["camera or sketchbook"], instructions:"Carefully lift rocks/logs near water. Photograph or sketch any frogs/salamanders. Always put the rock back EXACTLY as it was.", minDurationMin:30, maxDurationMin:60, setting:"outdoor", energyLevel:"medium" },

  // Family / cousins / helping
  { title: "Plan a Cousin Adventure Day", description: "Design and lead a full day of activities for your cousins.", subjectSlugs:["ela","social_studies"], topicTags:["planning","leadership","family"], interestTags:["cousins","helping","babysitting"], materials:["paper","markers"], instructions:"Plan a 3-activity day for your cousins (a craft, an outdoor game, a snack). Write the schedule. Lead it.", minDurationMin:60, maxDurationMin:120, setting:"either", energyLevel:"high" },
  { title: "Letter to a Cousin", description: "Write a real letter telling them why you love them.", subjectSlugs:["ela"], topicTags:["writing","family","gratitude"], interestTags:["cousins","family"], materials:["paper","envelope","stamp"], instructions:"Pick one cousin. Write what you love about them. Mail it.", minDurationMin:20, maxDurationMin:40, setting:"indoor", energyLevel:"low" },
  { title: "Bake & Ship to Grandma Marcy", description: "Bake something special and mail it (or save for next visit).", subjectSlugs:["math","ela"], topicTags:["measurement","writing","baking"], interestTags:["baking","family","helping"], materials:["recipe","ingredients"], instructions:"Pick a recipe. Measure carefully (math!). Bake. Write Grandma a note to go with it. Pack it up.", minDurationMin:60, maxDurationMin:120, setting:"indoor", energyLevel:"medium" },
  { title: "Backyard Nature Hunt for Cousins", description: "Design a scavenger hunt for younger cousins next time they visit.", subjectSlugs:["science","art"], topicTags:["nature","planning","family"], interestTags:["cousins","outdoors","helping"], materials:["paper","markers"], instructions:"Make a scavenger hunt list (10 things to find outside). Decorate. Save for next visit.", minDurationMin:30, maxDurationMin:60, setting:"either", energyLevel:"medium" },
  { title: "Teach a Cousin to Use Merlin", description: "Show a younger cousin how to ID birds with the Merlin app.", subjectSlugs:["science"], topicTags:["teaching","birds","family"], interestTags:["cousins","birds","helping"], materials:["phone with Merlin"], instructions:"Plan how you'll teach it simply. Lead them through identifying 3 birds.", minDurationMin:30, maxDurationMin:60, setting:"either", energyLevel:"medium" },
  { title: "Cousins Care Package", description: "Make a handmade care package with drawings + small treasures.", subjectSlugs:["art","ela"], topicTags:["crafts","writing","family"], interestTags:["cousins","art","helping"], materials:["box","paper","treasures"], instructions:"Make drawings, find small treasures, write notes. Pack in a box. Label it.", minDurationMin:45, maxDurationMin:90, setting:"indoor", energyLevel:"medium" },

  // Art / making / building
  { title: "Sculpt Clay Birds of Ohio", description: "Make 3 small clay birds you've seen in Ohio.", subjectSlugs:["art","science"], topicTags:["sculpture","birds","art"], interestTags:["art","birds","building"], materials:["air-dry clay","reference photos"], instructions:"Pick 3 Ohio birds. Sculpt each. Let dry. Paint when ready.", minDurationMin:45, maxDurationMin:90, setting:"indoor", energyLevel:"medium" },
  { title: "Build a Wetland Diorama", description: "Build a model of a wetland ecosystem you saw at the creek.", subjectSlugs:["science","art"], topicTags:["ecosystems","building","art"], interestTags:["building","creek","art"], materials:["shoebox","clay","paper","paint"], instructions:"Recreate a wetland: water, plants, animals, sky. Label each part.", minDurationMin:60, maxDurationMin:120, setting:"indoor", energyLevel:"medium" },
  { title: "Design a Future Animal Sanctuary", description: "Sketch your dream wildlife sanctuary — full layout.", subjectSlugs:["art","science"], topicTags:["design","planning","animals"], interestTags:["rescue","building","art"], materials:["large paper","markers"], instructions:"Sketch the layout: rehab wing, release prep, education center, garden. Label every space.", minDurationMin:45, maxDurationMin:90, setting:"indoor", energyLevel:"medium" },
  { title: "Children's Book Starring Brutus", description: "Write & illustrate a short book starring your bearded dragon.", subjectSlugs:["ela","art"], topicTags:["writing","illustration","story"], interestTags:["bearded dragon","art","ela"], materials:["paper","markers","stapler"], instructions:"6-page mini book. Brutus is the hero. Illustrate every page.", minDurationMin:60, maxDurationMin:120, setting:"indoor", energyLevel:"medium" },
  { title: "Design Makeup Inspired by a Bird", description: "Pick a bird (cardinal, peacock, owl). Design a makeup look from its colors.", subjectSlugs:["art","science"], topicTags:["color theory","makeup","birds"], interestTags:["makeup","art","birds"], materials:["sketchbook OR makeup"], instructions:"Sketch the look first. If you want, try it on yourself. Photograph the result.", minDurationMin:30, maxDurationMin:60, setting:"indoor", energyLevel:"low" },
  { title: "DIY Sugar-Rose Lip Scrub", description: "Make natural lip scrub. Real chemistry + self-care.", subjectSlugs:["science","art"], topicTags:["chemistry","plants","beauty"], interestTags:["makeup","baking","art"], materials:["sugar","honey","rose petals"], instructions:"Mix 2 parts sugar, 1 part honey, dried rose petals. Store in a tiny jar. Label it.", minDurationMin:20, maxDurationMin:40, setting:"indoor", energyLevel:"low" },

  // Spirit / wonder
  { title: "Build a Tiny Nature Altar", description: "A small spot of meaningful natural treasures.", subjectSlugs:["choice"], topicTags:["spiritual","nature","wonder"], interestTags:["spiritual","outdoors","art"], materials:["found feathers, stones, etc."], instructions:"Pick a small surface. Arrange treasures: feathers, stones, leaves, water. Add a candle if Mom is around.", minDurationMin:20, maxDurationMin:40, setting:"either", energyLevel:"low" },
  { title: "Full Moon Notice", description: "Tonight's moon. Just look. Just notice.", subjectSlugs:["science","choice"], topicTags:["astronomy","spiritual","wonder"], interestTags:["spiritual","outdoors","wonder"], materials:["just you"], instructions:"Step outside tonight. Look at the moon. Write 3 words about it.", minDurationMin:10, maxDurationMin:20, setting:"outdoor", energyLevel:"low" },

  // Math (her strength) — animal flavored
  { title: "Duckling Food Cost Calculator", description: "How much does it cost to feed your ducklings per week?", subjectSlugs:["math"], topicTags:["money","multiplication","data"], interestTags:["ducklings","math"], materials:["calculator","feed bag info"], instructions:"Read the feed bag. Calculate $/oz. Estimate how much they eat/day. Compute weekly cost.", minDurationMin:20, maxDurationMin:45, setting:"indoor", energyLevel:"low" },
  { title: "Parakeet-Themed Fraction Puzzles", description: "Real fraction problems set in your parakeets' world.", subjectSlugs:["math"], topicTags:["fractions","puzzles"], interestTags:["parakeets","math"], materials:["worksheet"], instructions:"Solve 5 fraction puzzles where Sky and Sunshine are the characters.", minDurationMin:20, maxDurationMin:40, setting:"indoor", energyLevel:"low" },
  { title: "Build a Duckling Growth Chart", description: "Graph your ducklings' weights over time.", subjectSlugs:["math","science"], topicTags:["graphs","data","ducks"], interestTags:["ducklings","math","science"], materials:["graph paper","weight log"], instructions:"Make an X-Y graph. Days on bottom, weight on side. Plot each duckling. Connect with lines.", minDurationMin:30, maxDurationMin:60, setting:"indoor", energyLevel:"low" },

  // ELA — soft / voice options
  { title: "Voice-Recorded Rescue Story", description: "Tell the story of an animal you rescued (out loud, recorded).", subjectSlugs:["ela","rescue"], topicTags:["narrative","writing alternatives"], interestTags:["rescue","ela"], materials:["phone voice recorder"], instructions:"Pick a rescue you remember. Tell the story out loud. Record it. Whisper can transcribe it for you.", minDurationMin:15, maxDurationMin:30, setting:"either", energyLevel:"low" },
  { title: "Field Journal Page", description: "One page in your field journal — drawing + a few notes.", subjectSlugs:["ela","science","art"], topicTags:["journaling","drawing","writing"], interestTags:["art","outdoors","science"], materials:["sketchbook"], instructions:"Pick something you saw outside today. Draw it. Add 3-5 notes. That's it.", minDurationMin:20, maxDurationMin:40, setting:"either", energyLevel:"low" },

  // Read-aloud
  { title: "Tuck Everlasting Read-Aloud", description: "Continue Tuck Everlasting together.", subjectSlugs:["read_aloud","ela"], topicTags:["read aloud","literature"], interestTags:["reading"], materials:["book"], instructions:"Read 1-2 chapters together. Talk about what's happening.", minDurationMin:20, maxDurationMin:40, setting:"indoor", energyLevel:"low" },

  // Choice block ideas
  { title: "Hair-Braiding Tutorial Day", description: "Watch a tutorial. Try a new braid on yourself.", subjectSlugs:["choice"], topicTags:["self-care","tutorial"], interestTags:["makeup","style"], materials:["mirror","hair tools"], instructions:"Pick a braid tutorial. Practice it slowly. No pressure to nail it.", minDurationMin:20, maxDurationMin:40, setting:"indoor", energyLevel:"low" },
  { title: "Photoshoot in Nature", description: "Style yourself + photograph in a beautiful natural spot.", subjectSlugs:["choice","art"], topicTags:["photography","style"], interestTags:["makeup","outdoors","art"], materials:["camera or phone"], instructions:"Get ready however feels good. Pick a beautiful spot outside. Take photos. Pick your favorites.", minDurationMin:30, maxDurationMin:60, setting:"outdoor", energyLevel:"medium" },

  // Wednesday gentle
  { title: "Cozy Pre-Therapy Wind-Down", description: "Soft, easy work before therapy.", subjectSlugs:["choice"], topicTags:["regulation","calm"], interestTags:["spiritual","art"], materials:["whatever feels good"], instructions:"Just something easy and grounding. Drawing, the parakeets, a snack with Mom.", minDurationMin:15, maxDurationMin:30, setting:"indoor", energyLevel:"low" },
  { title: "Post-Therapy Recovery Block", description: "Quiet, light, no demands.", subjectSlugs:["choice","read_aloud"], topicTags:["recovery","rest"], interestTags:["spiritual","reading"], materials:["book or journal"], instructions:"Read, journal, or sit with the parakeets. Whatever helps you feel okay.", minDurationMin:20, maxDurationMin:45, setting:"indoor", energyLevel:"low" },

  // Service / helping
  { title: "Donation Drive for SPCA", description: "Plan a small donation drive. Real impact.", subjectSlugs:["social_studies","ela"], topicTags:["service","planning","writing"], interestTags:["rescue","helping","animals"], materials:["paper","collection box"], instructions:"Make a list of what SPCA needs. Ask family to donate. Deliver together.", minDurationMin:60, maxDurationMin:120, setting:"either", energyLevel:"medium" },
  { title: "Make 'When You Find an Injured Animal' Cards", description: "Make cards for the family with rescue first-aid steps.", subjectSlugs:["ela","science","rescue"], topicTags:["writing","first aid","rescue"], interestTags:["rescue","helping","art"], materials:["index cards","markers"], instructions:"Research safe steps. Write them as a clear card. Make 3-4 copies for family.", minDurationMin:30, maxDurationMin:60, setting:"indoor", energyLevel:"low" },
];
for (const a of adventures) {
  await ins("adventures", {
    title: a.title, description: a.description,
    subjectSlugs: JSON.stringify(a.subjectSlugs),
    topicTags: JSON.stringify(a.topicTags),
    interestTags: JSON.stringify(a.interestTags),
    materials: JSON.stringify(a.materials),
    instructions: a.instructions,
    minDurationMin: a.minDurationMin, maxDurationMin: a.maxDurationMin,
    setting: a.setting, energyLevel: a.energyLevel, isFavorite: 0,
  });
}
console.log(`✓ ${adventures.length} adventures seeded`);

/* ============================== APP LINKS ================================ */
await clear("appLinks");
const apps = [
  // ===== Core school daily-drivers =====
  { name: "IXL", url: "https://www.ixl.com/signin", category: "school", emoji: "🧠", sortOrder: 1 },
  { name: "Khan Academy", url: "https://www.khanacademy.org", category: "school", emoji: "📚", sortOrder: 2 },
  { name: "Prodigy Math", url: "https://play.prodigygame.com", category: "school", emoji: "🔢", sortOrder: 3 },
  // PowerSchool removed 2026-05-02 — Reagan's IH school account is deactivated

  // ===== Google Workspace =====
  // Google Classroom removed 2026-05-02 — IH school Workspace account deactivated; in-dashboard Classroom replaces it
  { name: "Google Docs", url: "https://docs.google.com", category: "google", emoji: "📝", sortOrder: 11 },
  { name: "Google Slides", url: "https://slides.google.com", category: "google", emoji: "🎞️", sortOrder: 12 },
  { name: "Google Drive", url: "https://drive.google.com", category: "google", emoji: "📁", sortOrder: 13 },
  { name: "Gmail", url: "https://mail.google.com", category: "google", emoji: "✉️", sortOrder: 14 },

  // ===== Video / kid-safe =====
  { name: "YouTube Kids", url: "https://www.youtubekids.com", category: "video", emoji: "📺", sortOrder: 20 },
  { name: "Mystery Doug", url: "https://mysteryscience.com/mystery-doug", category: "video", emoji: "🤔", sortOrder: 21 },
  { name: "Generation Genius", url: "https://www.generationgenius.com", category: "video", emoji: "🧪", sortOrder: 22 },
  { name: "Crash Course Kids", url: "https://www.youtube.com/c/crashcoursekids", category: "video", emoji: "🎬", sortOrder: 23 },
  { name: "Math Antics", url: "https://www.mathantics.com", category: "video", emoji: "🧮", sortOrder: 24 },

  // ===== Reading / Books =====
  { name: "Epic! Books", url: "https://www.getepic.com", category: "reading", emoji: "📖", sortOrder: 30 },
  { name: "Storyline Online", url: "https://storylineonline.net", category: "reading", emoji: "📚", sortOrder: 31 },
  { name: "CommonLit", url: "https://www.commonlit.org/en/library?grade=5", category: "reading", emoji: "📰", sortOrder: 32 },
  { name: "ReadWorks", url: "https://www.readworks.org", category: "reading", emoji: "📄", sortOrder: 33 },

  // ===== Nature / Science =====
  { name: "Merlin Bird ID", url: "https://merlin.allaboutbirds.org", category: "nature", emoji: "🦜", sortOrder: 40 },
  { name: "iNaturalist Seek", url: "https://www.inaturalist.org/pages/seek_app", category: "nature", emoji: "🌿", sortOrder: 41 },
  { name: "NASA Space Place", url: "https://spaceplace.nasa.gov", category: "nature", emoji: "🚀", sortOrder: 42 },
  { name: "Nat Geo Kids", url: "https://kids.nationalgeographic.com", category: "nature", emoji: "🌍", sortOrder: 43 },

  // ===== Creative =====
  { name: "Canva", url: "https://www.canva.com", category: "creativity", emoji: "🎨", sortOrder: 50 },
  { name: "ChatGPT (kid mode)", url: "https://chatgpt.com", category: "creativity", emoji: "💬", sortOrder: 51 },
];
for (const a of apps) await ins("appLinks", a);
console.log(`✓ ${apps.length} app links seeded`);

/* ============================== BOOKS ==================================== */
await clear("books");
const books = [
  { title: "Spectrum Science Grade 5", author: "Spectrum", type: "workbook", subjectSlug: "science", currentPage: 1, totalPages: 176 },
  { title: "180 Days of Language Grade 5", author: "Shell Education", type: "workbook", subjectSlug: "ela", currentPage: 1, totalPages: 200 },
  { title: "Tuck Everlasting", author: "Natalie Babbitt", type: "novel", subjectSlug: "ela", currentPage: 1, totalPages: 144 },
];
for (const b of books) await ins("books", b);
console.log("✓ Books seeded");

/* ============================== BADGES =================================== */
await clear("badges");
const badges = [
  { slug: "duckling_caretaker", name: "Duckling Caretaker", emoji: "🦆", description: "7 days of duckling logs", target: 7, progress: 0, earned: 0 },
  { slug: "parakeet_linguist", name: "Parakeet Linguist", emoji: "🦜", description: "25 logged parakeet sounds", target: 25, progress: 0, earned: 0 },
  { slug: "insect_defender", name: "Insect Defender", emoji: "🐛", description: "10 insects rescued + released", target: 10, progress: 0, earned: 0 },
  { slug: "creek_scientist", name: "Creek Scientist", emoji: "🌊", description: "3 water-quality outings", target: 3, progress: 0, earned: 0 },
  { slug: "bookworm", name: "Bookworm", emoji: "📚", description: "Finished a chapter book", target: 1, progress: 0, earned: 0 },
  { slug: "math_whisperer", name: "Math Whisperer", emoji: "🧮", description: "20 math puzzles solved", target: 20, progress: 0, earned: 0 },
  { slug: "wonder_keeper", name: "Wonder Keeper", emoji: "🪶", description: "5 wonder moments noted", target: 5, progress: 0, earned: 0 },
  { slug: "cousin_caregiver", name: "Cousin Caregiver", emoji: "👶", description: "Planned an activity for cousins", target: 1, progress: 0, earned: 0 },
];
for (const b of badges) await ins("badges", { ...b, criteria: b.description });
console.log("✓ Badges seeded");

/* ============================== SPECIAL DAYS ============================= */
await clear("specialDays");
const sd = [
  { date: "2026-05-05", name: "Eta Aquariid Meteor Shower Peak", category: "astronomy", description: "Meteor shower peaks tonight! Best viewing pre-dawn.", suggestedActivity: "Step outside before bed and look east. Make a wish on a meteor.", interestTags: JSON.stringify(["spiritual","wonder","outdoors"]), viewingTimeNote: "Pre-dawn (~3-5 AM)" },
  { date: "2026-05-09", name: "World Migratory Bird Day", category: "animal", description: "A whole day to celebrate migrating birds!", suggestedActivity: "Use Merlin to ID 5 migrating birds. Make a flyway map.", interestTags: JSON.stringify(["birds","animals","outdoors"]) },
  { date: "2026-05-31", name: "Strawberry Moon (early)", category: "spiritual", description: "The June full moon is called the Strawberry Moon.", suggestedActivity: "Strawberry treat + moon-watching tonight.", interestTags: JSON.stringify(["spiritual","wonder"]) },
  { date: "2026-06-21", name: "Summer Solstice", category: "seasonal", description: "Longest day of the year.", suggestedActivity: "Sunrise + sunset both today if possible.", interestTags: JSON.stringify(["spiritual","outdoors","wonder"]) },
];
for (const d of sd) await ins("specialDays", d);
console.log("✓ Special days seeded");

/* ============================== APPOINTMENTS ============================= */
await clear("appointments");
await ins("appointments", {
  title: "Wednesday Therapy with Ali Hill, LISW",
  contactName: "Ali Hill, LISW",
  recurrenceRule: "FREQ=WEEKLY;BYDAY=WE",
  startTime: "11:00", endTime: "12:00",
  leaveTime: "10:40", returnTime: "12:30",
  durationMin: 60, isProtected: 1, decompressionBufferMin: 30,
  notes: "Protected window 10:40 AM – 1:00 PM. NEVER schedule academic blocks here. Wednesday morning is light, gentle work only. Wednesday afternoon is recovery — soft and quiet."
});
console.log("✓ Wednesday therapy seeded");

/* ============================== RECIPIENTS =============================== */
await clear("notificationRecipients");
await ins("notificationRecipients", { email: "spear.cpt@gmail.com", displayName: "Mom (Katy)", role: "parent", optInTypes: JSON.stringify(["red_zone","milestone","ih_update","weekly_summary"]) });
await ins("notificationRecipients", { email: "marcy.spear@gmail.com", displayName: "Grandma Marcy", role: "grandparent", optInTypes: JSON.stringify(["milestone","weekly_summary"]) });
console.log("✓ Recipients seeded");

/* ============================== SKILLS =================================== */
await clear("skillsMastery");
const skills = [
  { subjectSlug: "math", skillName: "Multi-digit multiplication", domain: "operations", currentScore: 70, needsHelp: 0 },
  { subjectSlug: "math", skillName: "Long division", domain: "operations", currentScore: 65, needsHelp: 0 },
  { subjectSlug: "math", skillName: "Fractions: add/subtract", domain: "fractions", currentScore: 60, needsHelp: 1 },
  { subjectSlug: "math", skillName: "Decimals", domain: "fractions", currentScore: 55, needsHelp: 1 },
  { subjectSlug: "ela", skillName: "Reading comprehension", domain: "reading", currentScore: 75, needsHelp: 0 },
  { subjectSlug: "ela", skillName: "Paragraph writing", domain: "writing", currentScore: 50, needsHelp: 1 },
  { subjectSlug: "ela", skillName: "Spelling 5th grade", domain: "spelling", currentScore: 60, needsHelp: 0 },
  { subjectSlug: "science", skillName: "Life cycles", domain: "biology", currentScore: 90, needsHelp: 0 },
  { subjectSlug: "science", skillName: "Ecosystems", domain: "biology", currentScore: 85, needsHelp: 0 },
  { subjectSlug: "social_studies", skillName: "US geography basics", domain: "geography", currentScore: 60, needsHelp: 0 },
];
for (const s of skills) await ins("skillsMastery", s);
console.log("✓ Skills seeded");

/* ============================== ENCOURAGEMENT NOTES ====================== */
await clear("encouragementNotes");
await ins("encouragementNotes", { fromName: "Mom", content: "You are exactly who you're supposed to be. I'm so proud of who you're becoming. 💛", starred: 1 });
await ins("encouragementNotes", { fromName: "Grandma Marcy", content: "My Animal Whisperer 🪶 — your kindness is the rarest thing in this world.", starred: 1 });
console.log("✓ Encouragement notes seeded");

await conn.end();
console.log("\n🪶 All seeded. Reagan's dashboard is ready.");

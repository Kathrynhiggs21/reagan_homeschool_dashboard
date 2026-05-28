#!/usr/bin/env node
/**
 * seed_placement_tasks.mjs
 *
 * Seed 3 placement tasks per skill (gradeLevel "4" probe, "5" on-grade, "6" stretch).
 * Reagan answers; the placement engine maps her correct/incorrect + how-it-felt
 * to a starting ladder level (0..2) so the catch-up trajectory is grounded in
 * real evidence, not the IEP guess.
 *
 * Re-runnable: idempotent on (skillCode, taskOrder).
 */

import mysql from "mysql2/promise";

const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port || "4000"),
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

/** TASKS: keyed by skillCode -> [task0(below=g4), task1(on=g5), task2(stretch=g6)] */
const TASKS = {
  // ─────────────────────── MATH ──────────────────────────
  "OH.5.NBT.1": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "In 462, the 6 means 6 ___.", choices: ["ones","tens","hundreds","thousands"], correctAnswer: "tens" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "In 4,562 the 5 is in the ___ place. It is worth what 5 in 562 is worth times ___.", choices: ["10","100","1,000","1"], correctAnswer: "10" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "In 35.27, the 2 is worth ___ as much as the 2 in 32.7.", choices: ["1/100","1/10","10","100"], correctAnswer: "1/100" },
  ],
  "OH.5.NBT.2": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "10 × 10 = ?", choices: ["10","100","1,000","20"], correctAnswer: "100" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "4.5 × 100 = ?", choices: ["45","450","4,500","0.045"], correctAnswer: "450" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Write 1,000 as a power of 10.", choices: ["10²","10³","10⁴","10¹"], correctAnswer: "10³" },
  ],
  "OH.5.NBT.5": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "23 × 4 = ?", choices: ["72","82","92","102"], correctAnswer: "92" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "27 × 14 = ?", choices: ["378","356","298","412"], correctAnswer: "378" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "215 × 38 = ?", choices: ["8,170","7,950","8,250","8,070"], correctAnswer: "8,170" },
  ],
  "OH.5.NBT.6": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "84 ÷ 4 = ?", choices: ["21","22","20","19"], correctAnswer: "21" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "168 ÷ 12 = ?", choices: ["14","12","16","18"], correctAnswer: "14" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "984 ÷ 24 = ?", choices: ["41","38","42","36"], correctAnswer: "41" },
  ],
  "OH.5.NBT.7": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "2.4 + 1.3 = ?", choices: ["3.7","37","3.07","2.7"], correctAnswer: "3.7" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "5.6 - 2.45 = ?", choices: ["3.15","3.25","2.15","3.11"], correctAnswer: "3.15" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "0.6 × 0.4 = ?", choices: ["0.24","2.4","24","0.024"], correctAnswer: "0.24" },
  ],
  "OH.5.NF.1": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "1/2 + 1/2 = ?", choices: ["1","1/4","2/4","2"], correctAnswer: "1" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "1/2 + 1/3 = ?", choices: ["2/5","5/6","2/6","1/5"], correctAnswer: "5/6" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "3/4 - 1/6 = ?", choices: ["7/12","2/12","1/2","2/10"], correctAnswer: "7/12" },
  ],
  "OH.5.NF.4": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "1/2 of 8 = ?", choices: ["2","4","6","8"], correctAnswer: "4" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "2/3 × 9 = ?", choices: ["3","6","12","18"], correctAnswer: "6" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "2/3 × 3/4 = ?", choices: ["6/12","1/2","6/7","5/7"], correctAnswer: "1/2" },
  ],
  "OH.5.NF.7": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "Which is bigger: 1/2 or 1/4?", choices: ["1/2","1/4","they're equal","not sure"], correctAnswer: "1/2" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "1/2 ÷ 4 = ? (Cut a half-pizza into 4 equal pieces. How big is one piece?)", choices: ["1/8","1/2","2","4/2"], correctAnswer: "1/8" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "3 ÷ 1/4 = ? (How many 1/4-cups fit into 3 cups?)", choices: ["12","3/4","4","1/12"], correctAnswer: "12" },
  ],
  "OH.5.OA.1": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "Solve: 4 + 3 × 2 = ?", choices: ["10","14","20","9"], correctAnswer: "10" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "Solve: (4 + 3) × 2 = ?", choices: ["14","10","11","20"], correctAnswer: "14" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Solve: 2 × (3 + 4²) = ?", choices: ["38","26","98","36"], correctAnswer: "38" },
  ],
  "OH.5.MD.1": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "How many inches in 1 foot?", choices: ["10","12","16","100"], correctAnswer: "12" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "Convert 3 feet to inches.", choices: ["12","30","36","45"], correctAnswer: "36" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Convert 2.5 km to meters.", choices: ["250","2,500","25,000","25"], correctAnswer: "2,500" },
  ],
  "OH.5.MD.5": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "What does volume measure?", choices: ["how heavy something is","how much space something takes up","how long something is","how hot something is"], correctAnswer: "how much space something takes up" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "A box is 4 × 3 × 2 cm. What's its volume?", choices: ["9 cm³","24 cm³","12 cm³","18 cm³"], correctAnswer: "24 cm³" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "A fish tank is 10 × 5 × 6 inches. What's its volume?", choices: ["300 in³","21 in³","60 in³","30 in³"], correctAnswer: "300 in³" },
  ],
  "OH.5.G.1": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "On a graph, which axis is the horizontal one (left-right)?", choices: ["x-axis","y-axis","z-axis","none"], correctAnswer: "x-axis" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "Where is the point (3, 2) on a graph?", choices: ["3 right, 2 up","2 right, 3 up","3 up, 2 right","3 left, 2 down"], correctAnswer: "3 right, 2 up" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Which point is on the y-axis?", choices: ["(2, 0)","(0, 4)","(3, 5)","(-1, 2)"], correctAnswer: "(0, 4)" },
  ],
  "OH.5.G.3": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "How many sides does a triangle have?", choices: ["3","4","5","6"], correctAnswer: "3" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "Every square is also a ___.", choices: ["triangle","circle","rectangle","pentagon"], correctAnswer: "rectangle" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Which is true? All rectangles are squares OR all squares are rectangles?", choices: ["All rectangles are squares","All squares are rectangles","Both true","Neither"], correctAnswer: "All squares are rectangles" },
  ],

  // ─────────────────────── ELA ──────────────────────────
  "OH.5.RL.1": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "In a story, evidence is best described as ___.", choices: ["a guess","words from the text that prove your idea","the title","a question"], correctAnswer: "words from the text that prove your idea" },
    { gradeLevel: "5", taskType: "shortAnswer", kidPrompt: "If a story says 'Mia clenched her fists and walked out without saying goodbye,' how do you think Mia is feeling? Type one or two words.", correctAnswer: "angry" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Which sentence is the BEST evidence that a character is nervous?", choices: ["She was tall.","Her hands shook as she opened the envelope.","She liked dogs.","The sky was blue."], correctAnswer: "Her hands shook as she opened the envelope." },
  ],
  "OH.5.RL.2": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "What is the main idea of a story?", choices: ["The author's name","The most important thing the story is about","The first sentence","The page number"], correctAnswer: "The most important thing the story is about" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "A theme is ___.", choices: ["the place a story happens","a lesson the story teaches","a list of characters","the cover of the book"], correctAnswer: "a lesson the story teaches" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Which is the BEST theme for a story where a girl learns to forgive her friend?", choices: ["Friendship is forever","Forgiveness brings peace","Always say sorry first","Best friends never fight"], correctAnswer: "Forgiveness brings peace" },
  ],
  "OH.5.RL.3": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "Two characters are 'opposite' when they ___.", choices: ["look the same","are different in important ways","are friends","both have pets"], correctAnswer: "are different in important ways" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "If one character is brave and another is scared, the best way to show this is by comparing their ___.", choices: ["names","actions and choices","clothes","hair color"], correctAnswer: "actions and choices" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Two friends both want to win a race. One trains every day. The other only practices once. What does this difference show?", choices: ["They look different","They have different priorities","They live in different houses","They're not really friends"], correctAnswer: "They have different priorities" },
  ],
  "OH.5.RL.6": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "First-person point of view uses words like ___.", choices: ["he, she, they","I, me, my","you, your","one, someone"], correctAnswer: "I, me, my" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "If a story is told 'I walked into the dark room,' the narrator is ___.", choices: ["the author","a character in the story","an outside observer","the reader"], correctAnswer: "a character in the story" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "How could the SAME event feel different in third-person vs first-person?", choices: ["It can't","First-person shows the character's inner feelings; third-person can show many","Third-person is always sadder","First-person uses bigger words"], correctAnswer: "First-person shows the character's inner feelings; third-person can show many" },
  ],
  "OH.5.RI.2": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "An informational text gives you ___.", choices: ["a made-up story","real facts about a topic","a poem","a song"], correctAnswer: "real facts about a topic" },
    { gradeLevel: "5", taskType: "shortAnswer", kidPrompt: "An article is mostly about how bees pollinate flowers, why pollination matters for food, and how to plant a pollinator garden. What is the main idea? Type a short sentence.", correctAnswer: "bees" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Which sentence is the BEST summary of an article on bee decline?", choices: ["Bees are insects.","Honey is yummy.","Bee populations are dropping and we can help by planting pollinator gardens.","People love flowers."], correctAnswer: "Bee populations are dropping and we can help by planting pollinator gardens." },
  ],
  "OH.5.RI.5": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "If a text starts with 'first,' then 'next,' then 'finally,' the structure is ___.", choices: ["chronological (in order of time)","cause and effect","problem and solution","compare and contrast"], correctAnswer: "chronological (in order of time)" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "An article describing a problem and how to fix it uses what structure?", choices: ["chronological","problem and solution","compare and contrast","description"], correctAnswer: "problem and solution" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Two articles cover the same animal — one in time order and one comparing it to another animal. They use which structures?", choices: ["chronological + compare/contrast","cause/effect + description","problem/solution + chronological","description + chronological"], correctAnswer: "chronological + compare/contrast" },
  ],
  "OH.5.RI.8": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "An author supports a point by giving ___.", choices: ["jokes","reasons and evidence","a title","a picture only"], correctAnswer: "reasons and evidence" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "Which is the STRONGEST evidence that recycling helps the planet?", choices: ["My friend recycles.","Studies show recycling cuts landfill waste by 30%.","I like recycling.","Recycling sounds smart."], correctAnswer: "Studies show recycling cuts landfill waste by 30%." },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "An author claims a new park is needed and supports it with: a survey, a quote from a kid, and the author's own opinion. Which is the WEAKEST evidence?", choices: ["the survey","the quote from a kid","the author's own opinion","none of them"], correctAnswer: "the author's own opinion" },
  ],
  "OH.5.W.1": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "An opinion piece tells what you ___.", choices: ["dreamed","think and why","saw on TV","cooked"], correctAnswer: "think and why" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "A good opinion paragraph needs your idea, ___, and a closing.", choices: ["funny jokes","at least 2 reasons with evidence","the alphabet","a question"], correctAnswer: "at least 2 reasons with evidence" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Which intro is the STRONGEST for an opinion essay 'Kids should have recess every day'?", choices: ["Recess is fun.","Schools should give kids recess every day because it boosts focus, friendships, and health.","I like running outside.","Recess is at noon."], correctAnswer: "Schools should give kids recess every day because it boosts focus, friendships, and health." },
  ],
  "OH.5.W.2": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "Informative writing teaches the reader about ___.", choices: ["a real topic","a made-up land","a song","nothing"], correctAnswer: "a real topic" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "When you write about a topic, you should group facts ___.", choices: ["randomly","by paragraph and topic","by color","backwards"], correctAnswer: "by paragraph and topic" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "An informative essay needs a topic sentence + ___, plus a closing.", choices: ["facts and details from research","your opinion only","jokes","made-up stuff"], correctAnswer: "facts and details from research" },
  ],
  "OH.5.W.3": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "A narrative is a ___.", choices: ["list","story","math problem","map"], correctAnswer: "story" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "Dialogue in a story is ___.", choices: ["the title","what characters say to each other","the page number","facts at the end"], correctAnswer: "what characters say to each other" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Which sentence uses dialogue + sensory detail?", choices: ["She was happy.","\"It smells like cinnamon!\" Mia laughed as she peeked into the warm kitchen.","Mia walked.","The kitchen was nice."], correctAnswer: "\"It smells like cinnamon!\" Mia laughed as she peeked into the warm kitchen." },
  ],
  "OH.5.L.1": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "Which is a conjunction?", choices: ["happy","but","blue","run"], correctAnswer: "but" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "Pick the sentence with a preposition.", choices: ["She ran fast.","The cat is under the table.","I love pizza.","Hello there!"], correctAnswer: "The cat is under the table." },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Which sentence uses an interjection?", choices: ["Wow! That's amazing.","She is happy.","The dog runs.","Pizza is good."], correctAnswer: "Wow! That's amazing." },
  ],
  "OH.5.L.2": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "Which has correct commas in a list?", choices: ["I like apples bananas and grapes.","I like apples, bananas and grapes.","I like, apples, bananas, and grapes.","I like apples bananas, and, grapes."], correctAnswer: "I like apples, bananas and grapes." },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "Which sentence uses a comma after an introductory word correctly?", choices: ["First we saw birds.","First, we saw birds.","First; we saw birds.","First we, saw birds."], correctAnswer: "First, we saw birds." },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Which is correct?", choices: ["After the rain we hiked, swam, and rested.","After the rain, we hiked swam and rested.","After the rain, we hiked, swam, and rested.","After, the rain we hiked swam and rested."], correctAnswer: "After the rain, we hiked, swam, and rested." },
  ],
  "OH.5.L.4": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "Context clues are ___.", choices: ["pictures only","other words around a tricky word that help you figure it out","page numbers","the title"], correctAnswer: "other words around a tricky word that help you figure it out" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "The Latin root 'aqua' means ___.", choices: ["fire","water","earth","air"], correctAnswer: "water" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "If 'photo' means 'light' and 'graph' means 'write,' what does 'photograph' literally mean?", choices: ["light writing (a picture made by light)","heavy writing","sound writing","fast writing"], correctAnswer: "light writing (a picture made by light)" },
  ],

  // ─────────────────────── SCIENCE ──────────────────────────
  "OH.5.ESS.1": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "What is at the center of our solar system?", choices: ["Earth","the Sun","the Moon","a black hole"], correctAnswer: "the Sun" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "Which planet is closest to the Sun?", choices: ["Earth","Venus","Mercury","Mars"], correctAnswer: "Mercury" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Which is NOT a planet?", choices: ["Pluto","Mars","Saturn","Neptune"], correctAnswer: "Pluto" },
  ],
  "OH.5.ESS.2": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "Day and night happen because Earth ___.", choices: ["spins (rotates)","stays still","circles the Moon","gets bigger"], correctAnswer: "spins (rotates)" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "Seasons are caused by Earth's ___.", choices: ["rotation","tilt as it orbits the Sun","distance to Mars","distance to the Moon"], correctAnswer: "tilt as it orbits the Sun" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "What causes the moon's phases?", choices: ["The moon makes its own light","Different amounts of the sunlit side face Earth","Clouds in space","The moon shrinks each night"], correctAnswer: "Different amounts of the sunlit side face Earth" },
  ],
  "OH.5.LS.1": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "In a food chain, what comes first?", choices: ["a hawk","grass (a plant)","a mouse","a snake"], correctAnswer: "grass (a plant)" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "Where do plants get their energy?", choices: ["the soil","the Sun","other animals","the moon"], correctAnswer: "the Sun" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "If all the plants died in an ecosystem, the ___ would be affected first.", choices: ["top predators","plant-eaters (herbivores)","decomposers","sunlight"], correctAnswer: "plant-eaters (herbivores)" },
  ],
  "OH.5.LS.2": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "An adaptation helps a living thing ___.", choices: ["look pretty","survive in its environment","be lazy","be loud"], correctAnswer: "survive in its environment" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "A polar bear's white fur is an adaptation that helps it ___.", choices: ["be warm and blend in with snow","fly","swim faster than fish","be small"], correctAnswer: "be warm and blend in with snow" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "A cactus has thick stems and tiny leaves. Why?", choices: ["To be pretty","To store water and lose less to evaporation","To attract bees","To fight other plants"], correctAnswer: "To store water and lose less to evaporation" },
  ],
  "OH.5.PS.1": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "Sound travels best through ___.", choices: ["empty space","solids","fog","clouds"], correctAnswer: "solids" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "Light is a kind of ___.", choices: ["food","energy that travels in waves","liquid","gas"], correctAnswer: "energy that travels in waves" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Why do we see lightning before we hear thunder?", choices: ["Lightning is brighter","Light travels much faster than sound","Thunder is shy","Sound goes backward"], correctAnswer: "Light travels much faster than sound" },
  ],
  "OH.5.PS.2": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "Ice is the ___ state of water.", choices: ["liquid","solid","gas","plasma"], correctAnswer: "solid" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "When you mix sugar into water and the sugar disappears, you made a ___.", choices: ["solution (mixture)","new element","gas","metal"], correctAnswer: "solution (mixture)" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "If you weigh a sealed jar of water, freeze it, and weigh it again, the weight will be ___.", choices: ["less","more","the same","zero"], correctAnswer: "the same" },
  ],

  // ─────────────────────── SOCIAL STUDIES ──────────────────────────
  "OH.5.SS.1": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "The Western Hemisphere includes ___.", choices: ["North and South America","Europe and Asia","Africa and Australia","Just the U.S."], correctAnswer: "North and South America" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "Which is an example of an early Western Hemisphere civilization?", choices: ["Maya","Romans","Vikings","Egyptians"], correctAnswer: "Maya" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "The Inca civilization built its empire in ___.", choices: ["the Andes mountains in South America","the Sahara desert","Northern Europe","Australia"], correctAnswer: "the Andes mountains in South America" },
  ],
  "OH.5.SS.2": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "Lines that go around the Earth east-west are ___.", choices: ["latitude","longitude","equator only","meridians only"], correctAnswer: "latitude" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "The equator is at ___ degrees latitude.", choices: ["0","90","45","180"], correctAnswer: "0" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Lines that go from the North Pole to the South Pole are ___.", choices: ["latitude","longitude","equators","tropics"], correctAnswer: "longitude" },
  ],
  "OH.5.SS.3": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "A responsibility of being a citizen is ___.", choices: ["complaining a lot","following laws and helping the community","staying quiet always","ignoring news"], correctAnswer: "following laws and helping the community" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "Voting is an example of a citizen's ___.", choices: ["right and responsibility","punishment","party","luck"], correctAnswer: "right and responsibility" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Which is BOTH a right and a responsibility of citizens?", choices: ["watching TV","staying informed and voting","sleeping","eating"], correctAnswer: "staying informed and voting" },
  ],
  "OH.5.SS.4": [
    { gradeLevel: "4", taskType: "pickOne", kidPrompt: "A 'productive resource' is something used to ___.", choices: ["sleep","make goods or services","decorate","eat for fun"], correctAnswer: "make goods or services" },
    { gradeLevel: "5", taskType: "pickOne", kidPrompt: "Trade between two regions usually happens because ___.", choices: ["they have the same things","they have different resources each needs","they are bored","they are big"], correctAnswer: "they have different resources each needs" },
    { gradeLevel: "6", taskType: "pickOne", kidPrompt: "Specialization in trade means a region ___.", choices: ["makes everything itself","focuses on what it makes best and trades for the rest","stops trading","never trades"], correctAnswer: "focuses on what it makes best and trades for the rest" },
  ],
};

const [allSkills] = await conn.query("SELECT id, skillCode, subjectSlug FROM skillLadder");
let inserted = 0, skipped = 0, missing = 0;
for (const s of allSkills) {
  const tasks = TASKS[s.skillCode];
  if (!tasks) { missing++; continue; }
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const [exists] = await conn.query(
      "SELECT id FROM placementTasks WHERE skillLadderId = ? AND taskOrder = ?",
      [s.id, i]
    );
    if (exists.length) { skipped++; continue; }
    await conn.query(
      `INSERT INTO placementTasks (skillLadderId, taskOrder, gradeLevel, taskType, kidPrompt, choices, correctAnswer, hint, active)
       VALUES (?,?,?,?,?,?,?,?,true)`,
      [s.id, i, t.gradeLevel, t.taskType, t.kidPrompt, t.choices ? JSON.stringify(t.choices) : null, t.correctAnswer ?? null, t.hint ?? null]
    );
    inserted++;
  }
}

console.log(`Placement tasks seeded — inserted: ${inserted}, skipped: ${skipped}, missing-tasks: ${missing}, total skills: ${allSkills.length}`);
await conn.end();
process.exit(0);

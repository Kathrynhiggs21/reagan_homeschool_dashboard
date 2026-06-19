/**
 * kiwiWardrobe.ts — Kiwi's Closet catalog + equip engine.
 *
 * Roblox-style avatar dressing for Kiwi. Each wearable is an emoji-glyph layer
 * (same proven approach as the costume overlays in KiwiSprite) positioned over
 * the sprite. Pure data + pure functions so the whole thing is unit-testable
 * and the renderer (KiwiWardrobe / KiwiSprite) just maps over equipped items.
 *
 * Design rules (from Katy, 2026-06-19):
 *   - Layered SLOTS: head, eyes, neck, body, back, feet, held.
 *   - One item per slot — equipping a new item in a slot SWAPS the old one
 *     (a hat replaces a hat; a headband shares the head slot with a hat → swap).
 *   - Removal is PER-PIECE only (each equipped item has its own remove), plus a
 *     single "Take off all / Clear". NO bulk/group removal.
 *   - Costumes are DECOMPOSABLE: equip the whole set OR individual pieces. Each
 *     piece still obeys one-per-slot swap.
 *   - Kiwi reacts to outfits in a sassy, funny, 11+ voice; trendy items use
 *     light current slang.
 */

export type WardrobeSlot =
  | "head"
  | "eyes"
  | "neck"
  | "body"
  | "back"
  | "feet"
  | "held";

export const WARDROBE_SLOTS: WardrobeSlot[] = [
  "head",
  "eyes",
  "neck",
  "body",
  "back",
  "feet",
  "held",
];

export type WardrobeTab =
  | "girly"
  | "sporty"
  | "everyday"
  | "silly"
  | "other"
  | "halloween"
  | "trendy";

export const WARDROBE_TABS: { id: WardrobeTab; label: string; emoji: string }[] = [
  { id: "girly", label: "Girly", emoji: "🎀" },
  { id: "sporty", label: "Sporty", emoji: "⚽" },
  { id: "everyday", label: "Everyday", emoji: "🧢" },
  { id: "silly", label: "Silly", emoji: "🤪" },
  { id: "other", label: "Life stuff", emoji: "🩹" },
  { id: "halloween", label: "Costumes", emoji: "🎃" },
  { id: "trendy", label: "Trendy", emoji: "✨" },
];

/** A positioned emoji layer (fractions of the sprite box; size = fraction of width). */
export type GlyphLayer = {
  glyph: string;
  top: number;
  left: number;
  size: number;
  rotate?: number;
  z?: number;
};

export type WardrobeItem = {
  id: string;
  name: string;
  tab: WardrobeTab;
  slot: WardrobeSlot;
  /** One or more emoji layers that make up this piece. */
  layers: GlyphLayer[];
  /** Kiwi's sassy reaction when this is equipped. */
  reaction: string;
  /**
   * If this item is a full costume "set", the pieces it decomposes into.
   * Equipping the set equips every referenced piece (each into its own slot).
   */
  setPieces?: string[];
  /** Marks a costume-set entry (rendered specially in the costume tab). */
  isSet?: boolean;
};

// Helper to keep the catalog terse.
function head(top = -0.04, left = 0.3, size = 0.44): GlyphLayer {
  return { glyph: "", top, left, size, z: 6 };
}

/* ============================== THE CATALOG ============================== */
// NOTE: glyphs use emoji; positions tuned to sit over the budgie sprite head/
// chest/feet. `z` keeps held items in front, wings behind, etc.

export const WARDROBE_ITEMS: WardrobeItem[] = [
  /* ----------------------------- GIRLY ----------------------------- */
  { id: "bow", name: "Hair bow", tab: "girly", slot: "head", layers: [{ glyph: "🎀", top: 0.0, left: 0.34, size: 0.34 }], reaction: "A bow?? Instantly 20% cuter. The math checks out." },
  { id: "tiara", name: "Tiara", tab: "girly", slot: "head", layers: [{ glyph: "👑", top: -0.02, left: 0.32, size: 0.4 }], reaction: "Bow down, peasants. Queen Kiwi has entered the chat." },
  { id: "flower-crown", name: "Flower crown", tab: "girly", slot: "head", layers: [{ glyph: "🌸", top: -0.02, left: 0.22, size: 0.3 }, { glyph: "🌼", top: -0.02, left: 0.5, size: 0.3 }], reaction: "Cottagecore Kiwi. I'm basically a fairy now." },
  { id: "heart-shades", name: "Heart sunglasses", tab: "girly", slot: "eyes", layers: [{ glyph: "😎", top: 0.22, left: 0.3, size: 0.42 }], reaction: "Heart shades on. Love is in the air and so am I." },
  { id: "pearls", name: "Pearl necklace", tab: "girly", slot: "neck", layers: [{ glyph: "📿", top: 0.5, left: 0.32, size: 0.4 }], reaction: "Pearls? Very fancy lady. I shall sip tea now." },
  { id: "tutu", name: "Tutu", tab: "girly", slot: "body", layers: [{ glyph: "🩰", top: 0.55, left: 0.3, size: 0.44 }], reaction: "Tutu = automatic twirl. Watch your step, please." },
  { id: "dress", name: "Sparkly dress", tab: "girly", slot: "body", layers: [{ glyph: "👗", top: 0.5, left: 0.28, size: 0.5 }], reaction: "This dress has main-character energy and so do I." },
  { id: "butterfly-wings", name: "Butterfly wings", tab: "girly", slot: "back", layers: [{ glyph: "🦋", top: 0.3, left: 0.1, size: 0.36, z: 1 }, { glyph: "🦋", top: 0.3, left: 0.6, size: 0.36, z: 1 }], reaction: "Wings on wings on wings. Double the flutter." },
  { id: "star-wand", name: "Star wand", tab: "girly", slot: "held", layers: [{ glyph: "🪄", top: 0.5, left: 0.7, size: 0.4, z: 8 }], reaction: "Bibbidi-bobbidi-BOO. I just made homework disappear. (I didn't.)" },
  { id: "purse", name: "Cute purse", tab: "girly", slot: "held", layers: [{ glyph: "👛", top: 0.55, left: 0.68, size: 0.36, z: 8 }], reaction: "It's small, it's pink, it holds zero things. Perfect." },

  /* ----------------------------- SPORTY ----------------------------- */
  { id: "jersey", name: "Soccer jersey", tab: "sporty", slot: "body", layers: [{ glyph: "👕", top: 0.5, left: 0.28, size: 0.5 }], reaction: "Jersey on. I'm the GOAT. (The bird version.)" },
  { id: "ball", name: "Soccer ball", tab: "sporty", slot: "held", layers: [{ glyph: "⚽", top: 0.6, left: 0.68, size: 0.34, z: 8 }], reaction: "I will absolutely score and absolutely not run." },
  { id: "cap", name: "Baseball cap", tab: "sporty", slot: "head", layers: [{ glyph: "🧢", top: 0.0, left: 0.3, size: 0.42 }], reaction: "Cap on backwards = instantly 12% cooler. Science." },
  { id: "sweatband", name: "Sweatband", tab: "sporty", slot: "head", layers: [{ glyph: "🎽", top: 0.05, left: 0.3, size: 0.3 }], reaction: "Sweatband says I work out. The couch says otherwise." },
  { id: "sport-shades", name: "Sport shades", tab: "sporty", slot: "eyes", layers: [{ glyph: "🕶️", top: 0.22, left: 0.3, size: 0.4 }], reaction: "Shades on. Can't see you. Can't see the homework either." },
  { id: "medal", name: "Gold medal", tab: "sporty", slot: "neck", layers: [{ glyph: "🥇", top: 0.5, left: 0.34, size: 0.36 }], reaction: "First place in being adorable. Undefeated, honestly." },
  { id: "goggles", name: "Swim goggles", tab: "sporty", slot: "eyes", layers: [{ glyph: "🥽", top: 0.2, left: 0.3, size: 0.4 }], reaction: "Goggles on! ...I can't actually swim but vibes." },
  { id: "cleats", name: "Cleats", tab: "sporty", slot: "feet", layers: [{ glyph: "👟", top: 0.82, left: 0.3, size: 0.4 }], reaction: "Cleats! Now my little feet mean business." },

  /* ----------------------------- EVERYDAY ----------------------------- */
  { id: "beanie", name: "Beanie", tab: "everyday", slot: "head", layers: [{ glyph: "🧢", top: -0.02, left: 0.3, size: 0.42 }], reaction: "Cozy beanie. Brain temperature: optimal." },
  { id: "sunhat", name: "Sun hat", tab: "everyday", slot: "head", layers: [{ glyph: "👒", top: -0.04, left: 0.28, size: 0.46 }], reaction: "Big hat, big shade, big mood." },
  { id: "scarf", name: "Scarf", tab: "everyday", slot: "neck", layers: [{ glyph: "🧣", top: 0.48, left: 0.28, size: 0.46 }], reaction: "Scarf season. I'm 90% scarf, 10% bird." },
  { id: "glasses", name: "Nerd glasses", tab: "everyday", slot: "eyes", layers: [{ glyph: "👓", top: 0.22, left: 0.3, size: 0.4 }], reaction: "Glasses = instant +5 intelligence. I can feel it." },
  { id: "hoodie", name: "Hoodie", tab: "everyday", slot: "body", layers: [{ glyph: "🧥", top: 0.5, left: 0.28, size: 0.5 }], reaction: "Hood up. Do not perceive me. I'm in my era." },
  { id: "backpack", name: "Backpack", tab: "everyday", slot: "back", layers: [{ glyph: "🎒", top: 0.4, left: 0.05, size: 0.4, z: 1 }], reaction: "Backpack loaded. Snacks: yes. Books: questionable." },
  { id: "raincoat", name: "Raincoat", tab: "everyday", slot: "body", layers: [{ glyph: "🧥", top: 0.5, left: 0.28, size: 0.5 }], reaction: "Splish splash, I'm weatherproof and fabulous." },
  { id: "sneakers", name: "Sneakers", tab: "everyday", slot: "feet", layers: [{ glyph: "👟", top: 0.82, left: 0.3, size: 0.4 }], reaction: "Fresh kicks! Watch me strut, then sit back down." },

  /* ----------------------------- SILLY ----------------------------- */
  { id: "googly", name: "Googly eyes", tab: "silly", slot: "eyes", layers: [{ glyph: "👀", top: 0.18, left: 0.3, size: 0.46 }], reaction: "I can see EVERYTHING. Also nothing. Both at once." },
  { id: "mustache", name: "Tiny mustache", tab: "silly", slot: "eyes", layers: [{ glyph: "👨", top: 0.32, left: 0.32, size: 0.3 }], reaction: "I'm a distinguished gentle-bird now. Top of the morning." },
  { id: "cone-hat", name: "Traffic-cone hat", tab: "silly", slot: "head", layers: [{ glyph: "🚧", top: -0.06, left: 0.3, size: 0.44 }], reaction: "Caution: extremely fashionable bird ahead." },
  { id: "banana", name: "Banana costume", tab: "silly", slot: "body", layers: [{ glyph: "🍌", top: 0.45, left: 0.3, size: 0.5 }], reaction: "I am a banana. This is a peak life choice. No notes." },
  { id: "tinfoil", name: "Tin-foil hat", tab: "silly", slot: "head", layers: [{ glyph: "🎩", top: -0.06, left: 0.3, size: 0.44 }], reaction: "They can't read my thoughts now. (My thoughts are 'snack'.)" },
  { id: "tophat", name: "Top hat + monocle", tab: "silly", slot: "head", layers: [{ glyph: "🎩", top: -0.08, left: 0.3, size: 0.44 }, { glyph: "🧐", top: 0.22, left: 0.34, size: 0.3, z: 7 }], reaction: "Indeed. Quite. Most splendid. *sips imaginary tea*" },
  { id: "taco-hat", name: "Taco hat", tab: "silly", slot: "head", layers: [{ glyph: "🌮", top: -0.02, left: 0.3, size: 0.42 }], reaction: "It's Taco Tuesday in my heart every single day." },
  { id: "floatie", name: "Duck floatie", tab: "silly", slot: "body", layers: [{ glyph: "🛟", top: 0.45, left: 0.25, size: 0.5 }], reaction: "Safety first! Also I look ridiculous! Both true!" },

  /* -------------------------- OTHER / LIFE-STUFF -------------------------- */
  { id: "arm-cast", name: "Arm cast", tab: "other", slot: "held", layers: [{ glyph: "🦴", top: 0.5, left: 0.66, size: 0.34, rotate: 20, z: 8 }], reaction: "Sign my cast! Be the first! ...okay be the only." },
  { id: "bandage", name: "Bandage", tab: "other", slot: "head", layers: [{ glyph: "🩹", top: 0.2, left: 0.5, size: 0.26, z: 7 }], reaction: "Tiny boo-boo, huge bravery. I'm basically a hero." },
  { id: "eye-patch", name: "Eye patch", tab: "other", slot: "eyes", layers: [{ glyph: "🏴‍☠️", top: 0.22, left: 0.34, size: 0.3 }], reaction: "Arr. One eye, twice the attitude." },
  { id: "labcoat", name: "Lab coat", tab: "other", slot: "body", layers: [{ glyph: "🥼", top: 0.46, left: 0.26, size: 0.52 }], reaction: "Doctor Kiwi, PhD in being a very good bird." },
  { id: "chef", name: "Chef hat + apron", tab: "other", slot: "body", layers: [{ glyph: "🍳", top: 0.5, left: 0.66, size: 0.34, z: 8 }], setPieces: ["chef-hat"], reaction: "Bork appétit. I made seeds. They're seeds." },
  { id: "chef-hat", name: "Chef hat", tab: "other", slot: "head", layers: [{ glyph: "👨‍🍳", top: -0.04, left: 0.3, size: 0.42 }], reaction: "Five-star kitchen. Two-star cleanup." },
  { id: "grad-cap", name: "Grad cap", tab: "other", slot: "head", layers: [{ glyph: "🎓", top: -0.04, left: 0.3, size: 0.42 }], reaction: "Smartest bird alive. Diploma in worms. (kidding!)" },
  { id: "mittens", name: "Mittens", tab: "other", slot: "held", layers: [{ glyph: "🧤", top: 0.55, left: 0.66, size: 0.34, z: 8 }], reaction: "Toasty toes... wait, those are my hands. Toasty hands!" },

  /* ----------------------------- TRENDY / TEEN ----------------------------- */
  { id: "headphones", name: "Headphones", tab: "trendy", slot: "head", layers: [{ glyph: "🎧", top: 0.06, left: 0.28, size: 0.46 }], reaction: "Lowkey iconic. My playlist? Unreleased bird beats." },
  { id: "claw-clip", name: "Claw clip", tab: "trendy", slot: "head", layers: [{ glyph: "🦋", top: 0.0, left: 0.36, size: 0.28 }], reaction: "Claw clip secured. The 'effortless' look took 40 minutes." },
  { id: "bucket-hat", name: "Bucket hat", tab: "trendy", slot: "head", layers: [{ glyph: "🎩", top: -0.04, left: 0.3, size: 0.42 }], reaction: "Bucket hat? It ate. No crumbs left." },
  { id: "statement-shades", name: "Statement shades", tab: "trendy", slot: "eyes", layers: [{ glyph: "🕶️", top: 0.2, left: 0.3, size: 0.42 }], reaction: "These shades are doing the MOST and I respect it." },
  { id: "oversized-hoodie", name: "Oversized hoodie", tab: "trendy", slot: "body", layers: [{ glyph: "🧥", top: 0.48, left: 0.26, size: 0.54 }], reaction: "Comfy AND a serve. Main-character energy, no cap." },
  { id: "crossbody", name: "Mini crossbody bag", tab: "trendy", slot: "neck", layers: [{ glyph: "👜", top: 0.55, left: 0.34, size: 0.34 }], reaction: "Tiny bag, huge slay. It holds one (1) gummy." },
  { id: "bubble-tea", name: "Bubble tea", tab: "trendy", slot: "held", layers: [{ glyph: "🧋", top: 0.5, left: 0.7, size: 0.38, z: 8 }], reaction: "Boba in claw. We're thriving. We're that bird." },
  { id: "platforms", name: "Platform sneakers", tab: "trendy", slot: "feet", layers: [{ glyph: "👟", top: 0.8, left: 0.3, size: 0.44 }], reaction: "Platforms = taller bird = bigger slay. It's just facts." },

  /* --------------------- HALLOWEEN / COSTUME SETS --------------------- */
  // Decomposable sets. Each set lists the piece ids it equips. Pieces also
  // appear so Reagan can grab just one (e.g. just the horns, just the wings).
  { id: "set-angel", name: "Angel", tab: "halloween", slot: "head", isSet: true, setPieces: ["angel-halo", "angel-wings"], layers: [{ glyph: "😇", top: -0.06, left: 0.32, size: 0.4 }], reaction: "An absolute angel. (The teachers would beg to differ.)" },
  { id: "angel-halo", name: "Halo", tab: "halloween", slot: "head", layers: [{ glyph: "😇", top: -0.08, left: 0.34, size: 0.34 }], reaction: "Halo: on. Innocence: debatable." },
  { id: "angel-wings", name: "Angel wings", tab: "halloween", slot: "back", layers: [{ glyph: "🪽", top: 0.3, left: 0.08, size: 0.34, z: 1 }, { glyph: "🪽", top: 0.3, left: 0.6, size: 0.34, z: 1 }], reaction: "Heavenly. Do not let the halo fool you though." },
  // Stinky-gag angel variant (kept SEPARATE; Katy asked to confirm — both shipped).
  { id: "set-smelly-angel", name: "Smelly angel (gag)", tab: "halloween", slot: "head", isSet: true, setPieces: ["angel-halo", "angel-wings", "stink-lines"], layers: [{ glyph: "😇", top: -0.06, left: 0.32, size: 0.4 }], reaction: "An angel... that forgot to shower. Heavenly AND horrifying." },
  { id: "stink-lines", name: "Stink lines", tab: "halloween", slot: "back", layers: [{ glyph: "💨", top: 0.2, left: 0.62, size: 0.34, z: 9 }, { glyph: "🦨", top: 0.62, left: 0.62, size: 0.3, z: 9 }], reaction: "*sniff* ...who did that? It was me. It was definitely me." },
  { id: "set-devil", name: "Devil", tab: "halloween", slot: "head", isSet: true, setPieces: ["devil-horns", "devil-fork"], layers: [{ glyph: "😈", top: -0.04, left: 0.32, size: 0.42 }], reaction: "Lil' menace mode: ACTIVATED. Mwahaha." },
  { id: "devil-horns", name: "Devil horns", tab: "halloween", slot: "head", layers: [{ glyph: "😈", top: -0.06, left: 0.32, size: 0.4 }], reaction: "Just the horns. Just a little chaos. Very on brand." },
  { id: "devil-fork", name: "Pitchfork", tab: "halloween", slot: "held", layers: [{ glyph: "🔱", top: 0.45, left: 0.7, size: 0.4, z: 8 }], reaction: "Poke poke. I'm causing problems on purpose." },
  { id: "set-witch", name: "Witch", tab: "halloween", slot: "head", isSet: true, setPieces: ["witch-hat", "witch-broom"], layers: [{ glyph: "🧙‍♀️", top: -0.06, left: 0.3, size: 0.44 }], reaction: "Double, double, toil and... ooh is that a snack?" },
  { id: "witch-hat", name: "Witch hat", tab: "halloween", slot: "head", layers: [{ glyph: "🎩", top: -0.08, left: 0.3, size: 0.44 }], reaction: "Pointy hat, pointy attitude." },
  { id: "witch-broom", name: "Broom", tab: "halloween", slot: "held", layers: [{ glyph: "🧹", top: 0.4, left: 0.7, size: 0.44, z: 8 }], reaction: "I could fly this. I won't. But I could." },
  { id: "set-vampire", name: "Vampire", tab: "halloween", slot: "body", isSet: true, setPieces: ["vamp-cape", "vamp-fangs"], layers: [{ glyph: "🧛", top: 0.45, left: 0.3, size: 0.5 }], reaction: "I vant to suck your... juice box. Bleh bleh bleh." },
  { id: "vamp-cape", name: "Vampire cape", tab: "halloween", slot: "back", layers: [{ glyph: "🦇", top: 0.3, left: 0.55, size: 0.36, z: 1 }], reaction: "Cape: dramatic. Me: also dramatic." },
  { id: "vamp-fangs", name: "Fangs", tab: "halloween", slot: "eyes", layers: [{ glyph: "🧛", top: 0.3, left: 0.34, size: 0.3 }], reaction: "Fangs only. Spooky but make it cute." },
  { id: "set-pumpkin", name: "Pumpkin", tab: "halloween", slot: "body", isSet: true, setPieces: [], layers: [{ glyph: "🎃", top: 0.45, left: 0.28, size: 0.5 }], reaction: "I'm a gourd now. A very judgmental gourd." },
  { id: "set-ghost", name: "Ghost", tab: "halloween", slot: "body", isSet: true, setPieces: [], layers: [{ glyph: "👻", top: 0.4, left: 0.28, size: 0.52 }], reaction: "Boo! ...did I scare you? No? Rude." },
  { id: "set-superhero", name: "Superhero", tab: "halloween", slot: "body", isSet: true, setPieces: ["hero-cape", "hero-mask"], layers: [{ glyph: "🦸", top: 0.45, left: 0.3, size: 0.5 }], reaction: "Not all heroes wear capes. I do though. It's right here." },
  { id: "hero-cape", name: "Hero cape", tab: "halloween", slot: "back", layers: [{ glyph: "🟥", top: 0.32, left: 0.55, size: 0.34, z: 1 }], reaction: "Whoosh. The cape does ALL the work." },
  { id: "hero-mask", name: "Hero mask", tab: "halloween", slot: "eyes", layers: [{ glyph: "🦸", top: 0.28, left: 0.34, size: 0.3 }], reaction: "Secret identity: a bird. Shhh." },
  // Animated-character-style (generic, non-trademarked)
  { id: "set-unicorn", name: "Unicorn", tab: "halloween", slot: "head", isSet: true, setPieces: [], layers: [{ glyph: "🦄", top: -0.04, left: 0.3, size: 0.46 }], reaction: "Sparkles and a horn? Magical bird unlocked." },
  { id: "set-robot", name: "Robot", tab: "halloween", slot: "head", isSet: true, setPieces: [], layers: [{ glyph: "🤖", top: -0.02, left: 0.3, size: 0.44 }], reaction: "BEEP. BOOP. SQUAWK. SYSTEMS: ADORABLE." },
  { id: "set-mermaid", name: "Mermaid", tab: "halloween", slot: "body", isSet: true, setPieces: [], layers: [{ glyph: "🧜‍♀️", top: 0.45, left: 0.3, size: 0.5 }], reaction: "Half bird, half fish, full diva." },
  { id: "set-astronaut", name: "Astronaut", tab: "halloween", slot: "body", isSet: true, setPieces: [], layers: [{ glyph: "🧑‍🚀", top: 0.45, left: 0.3, size: 0.5 }], reaction: "One small hop for bird, one giant flap for bird-kind." },
  { id: "set-dino", name: "Dino hood", tab: "halloween", slot: "head", isSet: true, setPieces: [], layers: [{ glyph: "🦖", top: -0.04, left: 0.3, size: 0.46 }], reaction: "RAWR. That's 'I'm the cutest' in dinosaur." },
];

/* ============================ EQUIP ENGINE ============================ */

/** Equipped map: slot → itemId (one item per slot). */
export type Equipped = Partial<Record<WardrobeSlot, string>>;

export function getItem(id: string): WardrobeItem | undefined {
  return WARDROBE_ITEMS.find((i) => i.id === id);
}

export function itemsForTab(tab: WardrobeTab): WardrobeItem[] {
  return WARDROBE_ITEMS.filter((i) => i.tab === tab);
}

/**
 * Equip an item. One-per-slot: the new item replaces whatever was in its slot.
 * If the item is a costume SET, every piece is equipped into its own slot
 * (also one-per-slot), so a set can overwrite multiple slots at once.
 */
export function equipItem(equipped: Equipped, id: string): Equipped {
  const item = getItem(id);
  if (!item) return equipped;
  const next: Equipped = { ...equipped };
  if (item.isSet && item.setPieces && item.setPieces.length > 0) {
    for (const pieceId of item.setPieces) {
      const piece = getItem(pieceId);
      if (piece) next[piece.slot] = piece.id;
    }
    // The set's own glyph also occupies its declared slot (e.g. the face emoji).
    next[item.slot] = item.id;
  } else {
    next[item.slot] = item.id;
  }
  return next;
}

/** Remove a single equipped item by its slot (per-piece removal only). */
export function removeSlot(equipped: Equipped, slot: WardrobeSlot): Equipped {
  const next: Equipped = { ...equipped };
  delete next[slot];
  return next;
}

/** Remove a single equipped item by its id (finds its slot). */
export function removeItemById(equipped: Equipped, id: string): Equipped {
  const next: Equipped = { ...equipped };
  for (const slot of WARDROBE_SLOTS) {
    if (next[slot] === id) delete next[slot];
  }
  return next;
}

/** Take off everything. */
export function clearAll(): Equipped {
  return {};
}

/** All glyph layers for the currently equipped outfit, sorted by z. */
export function equippedLayers(equipped: Equipped): GlyphLayer[] {
  const layers: GlyphLayer[] = [];
  for (const slot of WARDROBE_SLOTS) {
    const id = equipped[slot];
    if (!id) continue;
    const item = getItem(id);
    if (!item) continue;
    layers.push(...item.layers);
  }
  return layers.sort((a, b) => (a.z ?? 5) - (b.z ?? 5));
}

/** The equipped items as a list (for the "equipped" panel with per-item remove). */
export function equippedItems(equipped: Equipped): WardrobeItem[] {
  const out: WardrobeItem[] = [];
  for (const slot of WARDROBE_SLOTS) {
    const id = equipped[slot];
    if (!id) continue;
    const item = getItem(id);
    if (item) out.push(item);
  }
  return out;
}

/** Deterministic "surprise me" using a seed (testable). */
export function surpriseMe(seed: number): Equipped {
  // Pick a random item for a handful of slots so it always looks like an outfit.
  const pickSlots: WardrobeSlot[] = ["head", "eyes", "body", "feet", "held"];
  let s = seed >>> 0;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const next: Equipped = {};
  for (const slot of pickSlots) {
    const opts = WARDROBE_ITEMS.filter((i) => i.slot === slot && !i.isSet);
    if (opts.length === 0) continue;
    // ~70% chance to fill each slot so outfits vary.
    if (rng() < 0.7) {
      const pick = opts[Math.floor(rng() * opts.length)]!;
      next[pick.slot] = pick.id;
    }
  }
  return next;
}

/**
 * Kiwi's reaction to the most recently equipped item (its own line), or a
 * general line when the outfit changed/cleared. Used by the closet + idle bank.
 */
export function reactionFor(id: string | null): string {
  if (!id) return "Naked bird! Free and fabulous. Brrr though.";
  const item = getItem(id);
  return item?.reaction ?? "Ooh, a new look! I'm into it.";
}

/** Persisted opinion lines about an outfit that carried over to a new day. */
export const KIWI_OUTFIT_PERSIST_LINES: string[] = [
  "Still rocking yesterday's fit, huh? Bold. Iconic, even.",
  "Day two of this outfit. We're committed now. No takebacks.",
  "I slept in this. Worth it. Look at me.",
  "Yesterday's look walked so today's look could strut.",
];

/** General lines when Reagan strips Kiwi back down to nothing. */
export const KIWI_OUTFIT_CLEAR_LINES: string[] = [
  "Back to classic Kiwi. A natural beauty, honestly.",
  "Outfit: deleted. Confidence: untouched.",
  "Minimalist era. Just me, myself, and my feathers.",
];

/** Generic "I'm loving this fit" lines mixed into idle chatter when dressed. */
export const KIWI_OUTFIT_LOVE_LINES: string[] = [
  "Not to brag, but this fit is doing the absolute most.",
  "Every angle? Iconic. I checked.",
  "I'd strut more but I'm conserving my fabulousness.",
  "Mirror, mirror — yep, still the cutest bird.",
  "This outfit has range. Like me.",
];

/**
 * Pick an outfit opinion for the live perch. Reads the persisted outfit + the
 * day it was last saved. If the same outfit has carried into a NEW day, Kiwi
 * comments on the carry-over; otherwise she riffs on a currently-worn piece or
 * drops a generic love line. Returns null when she has nothing to wear.
 *
 * `now` injectable for tests.
 */
export function pickOutfitOpinion(now: number = Date.now()): string | null {
  let equipped: Equipped = {};
  let savedAt = 0;
  try {
    const raw = localStorage.getItem("kiwi_outfit_v1");
    equipped = raw ? (JSON.parse(raw) as Equipped) : {};
    const sa = localStorage.getItem("kiwi_outfit_savedAt");
    savedAt = sa ? parseInt(sa, 10) : 0;
  } catch {
    return null;
  }
  const items = equippedItems(equipped);
  if (items.length === 0) return null;

  // Carried into a new calendar day since it was saved? → persist comment.
  if (savedAt > 0) {
    const savedDay = new Date(savedAt);
    const today = new Date(now);
    const differentDay =
      savedDay.getFullYear() !== today.getFullYear() ||
      savedDay.getMonth() !== today.getMonth() ||
      savedDay.getDate() !== today.getDate();
    if (differentDay && Math.random() < 0.5) {
      return KIWI_OUTFIT_PERSIST_LINES[
        Math.floor(Math.random() * KIWI_OUTFIT_PERSIST_LINES.length)
      ]!;
    }
  }

  // Otherwise: half the time riff on a specific worn piece, half generic love.
  if (Math.random() < 0.5) {
    const pick = items[Math.floor(Math.random() * items.length)]!;
    return pick.reaction;
  }
  return KIWI_OUTFIT_LOVE_LINES[
    Math.floor(Math.random() * KIWI_OUTFIT_LOVE_LINES.length)
  ]!;
}

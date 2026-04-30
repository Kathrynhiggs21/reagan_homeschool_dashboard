/**
 * Ohio 5th-grade Learning Standards, expressed in the order Indian Hill 5th
 * grade actually paces them. Codes on chips follow IH/EnVision textbook
 * conventions (e.g. "Math 7-4") so tutors and parents can cross-reference
 * the physical workbook. The `standardRef` column carries the matching Ohio
 * state code (e.g. "5.NBT.A.1") for official IEP / report-card alignment.
 *
 * parentCode: when present, links a child row to its parent's `code`. After
 * seed insert we resolve those to parent IDs.
 */
export type SeedRow = {
  subject: "Math" | "ELA" | "Science" | "Social" | "Specials";
  code: string;
  title: string;
  standardRef?: string;
  parentCode?: string;
  quarter?: "Q1" | "Q2" | "Q3" | "Q4";
};

const MATH: SeedRow[] = [
  // EnVision 5 — 16 topics, IH pacing
  { subject: "Math", code: "Math 1",    title: "Topic 1 — Understand Place Value",                               standardRef: "5.NBT.A.1", quarter: "Q1" },
  { subject: "Math", code: "Math 1-1",  title: "Patterns with Exponents and Powers of 10",                        standardRef: "5.NBT.A.2", parentCode: "Math 1", quarter: "Q1" },
  { subject: "Math", code: "Math 1-2",  title: "Read and Write Decimals to Thousandths",                          standardRef: "5.NBT.A.3.a", parentCode: "Math 1", quarter: "Q1" },
  { subject: "Math", code: "Math 1-3",  title: "Compare Decimals to Thousandths",                                 standardRef: "5.NBT.A.3.b", parentCode: "Math 1", quarter: "Q1" },
  { subject: "Math", code: "Math 1-4",  title: "Round Decimals to Any Place",                                     standardRef: "5.NBT.A.4", parentCode: "Math 1", quarter: "Q1" },

  { subject: "Math", code: "Math 2",    title: "Topic 2 — Use Models and Strategies to Add and Subtract Decimals", standardRef: "5.NBT.B.7", quarter: "Q1" },
  { subject: "Math", code: "Math 2-1",  title: "Mental Math with Decimals",                                        parentCode: "Math 2", quarter: "Q1" },
  { subject: "Math", code: "Math 2-2",  title: "Estimate Sums and Differences of Decimals",                         parentCode: "Math 2", quarter: "Q1" },
  { subject: "Math", code: "Math 2-3",  title: "Add and Subtract Decimals (standard algorithm)",                    parentCode: "Math 2", quarter: "Q1" },

  { subject: "Math", code: "Math 3",    title: "Topic 3 — Fluently Multiply Multi-Digit Whole Numbers",             standardRef: "5.NBT.B.5", quarter: "Q1" },
  { subject: "Math", code: "Math 3-1",  title: "Multiply Greater Numbers by Powers of 10",                           standardRef: "5.NBT.A.2", parentCode: "Math 3", quarter: "Q1" },
  { subject: "Math", code: "Math 3-2",  title: "Estimate Products",                                                  parentCode: "Math 3", quarter: "Q1" },
  { subject: "Math", code: "Math 3-3",  title: "Multiply 2- by 2-Digit Numbers",                                     parentCode: "Math 3", quarter: "Q1" },
  { subject: "Math", code: "Math 3-4",  title: "Multiply 3- by 2-Digit Numbers",                                     parentCode: "Math 3", quarter: "Q1" },
  { subject: "Math", code: "Math 3-5",  title: "Multiply by Multi-Digit Numbers",                                    parentCode: "Math 3", quarter: "Q2" },

  { subject: "Math", code: "Math 4",    title: "Topic 4 — Use Models and Strategies to Multiply Decimals",           standardRef: "5.NBT.B.7", quarter: "Q2" },
  { subject: "Math", code: "Math 4-1",  title: "Multiply Decimals by Powers of 10",                                  parentCode: "Math 4", quarter: "Q2" },
  { subject: "Math", code: "Math 4-2",  title: "Estimate the Product of a Decimal and a Whole Number",               parentCode: "Math 4", quarter: "Q2" },
  { subject: "Math", code: "Math 4-3",  title: "Multiply a Decimal by a Whole Number",                               parentCode: "Math 4", quarter: "Q2" },
  { subject: "Math", code: "Math 4-4",  title: "Multiply a Decimal by a Decimal",                                    parentCode: "Math 4", quarter: "Q2" },

  { subject: "Math", code: "Math 5",    title: "Topic 5 — Use Models and Strategies to Divide Whole Numbers",        standardRef: "5.NBT.B.6", quarter: "Q2" },
  { subject: "Math", code: "Math 5-1",  title: "Use Patterns to Divide",                                             parentCode: "Math 5", quarter: "Q2" },
  { subject: "Math", code: "Math 5-2",  title: "Estimate Quotients with 2-Digit Divisors",                           parentCode: "Math 5", quarter: "Q2" },
  { subject: "Math", code: "Math 5-3",  title: "Divide by Multiples of 10",                                          parentCode: "Math 5", quarter: "Q2" },
  { subject: "Math", code: "Math 5-4",  title: "Divide by 2-Digit Divisors",                                         parentCode: "Math 5", quarter: "Q2" },

  { subject: "Math", code: "Math 6",    title: "Topic 6 — Use Models and Strategies to Divide Decimals",             standardRef: "5.NBT.B.7", quarter: "Q2" },
  { subject: "Math", code: "Math 6-1",  title: "Patterns for Dividing with Decimals",                                parentCode: "Math 6", quarter: "Q2" },
  { subject: "Math", code: "Math 6-2",  title: "Estimate Decimal Quotients",                                         parentCode: "Math 6", quarter: "Q2" },
  { subject: "Math", code: "Math 6-3",  title: "Divide a Decimal by a Whole Number",                                 parentCode: "Math 6", quarter: "Q2" },
  { subject: "Math", code: "Math 6-4",  title: "Divide by a Decimal",                                                parentCode: "Math 6", quarter: "Q2" },

  { subject: "Math", code: "Math 7",    title: "Topic 7 — Use Equivalent Fractions to Add and Subtract Fractions",   standardRef: "5.NF.A.1", quarter: "Q3" },
  { subject: "Math", code: "Math 7-1",  title: "Estimate Sums and Differences of Fractions",                         parentCode: "Math 7", quarter: "Q3" },
  { subject: "Math", code: "Math 7-2",  title: "Find Common Denominators",                                           parentCode: "Math 7", quarter: "Q3" },
  { subject: "Math", code: "Math 7-3",  title: "Add Fractions with Unlike Denominators",                             parentCode: "Math 7", quarter: "Q3" },
  { subject: "Math", code: "Math 7-4",  title: "Subtract Fractions with Unlike Denominators",                        parentCode: "Math 7", quarter: "Q3" },
  { subject: "Math", code: "Math 7-5",  title: "Add and Subtract Mixed Numbers",                                     standardRef: "5.NF.A.2", parentCode: "Math 7", quarter: "Q3" },

  { subject: "Math", code: "Math 8",    title: "Topic 8 — Apply Understanding of Multiplication to Multiply Fractions", standardRef: "5.NF.B.4", quarter: "Q3" },
  { subject: "Math", code: "Math 8-1",  title: "Multiply a Fraction by a Whole Number",                              parentCode: "Math 8", quarter: "Q3" },
  { subject: "Math", code: "Math 8-2",  title: "Multiply a Whole Number by a Fraction",                              parentCode: "Math 8", quarter: "Q3" },
  { subject: "Math", code: "Math 8-3",  title: "Multiply Fractions",                                                 parentCode: "Math 8", quarter: "Q3" },
  { subject: "Math", code: "Math 8-4",  title: "Area of Rectangles with Fractional Side Lengths",                    standardRef: "5.NF.B.4.b", parentCode: "Math 8", quarter: "Q3" },

  { subject: "Math", code: "Math 9",    title: "Topic 9 — Apply Understanding of Division to Divide Fractions",      standardRef: "5.NF.B.7", quarter: "Q3" },
  { subject: "Math", code: "Math 9-1",  title: "Divide a Whole Number by a Unit Fraction",                           parentCode: "Math 9", quarter: "Q3" },
  { subject: "Math", code: "Math 9-2",  title: "Divide a Unit Fraction by a Whole Number",                           parentCode: "Math 9", quarter: "Q3" },

  { subject: "Math", code: "Math 10",   title: "Topic 10 — Represent and Interpret Data",                             standardRef: "5.MD.B.2", quarter: "Q4" },
  { subject: "Math", code: "Math 10-1", title: "Analyze Line Plots",                                                  parentCode: "Math 10", quarter: "Q4" },
  { subject: "Math", code: "Math 10-2", title: "Make Line Plots",                                                     parentCode: "Math 10", quarter: "Q4" },

  { subject: "Math", code: "Math 11",   title: "Topic 11 — Understand Volume Concepts",                                standardRef: "5.MD.C.3", quarter: "Q4" },
  { subject: "Math", code: "Math 11-1", title: "Volume Using Unit Cubes",                                              standardRef: "5.MD.C.4", parentCode: "Math 11", quarter: "Q4" },
  { subject: "Math", code: "Math 11-2", title: "Volume Formulas for Rectangular Prisms",                                standardRef: "5.MD.C.5", parentCode: "Math 11", quarter: "Q4" },

  { subject: "Math", code: "Math 12",   title: "Topic 12 — Convert Measurements",                                      standardRef: "5.MD.A.1", quarter: "Q4" },
  { subject: "Math", code: "Math 12-1", title: "Convert Customary Units of Length / Capacity / Weight",                parentCode: "Math 12", quarter: "Q4" },
  { subject: "Math", code: "Math 12-2", title: "Convert Metric Units of Length / Capacity / Mass",                     parentCode: "Math 12", quarter: "Q4" },

  { subject: "Math", code: "Math 13",   title: "Topic 13 — Write and Interpret Numerical Expressions",                  standardRef: "5.OA.A.1", quarter: "Q4" },
  { subject: "Math", code: "Math 13-1", title: "Order of Operations",                                                   parentCode: "Math 13", quarter: "Q4" },
  { subject: "Math", code: "Math 13-2", title: "Evaluate Expressions",                                                  standardRef: "5.OA.A.2", parentCode: "Math 13", quarter: "Q4" },

  { subject: "Math", code: "Math 14",   title: "Topic 14 — Graph Points on the Coordinate Plane",                       standardRef: "5.G.A.1", quarter: "Q4" },
  { subject: "Math", code: "Math 14-1", title: "Identify Ordered Pairs",                                                parentCode: "Math 14", quarter: "Q4" },
  { subject: "Math", code: "Math 14-2", title: "Solve Problems Using Ordered Pairs",                                    standardRef: "5.G.A.2", parentCode: "Math 14", quarter: "Q4" },

  { subject: "Math", code: "Math 15",   title: "Topic 15 — Algebra: Analyze Patterns and Relationships",                standardRef: "5.OA.B.3", quarter: "Q4" },
  { subject: "Math", code: "Math 16",   title: "Topic 16 — Classify Two-Dimensional Figures",                           standardRef: "5.G.B.3", quarter: "Q4" },
];

const ELA: SeedRow[] = [
  // Wit & Wisdom — 4 modules typical for grade 5, IH uses 5
  { subject: "ELA", code: "ELA M1",    title: "Module 1 — Cultures in Conflict", quarter: "Q1" },
  { subject: "ELA", code: "ELA M1-L1", title: "Determine a theme from text details",                 standardRef: "5.RL.2",   parentCode: "ELA M1", quarter: "Q1" },
  { subject: "ELA", code: "ELA M1-L2", title: "Quote accurately to support inferences",              standardRef: "5.RL.1",   parentCode: "ELA M1", quarter: "Q1" },
  { subject: "ELA", code: "ELA M1-L3", title: "Compare two characters' points of view",              standardRef: "5.RL.6",   parentCode: "ELA M1", quarter: "Q1" },
  { subject: "ELA", code: "ELA M1-L4", title: "Write an opinion piece with reasons",                 standardRef: "5.W.1",    parentCode: "ELA M1", quarter: "Q1" },

  { subject: "ELA", code: "ELA M2",    title: "Module 2 — Word Play", quarter: "Q2" },
  { subject: "ELA", code: "ELA M2-L1", title: "Figurative language and word choice",                 standardRef: "5.L.5",    parentCode: "ELA M2", quarter: "Q2" },
  { subject: "ELA", code: "ELA M2-L2", title: "Summarize the text",                                  standardRef: "5.RL.2",   parentCode: "ELA M2", quarter: "Q2" },
  { subject: "ELA", code: "ELA M2-L3", title: "Informative / explanatory writing",                   standardRef: "5.W.2",    parentCode: "ELA M2", quarter: "Q2" },

  { subject: "ELA", code: "ELA M3",    title: "Module 3 — A War Between Us", quarter: "Q3" },
  { subject: "ELA", code: "ELA M3-L1", title: "Integrate information from several texts",            standardRef: "5.RI.9",   parentCode: "ELA M3", quarter: "Q3" },
  { subject: "ELA", code: "ELA M3-L2", title: "Draw evidence from texts to support analysis",         standardRef: "5.W.9",    parentCode: "ELA M3", quarter: "Q3" },
  { subject: "ELA", code: "ELA M3-L3", title: "Write a narrative with dialogue and description",      standardRef: "5.W.3",    parentCode: "ELA M3", quarter: "Q3" },

  { subject: "ELA", code: "ELA M4",    title: "Module 4 — Breaking Barriers", quarter: "Q4" },
  { subject: "ELA", code: "ELA M4-L1", title: "Use context to determine word meaning",               standardRef: "5.L.4",    parentCode: "ELA M4", quarter: "Q4" },
  { subject: "ELA", code: "ELA M4-L2", title: "Research project using multiple sources",             standardRef: "5.W.7",    parentCode: "ELA M4", quarter: "Q4" },
  { subject: "ELA", code: "ELA M4-L3", title: "Speaking and listening: present findings",             standardRef: "5.SL.4",   parentCode: "ELA M4", quarter: "Q4" },
];

const SCI: SeedRow[] = [
  // Ohio 5th grade science: Cycles & Patterns in the Solar System, Cycles of Matter
  // & Flow of Energy, Light/Sound & Energy transformations
  { subject: "Science", code: "Sci 1",   title: "Unit 1 — Cycles and Patterns in the Solar System", standardRef: "5-ESS1-1", quarter: "Q1" },
  { subject: "Science", code: "Sci 1-1", title: "Sun, Earth, Moon system and day/night",             standardRef: "5-ESS1-2", parentCode: "Sci 1", quarter: "Q1" },
  { subject: "Science", code: "Sci 1-2", title: "Gravity pulls objects toward Earth's center",        standardRef: "5-PS2-1",  parentCode: "Sci 1", quarter: "Q1" },

  { subject: "Science", code: "Sci 2",   title: "Unit 2 — Cycles of Matter and Flow of Energy",       standardRef: "5-LS1-1",  quarter: "Q2" },
  { subject: "Science", code: "Sci 2-1", title: "Plants get most of their material from the air + water", standardRef: "5-LS1-1", parentCode: "Sci 2", quarter: "Q2" },
  { subject: "Science", code: "Sci 2-2", title: "Food webs: producers, consumers, decomposers",       standardRef: "5-LS2-1",  parentCode: "Sci 2", quarter: "Q2" },

  { subject: "Science", code: "Sci 3",   title: "Unit 3 — Earth's Systems and Water",                 standardRef: "5-ESS2-1", quarter: "Q3" },
  { subject: "Science", code: "Sci 3-1", title: "Geosphere / hydrosphere / atmosphere / biosphere",   standardRef: "5-ESS2-1", parentCode: "Sci 3", quarter: "Q3" },
  { subject: "Science", code: "Sci 3-2", title: "Distribution of water on Earth",                     standardRef: "5-ESS2-2", parentCode: "Sci 3", quarter: "Q3" },

  { subject: "Science", code: "Sci 4",   title: "Unit 4 — Matter and Its Interactions",               standardRef: "5-PS1-1",  quarter: "Q4" },
  { subject: "Science", code: "Sci 4-1", title: "Matter is made of particles too small to see",       standardRef: "5-PS1-1",  parentCode: "Sci 4", quarter: "Q4" },
  { subject: "Science", code: "Sci 4-2", title: "Conservation of matter in physical and chemical change", standardRef: "5-PS1-2", parentCode: "Sci 4", quarter: "Q4" },
];

const SS: SeedRow[] = [
  { subject: "Social", code: "SS 1",   title: "Unit 1 — Early Civilizations of the Western Hemisphere", standardRef: "5.HIS.2",  quarter: "Q1" },
  { subject: "Social", code: "SS 1-1", title: "Maya, Aztec, Inca civilizations",                         standardRef: "5.HIS.2",  parentCode: "SS 1", quarter: "Q1" },
  { subject: "Social", code: "SS 1-2", title: "North American indigenous cultures",                      standardRef: "5.HIS.3",  parentCode: "SS 1", quarter: "Q1" },

  { subject: "Social", code: "SS 2",   title: "Unit 2 — European Exploration and Colonization",          standardRef: "5.HIS.4",  quarter: "Q2" },
  { subject: "Social", code: "SS 2-1", title: "Reasons for European exploration",                        parentCode: "SS 2", quarter: "Q2" },
  { subject: "Social", code: "SS 2-2", title: "Columbian Exchange: biological and cultural impact",      parentCode: "SS 2", quarter: "Q2" },

  { subject: "Social", code: "SS 3",   title: "Unit 3 — Geography of the Western Hemisphere",            standardRef: "5.GEO.4",  quarter: "Q3" },
  { subject: "Social", code: "SS 3-1", title: "Physical and political maps",                             standardRef: "5.GEO.4",  parentCode: "SS 3", quarter: "Q3" },
  { subject: "Social", code: "SS 3-2", title: "Regions of North, Central, South America",                standardRef: "5.GEO.5",  parentCode: "SS 3", quarter: "Q3" },

  { subject: "Social", code: "SS 4",   title: "Unit 4 — Government and Economics",                       standardRef: "5.GOV.9",  quarter: "Q4" },
  { subject: "Social", code: "SS 4-1", title: "Purpose and structure of government",                     standardRef: "5.GOV.9",  parentCode: "SS 4", quarter: "Q4" },
  { subject: "Social", code: "SS 4-2", title: "Scarcity, trade, and economic choices",                   standardRef: "5.ECO.15", parentCode: "SS 4", quarter: "Q4" },
];

const SPEC: SeedRow[] = [
  { subject: "Specials", code: "PE-1",  title: "Cooperative movement & games", quarter: "Q1" },
  { subject: "Specials", code: "PE-2",  title: "Cardio endurance and fitness concepts", quarter: "Q2" },
  { subject: "Specials", code: "PE-3",  title: "Skill-based ball sports (volleyball, basketball)", quarter: "Q3" },
  { subject: "Specials", code: "Art-1", title: "Line, shape, and value", quarter: "Q1" },
  { subject: "Specials", code: "Art-2", title: "Color theory and mixing", quarter: "Q2" },
  { subject: "Specials", code: "Art-3", title: "Cultural art studies", quarter: "Q3" },
  { subject: "Specials", code: "Mus-1", title: "Rhythm, meter, and notation", quarter: "Q1" },
  { subject: "Specials", code: "Mus-2", title: "Melody and harmony: reading the staff", quarter: "Q2" },
  { subject: "Specials", code: "Tech-1", title: "Digital citizenship: safe & respectful online", quarter: "Q1" },
  { subject: "Specials", code: "Tech-2", title: "Keyboarding proficiency", quarter: "Q2" },
];

export const CURRICULUM_SEED: SeedRow[] = [...MATH, ...ELA, ...SCI, ...SS, ...SPEC];

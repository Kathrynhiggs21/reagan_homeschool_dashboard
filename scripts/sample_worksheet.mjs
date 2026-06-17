// Render a sample worksheet PDF (all activity kinds) + separate answer key.
import { writeFileSync } from "node:fs";
const { renderWorksheetPdfBuffer, renderAnswerKeyPdfBuffer } = await import("../server/_lib/worksheetPdf.ts?v=" + Date.now());
const content = {
  title: "5th Grade Vocabulary & Reading",
  intro: "Read carefully and answer each part. Take your time and do your best!",
  subjectSlug: "ela",
  sections: [
    { heading: "Part 1 — Vocabulary Match",
      instructions: "Draw a line between the word and the correct definition.",
      wordBank: ["conduct", "evident", "passage", "concept", "league"],
      items: [ { id: "m1", kind: "matching", prompt: "Match each word to its meaning.",
        pairs: [ { left: "conduct", right: "to lead or guide" }, { left: "evident", right: "easily seen or obvious" }, { left: "passage", right: "a short section of a text" }, { left: "concept", right: "a general idea" }, { left: "league", right: "a group of teams" } ] } ] },
    { heading: "Part 2 — Word Scramble",
      instructions: "Unscramble the snow words. Write the correct word on the line.",
      items: [ { id: "s1", kind: "scramble", prompt: "b o s n a r d w g i n", answer: "snowboarding" }, { id: "s2", kind: "scramble", prompt: "o w s n a m n", answer: "snowman" }, { id: "s3", kind: "scramble", prompt: "o w a k e f l s n", answer: "snowflake" } ] },
    { heading: "Part 3 — Choose the Correct Word",
      instructions: "Circle or write the correct homophone in each sentence.",
      items: [ { id: "f1", kind: "fillblank", prompt: "She is kneading the ____ (doe / dough) to make a loaf of ____ (bread / bred).", answer: "dough; bread" }, { id: "f2", kind: "fillblank", prompt: "Can you ____ (mail / male) the party invites to me?", answer: "mail" } ] },
    { heading: "Part 4 — Reading Comprehension",
      instructions: "Read the passage, then answer the questions below.",
      items: [ { id: "rp", kind: "passage", prompt: "The Curious Caterpillar — Once upon a time, a curious caterpillar named Charlie loved exploring the world around him. Charlie wanted to discover what was on top of the tall tree at the edge of the garden. So one bright morning, he began to climb, determined to see the whole garden from above." }, { id: "r1", kind: "short", prompt: "What is the name of the main character?", answer: "Charlie" }, { id: "r2", kind: "mc", prompt: "What did Charlie want to discover?", choices: ["What was under a rock", "What was on top of the tall tree", "Where the river started"], answer: "What was on top of the tall tree" }, { id: "r3", kind: "long", prompt: "Why do you think Charlie was so curious? Explain.", lines: 3 } ] },
  ],
};
const buf = await renderWorksheetPdfBuffer(content, { dateLabel: "Jun 18, 2026", footerNote: "Reagan's Homeschool — 5th Grade ELA" });
writeFileSync("/home/ubuntu/ws_sample.pdf", buf);
console.log("worksheet", buf.length, "bytes");
const keyP = renderAnswerKeyPdfBuffer(content, { dateLabel: "Jun 18, 2026" });
if (keyP) { const kb = await keyP; writeFileSync("/home/ubuntu/ws_key.pdf", kb); console.log("key", kb.length, "bytes"); }

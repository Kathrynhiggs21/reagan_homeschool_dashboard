// Dev-only: render a sample worksheet PDF with the CURRENT renderer so we can
// visually inspect margins / answer space / full-page distribution.
import { writeFileSync } from "node:fs";
import { renderWorksheetPdfBuffer } from "../_lib/worksheetPdf.ts";

const content = {
  title: "Fractions on a Number Line",
  subjectSlug: "math",
  intro: "Let's place fractions where they belong and explain our thinking. Take your time and show your work!",
  bookRef: "Spectrum Math Grade 5, pg. 42",
  sections: [
    {
      heading: "Warm Up",
      instructions: "Write each fraction in the box, then mark it on the number line.",
      wordBank: ["1/2", "1/4", "3/4", "2/3", "5/6"],
      items: [
        { kind: "short", prompt: "Which fraction is closest to one whole? Explain how you know." },
        { kind: "short", prompt: "Write a fraction that is smaller than 1/2 and tell why." },
        { kind: "mc", prompt: "Which point shows 3/4?", choices: ["A", "B", "C", "D"] },
      ],
    },
    {
      heading: "Practice",
      instructions: "Solve each problem. Use the answer box to show your work.",
      items: [
        { kind: "long", prompt: "Reagan walked 2/3 of a mile, then 1/6 more. How far did she walk in all? Show your work." },
        { kind: "matching", prompt: "Match each fraction to its picture.", pairs: [
          { left: "1/2", right: "two equal parts shaded one" },
          { left: "1/3", right: "three equal parts shaded one" },
          { left: "1/4", right: "four equal parts shaded one" },
        ] },
      ],
    },
  ],
};

const buf = await renderWorksheetPdfBuffer(content, { dateLabel: "Fri, Jun 19", footerNote: "Done? Tap Scan & Submit." });
writeFileSync("/home/ubuntu/sample_worksheet_current.pdf", buf);
console.log("wrote /home/ubuntu/sample_worksheet_current.pdf", buf.length, "bytes");

/**
 * probe-llm-finder.ts — manual smoke test for the new LLM-backed finder.
 * Run with: npx tsx -r dotenv/config scripts/probe-llm-finder.ts
 */
import "dotenv/config";
import { llmFindAssignments } from "../server/_lib/llmAssignmentFinder";

async function main() {
  const queries = [
    { q: "Make Line Plots Grade 5", subject: "math" },
    { q: "Context Clues 5th Grade", subject: "ela" },
    { q: "Scarcity and Trade 5th Grade Social Studies", subject: "ss" },
  ];
  for (const { q, subject } of queries) {
    console.log("\n=== Query:", q, "(subject:", subject, ") ===");
    const results = await llmFindAssignments({ query: q, subjectSlug: subject });
    console.log(`Got ${results.length} items`);
    results.forEach((r, i) => {
      console.log(`\n[${i + 1}] ${r.title}`);
      console.log(`    URL: ${r.url}`);
      console.log(`    Type: ${r.type} | Subject: ${r.subjectSlug} | Topic: ${r.topicCode}`);
      console.log(`    Grade: ${r.gradeLabel} (fit=${r.gradeFit}, review=${r.gradeNeedsReview})`);
      console.log(`    Tier: ${r.allowlistTier} | Preview: ${r.requiresAdultPreview}`);
      console.log(`    Snippet: ${r.snippet}`);
    });
  }
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});

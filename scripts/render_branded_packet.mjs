// Render the CURRENT branded daily agenda/packet PDF for a given date,
// using the same assembler + builder the live nightly email uses.
import { writeFileSync } from "node:fs";

const forDate = process.argv[2] || "2026-06-19";

const { assembleAgendaForDate } = await import("../server/_lib/agendaAssembler.ts?v=" + Date.now());
const { buildAgendaPdf } = await import("../server/_lib/agendaPdf.ts?v=" + Date.now());

const payload = await assembleAgendaForDate(forDate);
if (!payload) {
  console.error("No plan for", forDate);
  process.exit(2);
}
const { pdfBuffer } = await buildAgendaPdf(payload);
const out = `/home/ubuntu/reagan_manual/artifacts/daily_packet_branded_${forDate}.pdf`;
writeFileSync(out, pdfBuffer);
console.log("branded packet", pdfBuffer.length, "bytes ->", out);

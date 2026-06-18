// Early packet test — assembles tomorrow's agenda exactly like the nightly job,
// runs the packet audit, and writes the PDF to disk for inspection.
// Does NOT send any email (safe to run anytime).
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Use tsx to import the TS modules directly.
const forDate = process.argv[2] || "2026-06-18";

const { assembleAgendaForDate } = await import("../server/_lib/agendaAssembler.ts");
const { buildAgendaPdf } = await import("../server/_lib/agendaPdf.ts");
const fs = await import("node:fs");

console.log(`\n=== Packet test for ${forDate} ===`);
const payload = await assembleAgendaForDate(forDate);
if (!payload) {
  console.error("NO PLAN for this date — assembler returned null.");
  process.exit(1);
}

console.log(`Student: ${payload.studentName} | ${payload.dayLabel}`);
console.log(`Blocks: ${payload.blocks.length}`);
console.log(`School-day window: ${payload.schoolDayWindow ? payload.schoolDayWindow.start + ' - ' + payload.schoolDayWindow.end : '(none)'}`);
for (const b of payload.blocks) {
  console.log(
    `  #${b.sortOrder} @${b.startTime ?? "flex"} ${b.durationMin}m [${b.subjectName ?? "-"}] ${b.title}` +
      ` (worksheets=${b.lesson?.worksheets?.length ?? 0}, videos=${b.lesson?.videos?.length ?? 0})`,
  );
}

const audit = payload.packetAudit;
console.log(`\n--- Packet audit ---`);
if (!audit) {
  console.log("audit: (none computed)");
} else {
  console.log(`ok=${audit.ok} totalBlocks=${audit.totalBlocks} contentBlocks=${audit.contentBlocks} empty=${audit.emptyBlocks.length}`);
  for (const e of audit.emptyBlocks) {
    console.log(`  EMPTY → #${e.sortOrder} ${e.title}`);
  }
}

console.log(`\n--- Building PDF ---`);
const { pdfBuffer, agendaHash } = await buildAgendaPdf(payload);
const out = `/home/ubuntu/reagan_homeschool_dashboard/scripts/packet-${forDate}.pdf`;
fs.writeFileSync(out, pdfBuffer);
console.log(`PDF written: ${out} (${pdfBuffer.length} bytes) hash=${agendaHash.slice(0, 16)}`);
console.log(`\nDONE.`);

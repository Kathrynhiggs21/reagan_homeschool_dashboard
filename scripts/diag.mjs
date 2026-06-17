import { writeFileSync } from "node:fs";
const mod = await import("../server/_lib/worksheetPdf.ts?v=" + Date.now());
// monkeypatch via PDFDocument is internal; instead just render and count using a hook env
process.env.WS_DIAG = "1";
const content = {
  title: "Diag", subjectSlug: "ela",
  sections: [ { heading: "P1", items: [ { id:"a", kind:"short", prompt:"Q1?"} ] } ],
};
const buf = await mod.renderWorksheetPdfBuffer(content, { withAnswerKey: false });
writeFileSync("/home/ubuntu/diag.pdf", buf);
console.log("bytes", buf.length);

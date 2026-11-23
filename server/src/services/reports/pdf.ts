import PDFDocument from "pdfkit";
import { Response } from "express";

interface PdfInput {
  question: string;
  report: { title?: string | null; summary?: string | null; sections: { heading?: string | null; body?: string | null }[]; limitations: string[]; disagreements: string[] };
  sources: { label: string; title?: string | null; url: string; retrievedAt?: Date | null }[];
}

export function streamReportPdf(res: Response, input: PdfInput) {
  const doc = new PDFDocument({ margin: 56, info: { Title: input.report.title ?? "Research report" } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="research-report.pdf"');
  doc.pipe(res);

  doc.fontSize(20).text(input.report.title ?? "Research report");
  doc.moveDown(0.4).fontSize(10).fillColor("#555").text(`Question: ${input.question}`).fillColor("#000");
  doc.moveDown().fontSize(12).text(input.report.summary ?? "");

  for (const s of input.report.sections) {
    doc.moveDown().fontSize(14).text(s.heading ?? "");
    doc.moveDown(0.3).fontSize(11).text(s.body ?? "");
  }
  if (input.report.disagreements.length) {
    doc.moveDown().fontSize(14).text("Disagreements between sources");
    input.report.disagreements.forEach((d) => doc.fontSize(11).text(`- ${d}`));
  }
  doc.moveDown().fontSize(14).text("Limitations");
  input.report.limitations.forEach((l) => doc.fontSize(11).text(`- ${l}`));

  doc.moveDown().fontSize(14).text("References");
  for (const s of input.sources) {
    doc.fontSize(10).fillColor("#000").text(`[${s.label}] ${s.title ?? ""}`);
    doc.fillColor("#0F6B6B").text(s.url, { link: s.url, underline: true }).fillColor("#000");
    if (s.retrievedAt) doc.fillColor("#555").text(`Retrieved ${s.retrievedAt.toISOString().slice(0, 10)}`).fillColor("#000");
    doc.moveDown(0.4);
  }
  doc.end();
}

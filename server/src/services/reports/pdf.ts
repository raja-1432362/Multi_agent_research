import PDFDocument from "pdfkit";
import { Response } from "express";

interface PdfInput {
  question: string;
  report: {
    title?: string | null;
    summary?: string | null;
    sections: { heading?: string | null; body?: string | null }[];
    changesSummary?: string[];
    collectionWarnings?: string[];
    limitations: string[];
    disagreements: string[];
  };
  sources: {
    label: string;
    title?: string | null;
    url: string;
    publishedAt?: string | null;
    retrievedAt?: Date | null;
    sourceType?: string | null;
    isOfficial?: boolean;
  }[];
}

export function streamReportPdf(res: Response, input: PdfInput) {
  const doc = new PDFDocument({ margin: 56, info: { Title: input.report.title ?? "Research report" } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="evidence-desk-report.pdf"');
  doc.pipe(res);

  doc.fontSize(20).text(input.report.title ?? "Research report");
  doc.moveDown(0.4).fontSize(10).fillColor("#555").text(`Question: ${input.question}`).fillColor("#000");
  doc.moveDown().fontSize(12).text(input.report.summary ?? "");

  if (input.report.collectionWarnings?.length) {
    doc.moveDown().fontSize(14).fillColor("#991B1B").text("Collection Warnings & Failures").fillColor("#000");
    input.report.collectionWarnings.forEach((w) => doc.fontSize(10).text(`- ${w}`));
  }

  if (input.report.changesSummary?.length) {
    doc.moveDown().fontSize(14).text("Changes Since Earlier Snapshots");
    input.report.changesSummary.forEach((c) => doc.fontSize(10).text(`- ${c}`));
  }

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
    const tag = s.isOfficial ? "Official" : (s.sourceType ?? "External").replace("_", " ");
    const pub = s.publishedAt ? `Published ${s.publishedAt}` : "Published date unknown";
    doc.fontSize(10).fillColor("#000").text(`[${s.label}] ${s.title ?? ""} (${tag})`);
    doc.fillColor("#0F6B6B").text(s.url, { link: s.url, underline: true }).fillColor("#000");
    const ret = s.retrievedAt ? `Retrieved ${s.retrievedAt.toISOString().slice(0, 10)}` : "";
    doc.fillColor("#555").text(`${pub}${ret ? ` · ${ret}` : ""}`).fillColor("#000");
    doc.moveDown(0.4);
  }
  doc.end();
}

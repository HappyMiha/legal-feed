import type { Update } from "../domain/monitoring";
export function summaryText(u: Update, disclosure: boolean) {
  return `${u.headline}\n${u.source_name} | ${u.published_at}\n\n${u.summary}\n\nWhy it matters for ${u.client_name}\n${u.why_it_matters}\n\nSource: ${u.url || ""}${disclosure ? "\n\nAI-assisted summary — consult the original source." : ""}`;
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportUpdatePDF(
  u: Update,
  includeNote: boolean,
  disclosure: boolean,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const font = await fetch("/fonts/DejaVuSans.ttf");
  if (!font.ok) throw Error("Font unavailable");
  const buffer = new Uint8Array(await font.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 8192)
    binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
  doc.addFileToVFS("DejaVuSans.ttf", btoa(binary));
  doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
  doc.setFont("DejaVuSans");
  let y = 22;
  const text = (value: string, size = 11, gap = 6) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(value, 166) as string[];
    for (const line of lines) {
      if (y > 272) {
        doc.addPage();
        y = 22;
      }
      doc.text(line, 22, y);
      y += size * 0.48;
    }
    y += gap;
  };
  text(u.headline, 18, 9);
  text(
    `${u.source_name} | ${u.published_at} | ${u.relevance === "high" ? "High" : "Medium"} relevance`,
  );
  text(`Matched topic: ${u.topic_title}`);
  text(`Legal basis: ${u.legal_basis}`, 10, 10);
  text(`Source: ${u.url || ""}`, 9, 6);
  text("Summary", 13, 3);
  text(u.summary, 11, 10);
  text(`Why it matters for ${u.client_name}`, 13, 3);
  text(u.why_it_matters, 11, 10);
  if (includeNote && u.note) {
    text("Private note", 13, 3);
    text(u.note);
  }
  if (disclosure) text("AI-assisted summary — consult the original source.", 9);
  downloadBlob(doc.output("blob"), `legal-feed-${u.published_at}.pdf`);
}

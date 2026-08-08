import fs from "fs";
import { extractPdfText } from "../lib/pdf-text";

async function main() {
  const args = process.argv.slice(2);
  const forceOcr = args.includes("--ocr");
  const file =
    args.find((a) => !a.startsWith("--")) ||
    "knowledge-base-source/Chapter 1 - A Triumph of Surgery.pdf";

  const buf = fs.readFileSync(file);
  const r = await extractPdfText(buf, {
    forceOcr,
    maxOcrPages: forceOcr ? 1 : undefined,
  });
  console.log(
    JSON.stringify(
      {
        method: r.method,
        pages: r.pageCount,
        ocrPages: r.ocrPages,
        chars: r.text.length,
        preview: r.text.slice(0, 200).replace(/\s+/g, " "),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

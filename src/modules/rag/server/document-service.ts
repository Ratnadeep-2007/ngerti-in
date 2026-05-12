const pdfParse = require("pdf-parse");
import { pipeline } from "@xenova/transformers";

let extractor: any = null;

export async function initExtractor() {
  if (!extractor) {
    // Note: using Xenova pipeline statically without server side init for simple mock
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractor;
}

export async function parsePdf(buffer: Buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error("PDF parse error:", error);
    return "";
  }
}

export async function generateEmbedding(text: string) {
  const ext = await initExtractor();
  const result = await ext(text, { pooling: "mean", normalize: true });
  return Array.from(result.data);
}

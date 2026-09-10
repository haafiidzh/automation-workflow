import ExcelJS from "exceljs";

const MAX_CHARS = 50_000;
const MAX_ROWS_PER_SHEET = 500;

/**
 * Claude Agent SDK has no native xlsx content block, so we flatten the
 * workbook into CSV-ish text and inline it in the prompt instead. Capped
 * hard — an uncapped sheet can blow past tens of thousands of tokens and
 * eat the session's context budget in one turn.
 */
export async function parseExcelToText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const parts: string[] = [];
  let truncated = false;

  for (const sheet of workbook.worksheets) {
    parts.push(`## Sheet: ${sheet.name}`);
    let rowCount = 0;
    sheet.eachRow((row) => {
      if (rowCount >= MAX_ROWS_PER_SHEET) {
        truncated = true;
        return;
      }
      const cells = (row.values as unknown[]).slice(1).map((v) => cellToString(v));
      parts.push(cells.join(","));
      rowCount++;
    });
    if (sheet.rowCount > MAX_ROWS_PER_SHEET) truncated = true;
  }

  let text = parts.join("\n");
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS);
    truncated = true;
  }

  if (truncated) {
    text += "\n\n[... data dipotong, file terlalu besar untuk ditampilkan penuh ...]";
  }

  return text;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in (value as Record<string, unknown>)) {
    return String((value as { text: unknown }).text ?? "");
  }
  if (typeof value === "object" && "result" in (value as Record<string, unknown>)) {
    return String((value as { result: unknown }).result ?? "");
  }
  return String(value);
}

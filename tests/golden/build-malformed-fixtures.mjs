import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = path.resolve(".");
const goldenDir = path.join(projectRoot, "outputs", "aqp-golden-suite");
const outputDir = path.join(projectRoot, "outputs", "aqp-malformed-suite");
await fs.mkdir(outputDir, { recursive: true });

const resultsPath = path.join(goldenDir, "golden_qm_results.xlsx");
const keyPath = path.join(goldenDir, "golden_answer_key.xlsx");

async function importWorkbook(filename) {
  return SpreadsheetFile.importXlsx(await FileBlob.load(filename));
}

async function saveAndVerify(workbook, filename, previewRange = "A1:Q10") {
  workbook.recalculate();
  const sheet = workbook.worksheets.getItemAt(0);
  const inspect = await workbook.inspect({
    kind: "sheet,region",
    sheetId: sheet.name,
    range: previewRange,
    maxChars: 2500,
    tableMaxRows: 10,
    tableMaxCols: 18,
  });
  if (!inspect.ndjson) throw new Error(`Inspection failed for ${filename}`);
  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!",
    options: { useRegex: true, maxResults: 50 },
    summary: `${filename} formula error scan`,
  });
  if (/\"count\":\s*[1-9]/.test(errors.ndjson || "")) {
    throw new Error(`Unexpected formula error in ${filename}: ${errors.ndjson}`);
  }
  const preview = await workbook.render({ sheetName: sheet.name, range: previewRange, scale: 1, format: "png" });
  await fs.writeFile(path.join(outputDir, filename.replace(/\.xlsx$/, ".preview.png")), new Uint8Array(await preview.arrayBuffer()));
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(path.join(outputDir, filename));
}

async function variant(sourcePath, filename, mutate, previewRange) {
  const workbook = await importWorkbook(sourcePath);
  const sheet = workbook.worksheets.getItemAt(0);
  await mutate(sheet, workbook);
  await saveAndVerify(workbook, filename, previewRange);
}

async function newWorkbook(filename, rows, previewRange) {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Malformed Test");
  sheet.getRange("A1").write(rows);
  sheet.showGridLines = false;
  sheet.getUsedRange().format.font = { name: "Arial", size: 10, color: "#1F2937" };
  sheet.getUsedRange().format.autofitColumns();
  await saveAndVerify(workbook, filename, previewRange);
}

await newWorkbook("malformed_too_short.xlsx", [["Not", "a valid export"], ["Only", "two rows"]], "A1:B2");
await newWorkbook("malformed_no_question_columns.xlsx", [
  ["Question 1"],
  ["Unrelated workbook"],
  ["Student", "Result"],
  ["SYN001", "A"],
], "A1:B4");

await variant(resultsPath, "malformed_no_students.xlsx", async sheet => {
  sheet.getRange("A4:AI45").clear({ applyTo: "contents" });
  sheet.getRange("A4").values = [["Filter"]];
}, "A1:Q6");

await variant(resultsPath, "results_duplicate_student_id.xlsx", async sheet => {
  sheet.getRange("B5").values = [["SYN001"]];
}, "A1:Q7");

await variant(resultsPath, "results_blank_student_id.xlsx", async sheet => {
  sheet.getRange("B4").values = [[""]];
}, "A1:Q6");

await variant(resultsPath, "results_duplicate_question_number.xlsx", async sheet => {
  sheet.getRange("L1").values = [["Question 2"]];
}, "H1:Q7");

await variant(resultsPath, "results_mixed_unscored.xlsx", async sheet => {
  sheet.getRange("Q4").values = [["Unscored"]];
}, "H1:Q7");

await variant(resultsPath, "results_invalid_outcome.xlsx", async sheet => {
  sheet.getRange("K4").values = [["Banana"]];
}, "H1:Q7");

await variant(resultsPath, "results_unknown_stream.xlsx", async sheet => {
  sheet.getRange("A4").values = [["X"]];
}, "A1:Q6");

await variant(resultsPath, "results_invalid_question_version.xlsx", async sheet => {
  sheet.getRange("J2").values = [["<font color=\"white\">Question ID: 900002/0</font> Which statement best describes the synthetic finding?"]];
}, "H1:Q5");

await variant(keyPath, "key_count_mismatch.xlsx", async sheet => {
  sheet.getRange("AJ1").values = [["Question 15"]];
  sheet.getRange("AJ2").values = [["<font color=\"white\">Question ID: 900014/13</font> Which additional synthetic statement is correct?"]];
  sheet.getRange("AJ3:AK3").values = [["Score", "Outcome"]];
  sheet.getRange("AJ4:AK4").values = [[1, "1_0 Option A"]];
}, "Y1:AK5");

await variant(keyPath, "key_blank_answer.xlsx", async sheet => {
  sheet.getRange("K4").values = [[""]];
}, "H1:Q5");

await variant(keyPath, "key_invalid_answer.xlsx", async sheet => {
  sheet.getRange("K4").values = [["6_0 Unsupported option"]];
}, "H1:Q5");

await variant(keyPath, "key_crossfile_mismatch.xlsx", async sheet => {
  sheet.getRange("J2").values = [["<font color=\"white\">Question ID: 999999/4</font> Different wording from the results workbook."]];
}, "H1:Q5");

console.log(`Created 14 malformed-upload fixture workbooks in ${outputDir}`);

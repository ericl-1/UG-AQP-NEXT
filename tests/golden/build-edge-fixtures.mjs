import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.resolve("outputs/aqp-edge-suite");
const previewDir = path.resolve(process.env.TMPDIR || "/tmp", "aqp-edge-fixture-previews");
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const questionCount = 8;
const key = ["a", "b", "c", "d", "a", "b", "c", "d"];
const scenarios = [
  {
    name: "missing_responses",
    students: 12,
    stream: index => index < 6 ? "E" : "F",
    missing: new Set(["0:1", "2:4", "5:7", "7:0", "9:3", "11:6"]),
  },
  {
    name: "single_language",
    students: 16,
    stream: () => "E",
    missing: new Set(),
  },
  {
    name: "small_sample",
    students: 6,
    stream: index => index < 3 ? "E" : "F",
    missing: new Set(),
  },
];

function answerFor(studentIndex, questionIndex) {
  if ((studentIndex * 3 + questionIndex * 2) % 5 < 3) return key[questionIndex];
  return ["a", "b", "c", "d", "e"].find(letter => letter !== key[questionIndex] &&
    (letter.charCodeAt(0) + studentIndex + questionIndex) % 3 === 0) || "e";
}

function workbookRows(scenario, answerKeyOnly) {
  const fixedHeaders = ["Special 4", "Special 5", "Special 2", "Special 1", "Total Score", "Maximum Score", "Percentage Score"];
  const exportedQuestions = questionCount + 2;
  const labels = Array(fixedHeaders.length + exportedQuestions * 2).fill("");
  const wording = Array(labels.length).fill("");
  const headers = fixedHeaders.slice();

  for (let exported = 1; exported <= exportedQuestions; exported++) {
    const scoreColumn = fixedHeaders.length + (exported - 1) * 2;
    labels[scoreColumn] = `Question ${exported}`;
    wording[scoreColumn] = exported === 1
      ? "Academic integrity disclosure"
      : exported === exportedQuestions
        ? "Unscored placeholder"
        : `<font color="white">Question ID: ${910000 + exported}/${exported - 1}</font> Synthetic edge-case question ${exported - 1}`;
    headers.push("Score", "Outcome");
  }

  const rows = [labels, wording, headers];
  const count = answerKeyOnly ? 1 : scenario.students;
  for (let studentIndex = 0; studentIndex < count; studentIndex++) {
    const answers = key.map((correct, questionIndex) => {
      if (answerKeyOnly) return correct;
      if (scenario.missing.has(`${studentIndex}:${questionIndex}`)) return "";
      return answerFor(studentIndex, questionIndex);
    });
    const total = answers.filter((answer, questionIndex) => answer === key[questionIndex]).length;
    const row = [
      answerKeyOnly ? "E" : scenario.stream(studentIndex),
      answerKeyOnly ? `${scenario.name.toUpperCase()}_KEY` : `${scenario.name.toUpperCase()}_${String(studentIndex + 1).padStart(3, "0")}`,
      answerKeyOnly ? "Answer" : `Synthetic${String(studentIndex + 1).padStart(2, "0")}`,
      answerKeyOnly ? "Key" : "Student",
      answerKeyOnly ? questionCount : total,
      questionCount,
      (answerKeyOnly ? questionCount : total) / questionCount,
      1,
      "1_0 Agree",
    ];
    answers.forEach((answer, questionIndex) => {
      row.push(answer === key[questionIndex] ? 1 : 0, answer ? `${answer.charCodeAt(0) - 96}_0 Option ${answer.toUpperCase()}` : "");
    });
    row.push("", "Unscored");
    rows.push(row);
  }
  rows.push(["Filter"]);
  return rows;
}

function formatSheet(sheet, rows) {
  const columns = rows[2].length;
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(3);
  const used = sheet.getRangeByIndexes(0, 0, rows.length, columns);
  used.format.font = { name: "Arial", size: 10, color: "#1F2937" };
  used.format.verticalAlignment = "center";
  sheet.getRangeByIndexes(2, 0, 1, columns).format = {
    fill: "#273142",
    font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
    verticalAlignment: "center",
  };
  sheet.getRangeByIndexes(0, 0, 2, columns).format.fill = "#F3F4F6";
  sheet.getRangeByIndexes(0, 0, rows.length, Math.min(7, columns)).format.columnWidth = 14;
  sheet.getRangeByIndexes(0, 1, rows.length, 1).format.columnWidth = 26;
  sheet.getRangeByIndexes(0, 2, rows.length, 2).format.columnWidth = 16;
  sheet.getRangeByIndexes(0, 7, rows.length, columns - 7).format.columnWidth = 13;
  used.format.autofitRows();
}

async function createWorkbook(scenario, answerKeyOnly) {
  const workbook = Workbook.create();
  const sheetName = answerKeyOnly ? "Answer Key" : "Results";
  const sheet = workbook.worksheets.add(sheetName);
  const rows = workbookRows(scenario, answerKeyOnly);
  sheet.getRange("A1").write(rows);
  formatSheet(sheet, rows);
  workbook.recalculate();

  const inspection = await workbook.inspect({
    kind: "table",
    sheetId: sheetName,
    range: `A1:K${Math.min(rows.length, 10)}`,
    include: "values,formulas",
    tableMaxRows: 10,
    tableMaxCols: 11,
    maxChars: 4000,
  });
  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
    options: { useRegex: true, maxResults: 50 },
    summary: `${scenario.name} ${sheetName} formula error scan`,
  });
  console.log(inspection.ndjson);
  console.log(errors.ndjson);

  const preview = await workbook.render({ sheetName, range: `A1:K${Math.min(rows.length, 12)}`, scale: 1, format: "png" });
  await fs.writeFile(path.join(previewDir, `${scenario.name}_${answerKeyOnly ? "key" : "results"}.png`), new Uint8Array(await preview.arrayBuffer()));

  const filename = `${scenario.name}_${answerKeyOnly ? "answer_key" : "qm_results"}.xlsx`;
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(path.join(outputDir, filename));
  await fs.rm(path.join(outputDir, `${filename}.inspect.ndjson`), { force: true });
}

for (const scenario of scenarios) {
  await createWorkbook(scenario, false);
  await createWorkbook(scenario, true);
}

console.log(`Created 6 synthetic edge-case workbooks in ${outputDir}`);
console.log(`Rendered previews for visual review in ${previewDir}`);

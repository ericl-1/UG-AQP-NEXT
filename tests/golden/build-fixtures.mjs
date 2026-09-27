import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve("outputs/aqp-golden-suite");
await fs.mkdir(root, { recursive: true });

const studentCount = 40;
const scoredQuestionCount = 12;
const correctLetters = Array(scoredQuestionCount).fill("a");
const itemMetadata = [
  { id: "900002", version: 1, text: "Which statement best describes the synthetic finding?" },
  { id: "900003", version: 2, text: "Which option is the most appropriate synthetic response?" },
  { id: "900004", version: 3, text: "Which synthetic mechanism best explains the observation?" },
  { id: "900005", version: 4, text: "Which synthetic interpretation is most accurate?" },
  { id: "900006", version: 5, text: "Which synthetic result should be selected?" },
  { id: "900007", version: 6, text: "Which synthetic conclusion is best supported?" },
  { id: "900008", version: 7, text: "Which synthetic next step is most appropriate?" },
  { id: "900009", version: 8, text: "Which synthetic explanation is most likely?" },
  { id: "900010", version: 9, text: "Which synthetic option best answers the question?" },
  { id: "900011", version: 10, text: "Which synthetic statement is correct?" },
  { id: "900012", version: 11, text: "Which synthetic comparison is most appropriate?" },
  { id: "900013", version: 12, text: "Which synthetic outcome is most likely?" },
];

// Each set contains the zero-based student indexes who answer correctly.
// Students are ordered from lowest to highest overall intended ability.
const bothStreams = predicate => new Set(Array.from({ length: 40 }, (_, i) => i).filter(i => predicate(i % 20)));
const correctSets = [
  bothStreams(() => true),                  // too easy
  bothStreams(r => r >= 14),                // difficult, positive discrimination
  bothStreams(r => r < 10),                 // reversed / poor discrimination
  bothStreams(r => r % 2 === 0),            // approximately non-discriminating
  bothStreams(r => r >= 5),
  bothStreams(r => r >= 7),
  bothStreams(r => r >= 10),
  bothStreams(r => r >= 12),
  bothStreams(r => r >= 2),
  bothStreams(r => r < 8),
  new Set(Array.from({ length: 40 }, (_, i) => i).filter(i => i < 20 ? (i % 20) < 15 : (i % 20) < 5)), // genuine DIF signal
  bothStreams(r => r !== 0),                 // sparse-data guard
];

function optionFor(studentIdx, questionIdx) {
  if (correctSets[questionIdx].has(studentIdx)) return "a";
  return ["b", "c", "d", "e"][(studentIdx + questionIdx) % 4];
}

function qmRows(includeAllStudents) {
  const baseHeaders = ["Special 4", "Special 5", "Special 2", "Special 1", "Total Score", "Maximum Score", "Percentage Score"];
  const totalQuestions = scoredQuestionCount + 2; // disclosure + trailing unscored placeholder
  const labels = Array(baseHeaders.length + totalQuestions * 2).fill("");
  const wording = Array(labels.length).fill("");
  const headers = baseHeaders.slice();
  for (let q = 1; q <= totalQuestions; q++) {
    const scoreCol = baseHeaders.length + (q - 1) * 2;
    labels[scoreCol] = `Question ${q}`;
    wording[scoreCol] = q === 1
      ? "Academic integrity disclosure"
      : q === totalQuestions
        ? "Unscored placeholder"
        : `<font color=\"white\">Question ID: ${itemMetadata[q - 2].id}/${itemMetadata[q - 2].version}</font> ${itemMetadata[q - 2].text}`;
    headers.push("Score", "Outcome");
  }

  const rows = [labels, wording, headers];
  const count = includeAllStudents ? studentCount : 1;
  for (let s = 0; s < count; s++) {
    const answers = includeAllStudents
      ? correctLetters.map((_, qi) => optionFor(s, qi))
      : correctLetters;
    const score = answers.filter((a, i) => a === correctLetters[i]).length;
    const row = [
      includeAllStudents ? (s < 20 ? "E" : "F") : "E",
      includeAllStudents ? `SYN${String(s + 1).padStart(3, "0")}` : "GOLDENKEY",
      includeAllStudents ? `Family${String(s + 1).padStart(2, "0")}` : "Answer",
      includeAllStudents ? `Student${String(s + 1).padStart(2, "0")}` : "Key",
      includeAllStudents ? score : scoredQuestionCount,
      scoredQuestionCount,
      includeAllStudents ? score / scoredQuestionCount : 1,
      1,
      "1_0 Agree",
    ];
    for (let qi = 0; qi < scoredQuestionCount; qi++) {
      const answer = answers[qi];
      row.push(answer === correctLetters[qi] ? 1 : 0, `${answer.charCodeAt(0) - 96}_0 Option ${answer.toUpperCase()}`);
    }
    row.push("", "Unscored");
    rows.push(row);
  }
  rows.push(["Filter"]);
  return rows;
}

function styleDataSheet(sheet, rowCount, colCount) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(3);
  const used = sheet.getRangeByIndexes(0, 0, rowCount, colCount);
  used.format.font = { name: "Arial", size: 10, color: "#1F2937" };
  sheet.getRangeByIndexes(2, 0, 1, colCount).format = {
    fill: "#273142",
    font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
    verticalAlignment: "center",
  };
  sheet.getRangeByIndexes(0, 0, 2, colCount).format.fill = "#F3F4F6";
  sheet.getRangeByIndexes(0, 0, rowCount, Math.min(7, colCount)).format.columnWidth = 14;
  if (colCount > 7) sheet.getRangeByIndexes(0, 7, rowCount, colCount - 7).format.columnWidth = 13;
  sheet.getRangeByIndexes(0, 0, rowCount, colCount).format.verticalAlignment = "center";
  sheet.getRangeByIndexes(0, 0, rowCount, colCount).format.autofitRows();
}

async function makeQmWorkbook(filename, includeAllStudents, sheetName) {
  const wb = Workbook.create();
  const sheet = wb.worksheets.add(sheetName);
  const rows = qmRows(includeAllStudents);
  sheet.getRange("A1").write(rows);
  styleDataSheet(sheet, rows.length, rows[2].length);
  wb.recalculate();
  const preview = await wb.render({ sheetName, range: `A1:K${Math.min(rows.length, 16)}`, scale: 1, format: "png" });
  await fs.writeFile(path.join(root, filename.replace(/\.xlsx$/, ".preview.png")), new Uint8Array(await preview.arrayBuffer()));
  const out = await SpreadsheetFile.exportXlsx(wb);
  await out.save(path.join(root, filename));
  return wb;
}

async function makeFeedbackWorkbook() {
  const wb = Workbook.create();
  const sheet = wb.worksheets.add("Student Feedback");
  const rows = [
    ["Assessment", "Comments Ss"],
    ["Synthetic Golden Exam", "Q2: The wording was unclear and could use more context."],
    ["Synthetic Golden Exam", "Question 3: Two answers seem correct."],
    ["Synthetic Golden Exam", "Q4: The French version does not match the English version."],
    ["Synthetic Golden Exam", "Q5, Q6 - both options were confusing."],
    ["Synthetic Golden Exam", "Overall the exam was fair."],
    ["Synthetic Golden Exam", "Please review the image quality."],
    ["Synthetic Golden Exam", "Question 99: This must remain unmapped because it is outside the exam."],
    ["Synthetic Golden Exam", "Q12"],
    ["Status", "Any status"],
  ];
  sheet.getRange("A1").write(rows);
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  sheet.getRange("A1:B10").format.font = { name: "Arial", size: 10, color: "#1F2937" };
  sheet.getRange("A1:B1").format = { fill: "#0D7A7A", font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" } };
  sheet.getRange("A1:A10").format.columnWidth = 24;
  sheet.getRange("B1:B10").format.columnWidth = 78;
  sheet.getRange("A1:B10").format.verticalAlignment = "center";
  wb.recalculate();
  const preview = await wb.render({ sheetName: "Student Feedback", range: "A1:B10", scale: 1, format: "png" });
  await fs.writeFile(path.join(root, "golden_feedback.preview.png"), new Uint8Array(await preview.arrayBuffer()));
  const out = await SpreadsheetFile.exportXlsx(wb);
  await out.save(path.join(root, "golden_feedback.xlsx"));
  return wb;
}

const resultsWb = await makeQmWorkbook("golden_qm_results.xlsx", true, "Results");
const keyWb = await makeQmWorkbook("golden_answer_key.xlsx", false, "Answer Key");
const feedbackWb = await makeFeedbackWorkbook();

for (const [name, wb] of [["results", resultsWb], ["key", keyWb], ["feedback", feedbackWb]]) {
  const summary = await wb.inspect({ kind: "sheet", include: "id,name", maxChars: 2000 });
  const errors = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!", options: { useRegex: true, maxResults: 50 }, summary: `${name} error scan` });
  console.log(summary.ndjson);
  console.log(errors.ndjson);
}

console.log(`Created 3 golden fixture workbooks in ${root}`);

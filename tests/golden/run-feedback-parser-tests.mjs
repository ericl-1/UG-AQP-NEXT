import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mime = { ".html": "text/html", ".js": "text/javascript" };
const server = http.createServer(async (req, res) => {
  try {
    const requestPath = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
    const filename = path.resolve(projectRoot, relative);
    if (!filename.startsWith(projectRoot + path.sep)) throw new Error("outside project root");
    const body = await fs.readFile(filename);
    res.writeHead(200, { "Content-Type": mime[path.extname(filename)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage();
  page.on("pageerror", error => { throw error; });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded" });
  if (!(await page.evaluate(() => typeof window.XLSX !== "undefined"))) {
    await page.addScriptTag({ path: path.join(projectRoot, "tests", "golden", "xlsx.full.min.js") });
  }
  await page.waitForFunction(() => typeof window.XLSX !== "undefined");

  const actual = await page.evaluate(() => {
    G.nQ = 80;
    FB.manualMaxQ = null;

    const samples = [
      "Q2: The wording was unclear.",
      "Question 3 — two answers seem correct.",
      "Questions 5 and 6: wording differs between versions.",
      "Q7 / Q8: the same image is used.",
      "Q11; Q12: both were unclear.",
      "Questions 15 et 16 : même problème.",
      "The wording in Q17 does not match Q18.",
      "Question 99: outside the exam range.",
      "12 students found the exam long.",
      "5 of 10 students preferred the first option.",
      "2 options seemed correct.",
      "50% found the exam difficult.",
      "A 65-year-old patient was described.",
      "Thank you",
      "Overall the exam was fair.",
      "Q20: The French version does not match the English version.",
      "The internet connection kept timing out.",
      "6= Curb 65 - duration goes with the severity score\n32= PAS BIEN TRADUIT",
      "QUESTION 79; all of these answers have been said to be first line HTN meds",
      "Question 6: Options 2 and 3 should be acceptable answers.",
      "Question 10: A 3-year-old and a 4-year-old were compared with a value under 60.",
      "Q15: what does recent conversion mean?",
      "Q78: the exam kept timing out on this question.",
      "for 59 of 80\nWhat is characteristic of acute tubular necrosis?"
    ];
    const parsed = parseComments(samples);
    // autoCategorizeFb operates on FB.parsed, so classify the same result set.
    FB.parsed = parsed;
    autoCategorizeFb();

    const cover = XLSX.utils.aoa_to_sheet([["Feedback export"], ["Generated for testing"]]);
    const shifted = XLSX.utils.aoa_to_sheet([
      ["Metadata", "Course", "Student comments", "Status"],
      ["x", "Synthetic", "Q4: shifted-column comment", "Complete"]
    ]);
    const layout = findFeedbackWorkbookLayout({
      SheetNames: ["Cover", "Responses"],
      Sheets: { Cover: cover, Responses: shifted }
    });
    const headerless = XLSX.utils.aoa_to_sheet([
      ["Unit I Final Section A 05-2026", "6= Curb 65 - duration goes with severity"],
      ["Unit I Final Section A 05-2026", "32= PAS BIEN TRADUIT"],
      ["Unit I Final Section A 05-2026", "QUESTION 79; all answers appear plausible"],
      ["Unit I Final Section A 05-2026", "Question 10: wording was unclear"]
    ]);
    const headerlessLayout = findFeedbackWorkbookLayout({
      SheetNames: ["Responses"],
      Sheets: { Responses: headerless }
    });

    return {
      parsed: parsed.map(p => ({ rawIdx:p.rawIdx, text:p.text, qNums:p.qNums, status:p.status, category:p._classif || "uncategorized" })),
      layout: layout && { sheetName:layout.sheetName, dataStart:layout.dataStart, commentCol:layout.commentCol },
      headerlessLayout: headerlessLayout && { sheetName:headerlessLayout.sheetName, dataStart:headerlessLayout.dataStart, commentCol:headerlessLayout.commentCol, headerless:headerlessLayout.headerless }
    };
  });

  const byRaw = rawIdx => actual.parsed.filter(p => p.rawIdx === rawIdx);
  assert.deepStrictEqual(byRaw(0).map(p => p.qNums[0]), [2]);
  assert.deepStrictEqual(byRaw(1).map(p => p.qNums[0]), [3]);
  assert.deepStrictEqual(byRaw(2).map(p => p.qNums[0]), [5, 6]);
  assert.deepStrictEqual(byRaw(3).map(p => p.qNums[0]), [7, 8]);
  assert.deepStrictEqual(byRaw(4).map(p => p.qNums[0]), [11, 12]);
  assert.deepStrictEqual(byRaw(5).map(p => p.qNums[0]), [15, 16]);
  assert.deepStrictEqual(byRaw(6).map(p => p.qNums[0]), [17, 18]);

  for (const [rawIdx, label] of [
    [7, "out-of-range question"],
    [8, "student count"],
    [9, "fractional count"],
    [10, "option count"],
    [11, "percentage"],
    [12, "patient age"],
    [14, "substantive general comment"]
  ]) {
    assert.deepStrictEqual(byRaw(rawIdx).map(p => p.qNums), [[]], `${label} must remain unassigned`);
    assert.equal(byRaw(rawIdx)[0].status, "pending", `${label} must require coordinator review`);
  }

  assert.equal(byRaw(13)[0].status, "general");
  assert.equal(byRaw(0)[0].category, "content");
  assert.equal(byRaw(15)[0].category, "translation");
  assert.equal(byRaw(16)[0].category, "other");
  assert.deepStrictEqual(byRaw(17).map(p => p.qNums[0]), [6, 32]);
  assert.equal(byRaw(17).some(p => p.qNums[0] === 65), false, "CURB-65 must not become Q65");
  assert.equal(byRaw(17).find(p => p.qNums[0] === 32).category, "translation");
  assert.deepStrictEqual(byRaw(18).map(p => p.qNums[0]), [79]);
  assert.deepStrictEqual(byRaw(19).map(p => p.qNums[0]), [6], "answer option numbers must not become questions");
  assert.deepStrictEqual(byRaw(20).map(p => p.qNums[0]), [10], "hyphenated ages and clinical values must not become questions");
  assert.equal(byRaw(21)[0].category, "content", "definition questions are Content unless a language issue is explicit");
  assert.equal(byRaw(22)[0].category, "other", "attributed technical issues remain Other");
  assert.deepStrictEqual(byRaw(23).map(p => p.qNums[0]), [59], "exam-position notation must map the question, not the exam total");
  assert.deepStrictEqual(actual.layout, { sheetName:"Responses", dataStart:1, commentCol:2 });
  assert.deepStrictEqual(actual.headerlessLayout, { sheetName:"Responses", dataStart:0, commentCol:1, headerless:true });

  console.log("PASS: feedback parser handles operational marker variants, headerless exports, quantity safeguards, category precedence, and variable workbook layouts.");
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}

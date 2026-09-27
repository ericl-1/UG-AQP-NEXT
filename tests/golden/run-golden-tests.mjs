import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureDir = path.join(projectRoot, "outputs", "aqp-golden-suite");
const expectedPath = path.join(projectRoot, "tests", "golden", "expected.json");

const mime = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
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
  const alerts = [];
  page.on("dialog", async dialog => { alerts.push(dialog.message()); await dialog.dismiss(); });
  page.on("pageerror", err => { throw err; });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded" });
  if (!(await page.evaluate(() => typeof window.XLSX !== "undefined"))) {
    await page.addScriptTag({ path: path.join(projectRoot, "tests", "golden", "xlsx.full.min.js") });
  }
  await page.waitForFunction(() => typeof window.XLSX !== "undefined", null, { timeout: 30000 });

  await page.evaluate(() => {
    localStorage.clear();
    G_ANALYSIS_TYPE = "both";
    G_SOURCE = "qm";
    G_DIF_ENABLED = true;
    document.getElementById("eng-code").value = "E";
    document.getElementById("fre-code").value = "F";
    document.getElementById("exam-title").value = "Synthetic Golden Exam";
    document.getElementById("exam-date").value = "2026-09-24";
  });

  await page.setInputFiles("#fi-main", path.join(fixtureDir, "golden_qm_results.xlsx"));
  await page.waitForFunction(() => G.students && G.students.length === 40 && G.nQ === 12);
  await page.setInputFiles("#fi-key", path.join(fixtureDir, "golden_answer_key.xlsx"));
  await page.waitForFunction(() => G.key && G.key.length === 12);
  await page.setInputFiles("#combined-fb-file-input", path.join(fixtureDir, "golden_feedback.xlsx"));
  await page.waitForFunction(() => FB.parsed && FB.parsed.length > 0);

  const fixtureConsistency = await page.evaluate(async ({ resultsUrl, keyUrl }) => {
    async function readRows(url) {
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
      const wb = XLSX.read(bytes, { type: "array" });
      return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
    }
    const resultsRows = await readRows(resultsUrl);
    const keyRows = await readRows(keyUrl);
    const resultWording = resultsRows[1].filter(Boolean);
    const keyWording = keyRows[1].filter(Boolean);
    const scoredResultWording = resultWording.filter(v => /Question ID:/i.test(String(v)));
    return {
      scoredItemsWithVersionedIds: scoredResultWording.length,
      allIdsIncludePositiveVersion: scoredResultWording.every(v => /Question ID:\s*\d+\/[1-9]\d*/i.test(String(v))),
      wordingRowsMatch: JSON.stringify(resultsRows[1]) === JSON.stringify(keyRows[1]),
      scoredWordingMatches: JSON.stringify(resultWording) === JSON.stringify(keyWording),
    };
  }, {
    resultsUrl: `http://127.0.0.1:${port}/outputs/aqp-golden-suite/golden_qm_results.xlsx`,
    keyUrl: `http://127.0.0.1:${port}/outputs/aqp-golden-suite/golden_answer_key.xlsx`,
  });

  await page.evaluate(() => {
    runFeedbackAnalysis();
    _runAnalysis();
  });
  await page.waitForFunction(() => G._lastN === 40 && G.mcq && G.mcq.length === 12 && FB.ready === true);

  const actual = await page.evaluate(() => ({
    parser: {
      students: G.students.length,
      scoredQuestions: G.nQ,
      disclosureDetected: G._hasDisclosure,
      questionLabels: G.qLabels.slice(),
      key: G.key.slice(),
      elentraIds: G.elentraIds.slice(),
    },
    exam: {
      averagePct: Number(G._lastAvg.toFixed(6)),
      cronbachAlpha: Number(G._lastAlpha.toFixed(9)),
      englishStudents: G._lastNE,
      frenchStudents: G._lastNF,
      englishAveragePct: G._lastEAvg,
      frenchAveragePct: G._lastFAvg,
    },
    items: G.mcq.map(q => ({
      number: q.num,
      label: q.q,
      key: q.key,
      difficulty: Number(q.p.toFixed(6)),
      discrimination: Number(q.rpbis.toFixed(9)),
      flag: q.flag,
      recommendation: q.rec,
      topWrong: q.topWrong,
      responses: q.n,
    })),
    dif: G.dif.map(d => ({
      number: d.num,
      pValue: Number(d.sig),
      deltaR2: Math.abs(Number(d.rd)),
      englishPct: d.ePct,
      frenchPct: d.fPct,
      flagged: d.imp,
      sparse: d.lowN,
      modelFailed: d.modelFailed,
    })),
    feedback: {
      ceiling: FB.maxQUsed,
      ceilingSource: FB.maxQSource,
      parsedCount: FB.parsed.length,
      statusCounts: FB.parsed.reduce((a, p) => { a[p.status] = (a[p.status] || 0) + 1; return a; }, {}),
      questionsWithComments: fbAllQs(),
      groupedCounts: Object.fromEntries(Object.entries(FB.grouped).map(([q, rows]) => [q, rows.length])),
      bareReferenceCounts: { ...FB.bareRefs },
      generalCount: FB.general.length,
      categories: FB.parsed.map(p => p._classif || "uncategorized"),
    },
    scoreValidation: { ...G._scoreValidation },
  }));
  actual.alerts = alerts;
  actual.fixtureConsistency = fixtureConsistency;

  if (process.argv.includes("--print-actual")) {
    console.log(JSON.stringify(actual, null, 2));
  } else {
    const expected = JSON.parse(await fs.readFile(expectedPath, "utf8"));
    assert.deepStrictEqual(actual, expected);
    console.log("PASS: AQP golden dataset matches every frozen parser, scoring, item, DIF, and feedback expectation.");
  }
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}

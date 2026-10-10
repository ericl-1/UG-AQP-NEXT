import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureDir = path.join(projectRoot, "outputs", "aqp-edge-suite");
const scenarios = [
  { name: "missing_responses", students: 12, english: 6, french: 6, missing: 6, dif: true },
  { name: "single_language", students: 16, english: 16, french: 0, missing: 0, dif: false },
  { name: "small_sample", students: 6, english: 3, french: 3, missing: 0, dif: true },
];

const mime = { ".html": "text/html", ".js": "text/javascript", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
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
  for (const scenario of scenarios) {
    const page = await browser.newPage();
    const alerts = [];
    page.on("dialog", async dialog => { alerts.push(dialog.message()); await dialog.dismiss(); });
    page.on("pageerror", error => { throw error; });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded" });
    if (!(await page.evaluate(() => typeof window.XLSX !== "undefined"))) {
      await page.addScriptTag({ path: path.join(projectRoot, "tests", "golden", "xlsx.full.min.js") });
    }
    await page.evaluate(({ dif, title }) => {
      localStorage.clear();
      G_ANALYSIS_TYPE = "mcq";
      G_SOURCE = "qm";
      G_DIF_ENABLED = dif;
      document.getElementById("eng-code").value = "E";
      document.getElementById("fre-code").value = "F";
      document.getElementById("exam-title").value = title;
      document.getElementById("exam-date").value = "2026-10-10";
    }, { dif: scenario.dif, title: `Synthetic ${scenario.name.replaceAll("_", " ")}` });

    await page.setInputFiles("#fi-main", path.join(fixtureDir, `${scenario.name}_qm_results.xlsx`));
    await page.waitForFunction(expected => G.students && G.students.length === expected && G.nQ === 8, scenario.students);
    await page.setInputFiles("#fi-key", path.join(fixtureDir, `${scenario.name}_answer_key.xlsx`));
    await page.waitForFunction(() => G.key && G.key.length === 8);

    const parsed = await page.evaluate(() => {
      const reconciliation = analysisReconciliationSnapshot("qm");
      return {
        students: G.students.length,
        questions: G.nQ,
        key: G.key.slice(),
        reconciliation,
        blockers: qmUploadBlockers(),
      };
    });
    assert.equal(parsed.students, scenario.students, `${scenario.name}: student count`);
    assert.equal(parsed.questions, 8, `${scenario.name}: question count`);
    assert.deepEqual(parsed.key, ["a", "b", "c", "d", "a", "b", "c", "d"], `${scenario.name}: answer key`);
    assert.equal(parsed.reconciliation.missingResponses, scenario.missing, `${scenario.name}: missing-response count`);
    assert.equal(parsed.reconciliation.nEN, scenario.english, `${scenario.name}: English count`);
    assert.equal(parsed.reconciliation.nFR, scenario.french, `${scenario.name}: French count`);
    assert.deepEqual(parsed.blockers, [], `${scenario.name}: fixture must not block analysis`);

    await page.evaluate(() => _runAnalysis());
    await page.waitForFunction(expected => G._lastN === expected && G.mcq && G.mcq.length === 8, scenario.students);
    const analysed = await page.evaluate(() => ({
      sampleSize: G._lastN,
      itemCount: G.mcq.length,
      missingByItem: G.mcq.map(item => item.noResp),
      scoreCompared: G._scoreValidation.compared,
      scoreMismatches: G._scoreValidation.mismatches,
      dif: (G.dif || []).map(item => ({ lowN: item.lowN, modelFailed: item.modelFailed })),
    }));
    assert.equal(analysed.sampleSize, scenario.students, `${scenario.name}: analysed sample size`);
    assert.equal(analysed.itemCount, 8, `${scenario.name}: analysed question count`);
    assert.equal(analysed.missingByItem.reduce((sum, count) => sum + count, 0), scenario.missing, `${scenario.name}: item-level missing responses`);
    assert.equal(analysed.scoreCompared, scenario.students * 8, `${scenario.name}: score comparisons`);
    assert.equal(analysed.scoreMismatches, 0, `${scenario.name}: reconstructed scores`);
    if (scenario.name === "small_sample") {
      assert.ok(analysed.dif.length === 8 && analysed.dif.every(item => item.lowN || item.modelFailed), "small_sample: DIF must be conservatively suppressed");
    }
    assert.deepEqual(alerts, [], `${scenario.name}: unexpected alert`);
    await page.close();
  }
  console.log("PASS: missing-response, single-language, and small-sample fixtures parse and analyse as designed.");
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const goldenDir = path.join(projectRoot, "outputs", "aqp-golden-suite");
const malformedDir = path.join(projectRoot, "outputs", "aqp-malformed-suite");
const baseResults = path.join(goldenDir, "golden_qm_results.xlsx");
const baseKey = path.join(goldenDir, "golden_answer_key.xlsx");

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
    res.writeHead(404); res.end("Not found");
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

let browser;
const browserErrors = [];
try {
  browser = await chromium.launch({ headless: true, channel: "chrome" });

  async function newPage() {
    const page = await browser.newPage();
    page.on("pageerror", error => browserErrors.push(error.message));
    page.on("console", msg => { if (msg.type() === "error") browserErrors.push(msg.text()); });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded" });
    if (!(await page.evaluate(() => typeof window.XLSX !== "undefined"))) {
      await page.addScriptTag({ path: path.join(projectRoot, "tests", "golden", "xlsx.full.min.js") });
    }
    await page.evaluate(() => {
      localStorage.clear();
      G_ANALYSIS_TYPE = "mcq";
      G_SOURCE = "qm";
      G_DIF_ENABLED = true;
      document.getElementById("eng-code").value = "E";
      document.getElementById("fre-code").value = "F";
    });
    return page;
  }

  async function upload(page, selector, filename) {
    await page.setInputFiles(selector, filename);
    await page.waitForTimeout(60);
  }

  async function state(page) {
    return page.evaluate(() => ({
      nQ: G.nQ,
      students: G.students ? G.students.length : 0,
      keyCount: G.key ? G.key.length : 0,
      blockers: qmUploadBlockers(),
      warnings: qmUploadWarnings(),
      confirmed: G_MCQ_CONFIRMED,
      confirmDisabled: !!(document.getElementById("qm-confirm-data") || {}).disabled,
      runDisabled: !!(document.getElementById("btn-run") || {}).disabled,
      mainFeedback: (document.getElementById("feedback-main") || {}).innerText || "",
      keyFeedback: (document.getElementById("feedback-key") || {}).innerText || "",
      preview: (document.getElementById("qm-preview") || {}).innerText || "",
    }));
  }

  async function loadPair(resultsFile, keyFile) {
    const page = await newPage();
    await upload(page, "#fi-main", resultsFile);
    if (keyFile) await upload(page, "#fi-key", keyFile);
    return page;
  }

  // Baseline acceptance protects against an over-strict validation gate.
  {
    const page = await loadPair(baseResults, baseKey);
    const buildMetadata = await page.evaluate(() => ({
      build: APP_BUILD,
      faqVersion: APP_FAQ_VERSION,
      faqDate: APP_FAQ_DATE,
      releaseDate: APP_RN_DATE,
      latestReleaseBuild: RELEASE_NOTES[0].builds[0].build,
      latestReleaseDate: RELEASE_NOTES[0].builds[0].date,
      faqText: document.getElementById("faq-overlay").innerText,
    }));
    assert.equal(buildMetadata.build, "20261007-01");
    assert.equal(buildMetadata.faqVersion, "0.8");
    assert.equal(buildMetadata.faqDate, "October 7, 2026");
    assert.equal(buildMetadata.releaseDate, "October 7, 2026");
    assert.equal(buildMetadata.latestReleaseBuild, buildMetadata.build);
    assert.equal(buildMetadata.latestReleaseDate, buildMetadata.releaseDate);
    assert.match(buildMetadata.faqText, /Blocking errors/i);
    assert.match(buildMetadata.faqText, /expires after 30 days/i);
    assert.match(buildMetadata.faqText, /Review Queue decisions are saved/i);
    assert.match(buildMetadata.faqText, /Privacy & local data/i);
    assert.match(buildMetadata.faqText, /preview.*source build/i);
    let actual = await state(page);
    assert.deepEqual(actual.blockers, []);
    assert.deepEqual(actual.warnings, []);
    assert.equal(actual.confirmDisabled, false);
    const reconciliation = await page.evaluate(() => ({
      snapshot: analysisReconciliationSnapshot("qm"),
      heading: document.getElementById("analysis-reconciliation-title")?.textContent,
      button: document.getElementById("qm-confirm-data")?.textContent.trim(),
      regionVisible: !!document.getElementById("analysis-reconciliation"),
      scoreKpiPresent: !!document.getElementById("recon-score-check"),
      scoreWarningPresent: !!document.getElementById("recon-score-warning"),
      action: document.querySelector("#analysis-reconciliation .recon-action")?.innerText || "",
    }));
    assert.equal(reconciliation.regionVisible, true);
    assert.equal(reconciliation.heading, "Analysis reconciliation");
    assert.match(reconciliation.button, /Confirm and continue/i);
    assert.equal(reconciliation.scoreKpiPresent, false);
    assert.equal(reconciliation.scoreWarningPresent, false);
    assert.match(reconciliation.action, /Ready to confirm/i);
    assert.deepEqual(reconciliation.snapshot, {
      source: "qm",
      students: 40,
      questionsDetected: 14,
      scoredQuestions: 12,
      disclosureExcluded: 1,
      unscoredExcluded: 1,
      keyEntries: 12,
      keyMatched: true,
      effectiveDenominator: 12,
      activeExceptions: 0,
      missingResponses: 0,
      scoreCompared: 480,
      scoreMismatches: 0,
      nEN: 20,
      nFR: 20,
      unmatchedStreams: 0,
      blockers: [],
      warnings: [],
      reviewSignals: 0,
    });
    const discrepancyUi = await page.evaluate(() => {
      const original = G.students[0].qmScores[0];
      G.students[0].qmScores[0] = original ? 0 : 1;
      updateQMPreview();
      const result = {
        scoreKpiPresent: !!document.getElementById("recon-score-check"),
        warning: document.getElementById("recon-score-warning")?.innerText || "",
      };
      G.students[0].qmScores[0] = original;
      updateQMPreview();
      return result;
    });
    assert.equal(discrepancyUi.scoreKpiPresent, false);
    assert.match(discrepancyUi.warning, /Score discrepancy found/i);
    assert.match(discrepancyUi.warning, /1 of 480/i);
    await page.evaluate(() => confirmParsePreview("qm"));
    actual = await state(page);
    assert.equal(actual.confirmed, true);
    assert.equal(actual.runDisabled, false);
    const confirmation = await page.evaluate(() => G._reconciliationConfirmation);
    assert.equal(confirmation.source, "qm");
    assert.equal(confirmation.snapshot.questionsDetected, 14);
    assert.equal(confirmation.snapshot.scoredQuestions, 12);
    assert.match(confirmation.confirmedAt, /^\d{4}-\d{2}-\d{2}T/);
    await page.close();
  }

  const structuralFailures = [
    ["malformed_too_short.xlsx", "empty or too short"],
    ["malformed_no_question_columns.xlsx", "Could not find question columns"],
    ["malformed_no_students.xlsx", "No student data rows found"],
  ];
  for (const [file, message] of structuralFailures) {
    const page = await loadPair(path.join(malformedDir, file), null);
    const actual = await state(page);
    assert.equal(actual.students, 0, file);
    assert.equal(actual.confirmed, false, file);
    assert.equal(actual.runDisabled, true, file);
    assert.match(actual.mainFeedback, new RegExp(message, "i"), file);
    await page.close();
  }

  const blockedResults = [
    ["results_duplicate_student_id.xlsx", /Duplicate student ID/i],
    ["results_blank_student_id.xlsx", /blank student ID/i],
    ["results_duplicate_question_number.xlsx", /Duplicate question number/i],
    ["results_mixed_unscored.xlsx", /mixes scored and Unscored/i],
    ["results_invalid_outcome.xlsx", /Unrecognised response value/i],
    ["results_invalid_question_version.xlsx", /version must be a positive number/i],
  ];
  for (const [file, pattern] of blockedResults) {
    const page = await loadPair(path.join(malformedDir, file), baseKey);
    let actual = await state(page);
    assert.ok(actual.blockers.some(message => pattern.test(message)), `${file}: ${actual.blockers.join(" | ")}`);
    assert.equal(actual.confirmDisabled, true, file);
    assert.equal(actual.runDisabled, true, file);
    assert.match(actual.preview, /Must fix before analysis/i, file);
    await page.evaluate(() => confirmParsePreview("qm"));
    actual = await state(page);
    assert.equal(actual.confirmed, false, file);
    await page.close();
  }

  // Unknown stream codes are intentionally correctable warnings, not blockers.
  {
    const page = await loadPair(path.join(malformedDir, "results_unknown_stream.xlsx"), baseKey);
    let actual = await state(page);
    assert.deepEqual(actual.blockers, []);
    assert.ok(actual.warnings.some(message => /language-stream code/i.test(message)));
    assert.equal(actual.confirmDisabled, false);
    const reconciliation = await page.evaluate(() => analysisReconciliationSnapshot("qm"));
    assert.ok(reconciliation.unmatchedStreams > 0);
    assert.ok(reconciliation.reviewSignals > 0);
    assert.match(actual.preview, /Review recommended/i);
    await page.evaluate(() => confirmParsePreview("qm"));
    actual = await state(page);
    assert.equal(actual.confirmed, true);
    assert.equal(actual.runDisabled, false);
    await page.close();
  }

  const blockedKeys = [
    ["key_count_mismatch.xlsx", /Question count mismatch/i],
    ["key_blank_answer.xlsx", /Missing or unsupported answer key value/i],
    ["key_invalid_answer.xlsx", /Missing or unsupported answer key value/i],
    ["key_crossfile_mismatch.xlsx", /Question ID\/version differs|Question wording differs/i],
  ];
  for (const [file, pattern] of blockedKeys) {
    const page = await loadPair(baseResults, path.join(malformedDir, file));
    let actual = await state(page);
    assert.ok(actual.blockers.some(message => pattern.test(message)), `${file}: ${actual.blockers.join(" | ")}`);
    assert.equal(actual.confirmDisabled, true, file);
    assert.equal(actual.runDisabled, true, file);
    await page.evaluate(() => confirmParsePreview("qm"));
    actual = await state(page);
    assert.equal(actual.confirmed, false, file);
    await page.close();
  }

  // Re-uploading a bad file must clear previously confirmed data rather than
  // leave an old valid analysis path active.
  {
    const page = await loadPair(baseResults, baseKey);
    await page.evaluate(() => confirmParsePreview("qm"));
    await upload(page, "#fi-main", path.join(malformedDir, "malformed_too_short.xlsx"));
    const actual = await state(page);
    assert.equal(actual.nQ, 0);
    assert.equal(actual.students, 0);
    assert.equal(actual.confirmed, false);
    assert.equal(actual.runDisabled, true);
    await page.close();
  }

  // Replacing a valid results file while retaining the loaded key must rerun
  // cross-file reconciliation and require a fresh confirmation.
  {
    const page = await loadPair(baseResults, baseKey);
    await page.evaluate(() => confirmParsePreview("qm"));
    await page.evaluate(() => returnToUploadFiles("qm"));
    await upload(page, "#fi-main", baseResults);
    const actual = await state(page);
    const reconciliation = await page.evaluate(() => analysisReconciliationSnapshot("qm"));
    assert.equal(actual.confirmed, false);
    assert.equal(actual.confirmDisabled, false);
    assert.equal(actual.runDisabled, true);
    assert.equal(reconciliation.keyMatched, true);
    assert.equal(reconciliation.questionsDetected, 14);
    await page.close();
  }

  assert.deepEqual(browserErrors, []);
  console.log("PASS: 15 malformed-upload scenarios block, warn, accept, and clear stale state as designed.");
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}

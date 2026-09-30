import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureDir = path.join(projectRoot, "outputs", "aqp-golden-suite");
const requestedOutput = process.argv.includes("--output-dir")
  ? process.argv[process.argv.indexOf("--output-dir") + 1]
  : null;
const outputDir = requestedOutput
  ? path.resolve(requestedOutput)
  : await fs.mkdtemp(path.join(os.tmpdir(), "aqp-exception-reports-"));
await fs.mkdir(outputDir, { recursive: true });

const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
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

function closeEnough(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`);
}

function independentReference(source, exceptions) {
  const n = source.students.length;
  const nQ = source.key.length;
  const scored = source.students.map(student => source.key.map((key, idx) => {
    const exc = exceptions[idx] || { disposition: "include", altKeys: [] };
    if (exc.disposition === "delete") return 0;
    const response = String(student.outcomes[idx] || "").toUpperCase();
    return response === String(key || "").toUpperCase() || (exc.altKeys || []).includes(response) ? 1 : 0;
  }));
  const totals = scored.map(row => row.reduce((sum, value, idx) => {
    return exceptions[idx]?.disposition === "delete" ? sum : sum + value;
  }, 0));
  const effectiveQuestions = nQ - Object.values(exceptions).filter(exc => exc.disposition !== "include").length;
  const meanTotal = totals.reduce((a, b) => a + b, 0) / n;
  const sdTotal = Math.sqrt(totals.reduce((sum, value) => sum + (value - meanTotal) ** 2, 0) / n);
  const items = source.key.map((_, idx) => {
    if (exceptions[idx]?.disposition === "delete") return { difficulty: null, discrimination: null };
    const values = scored.map(row => row[idx]);
    const difficulty = values.reduce((a, b) => a + b, 0) / n;
    let discrimination = 0;
    if (difficulty > 0 && difficulty < 1 && sdTotal > 0) {
      const sdItem = Math.sqrt(difficulty * (1 - difficulty));
      const covariance = values.reduce((sum, value, row) => {
        return sum + (value - difficulty) * (totals[row] - meanTotal);
      }, 0) / n;
      discrimination = covariance / (sdItem * sdTotal);
    }
    return { difficulty, discrimination };
  });
  const nonDeleted = source.key.map((_, idx) => idx).filter(idx => exceptions[idx]?.disposition !== "delete");
  const itemVariances = nonDeleted.map(idx => {
    const values = scored.map(row => row[idx]);
    const mean = values.reduce((a, b) => a + b, 0) / n;
    return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n;
  });
  const alphaTotals = scored.map(row => nonDeleted.reduce((sum, idx) => sum + row[idx], 0));
  const alphaMean = alphaTotals.reduce((a, b) => a + b, 0) / n;
  const totalVariance = alphaTotals.reduce((sum, value) => sum + (value - alphaMean) ** 2, 0) / n;
  const k = nonDeleted.length;
  const alpha = totalVariance === 0 ? 0 : (k / (k - 1)) * (1 - itemVariances.reduce((a, b) => a + b, 0) / totalVariance);
  return {
    effectiveQuestions,
    averagePct: totals.reduce((a, b) => a + b, 0) / n / effectiveQuestions * 100,
    alpha,
    totals,
    items,
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ""; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

async function saveDownload(page, trigger, expectedExtension) {
  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
  await page.evaluate(trigger);
  const download = await downloadPromise;
  const suggested = download.suggestedFilename();
  assert.equal(path.extname(suggested).toLowerCase(), expectedExtension);
  const target = path.join(outputDir, suggested);
  await download.saveAs(target);
  return target;
}

async function inspectDocx(page, filename) {
  const bytes = await fs.readFile(filename);
  return page.evaluate(async base64 => {
    const raw = atob(base64);
    const data = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);
    const zip = await JSZip.loadAsync(data);
    const documentXml = await zip.file("word/document.xml").async("string");
    const stylesXml = await zip.file("word/styles.xml").async("string");
    const text = documentXml
      .replace(/<w:tab\s*\/>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
    return {
      text,
      tableCount: (documentXml.match(/<w:tbl>/g) || []).length,
      tableGridCount: (documentXml.match(/<w:tblGrid>/g) || []).length,
      hasStyles: stylesXml.includes('w:styleId="Normal"') && stylesXml.includes('w:styleId="TableGrid"'),
      hasDocument: !!zip.file("word/document.xml"),
      hasContentTypes: !!zip.file("[Content_Types].xml"),
    };
  }, bytes.toString("base64"));
}

let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ acceptDownloads: true });
  const alerts = [];
  const pageErrors = [];
  page.on("dialog", async dialog => { alerts.push(dialog.message()); await dialog.dismiss(); });
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded" });
  if (!(await page.evaluate(() => typeof XLSX !== "undefined"))) {
    await page.addScriptTag({ path: path.join(projectRoot, "tests", "golden", "xlsx.full.min.js") });
  }
  if (!(await page.evaluate(() => typeof JSZip !== "undefined"))) {
    await page.addScriptTag({ path: path.join(projectRoot, "tests", "golden", "jszip.min.js") });
  }
  await page.waitForFunction(() => typeof XLSX !== "undefined" && typeof JSZip !== "undefined");

  await page.evaluate(() => {
    localStorage.clear();
    G_ANALYSIS_TYPE = "both";
    G_SOURCE = "qm";
    G_DIF_ENABLED = true;
    document.getElementById("eng-code").value = "E";
    document.getElementById("fre-code").value = "F";
    document.getElementById("exam-title").value = "Synthetic Exception Report Exam";
    document.getElementById("exam-date").value = "2026-09-25";
    document.getElementById("coordinator-name").value = "Synthetic Coordinator";
  });
  await page.setInputFiles("#fi-main", path.join(fixtureDir, "golden_qm_results.xlsx"));
  await page.waitForFunction(() => G.students?.length === 40 && G.nQ === 12);
  await page.setInputFiles("#fi-key", path.join(fixtureDir, "golden_answer_key.xlsx"));
  await page.waitForFunction(() => G.key?.length === 12);
  await page.setInputFiles("#combined-fb-file-input", path.join(fixtureDir, "golden_feedback.xlsx"));
  await page.waitForFunction(() => FB.parsed?.length > 0);
  await page.evaluate(() => { runFeedbackAnalysis(); _runAnalysis(); });
  await page.waitForFunction(() => G._lastN === 40 && G.mcq?.length === 12 && FB.ready === true);

  const source = await page.evaluate(() => ({
    key: G.key.slice(),
    students: G.students.map(student => ({ outcomes: student.outcomes.slice() })),
  }));
  const exceptions = {
    1: { disposition: "credit", reason: "Golden credit decision", altKeys: [], altReason: "" },
    2: { disposition: "delete", reason: "Golden delete decision", altKeys: [], altReason: "" },
    3: { disposition: "include", reason: "", altKeys: ["B"], altReason: "Golden alternate-key decision" },
  };
  const reference = independentReference(source, exceptions);

  await page.evaluate(exc => {
    G.exclusions = exc;
    _runAnalysis();
  }, exceptions);
  await page.waitForFunction(() => G.mcq?.[1]?.excluded === "credit" && G.mcq?.[2]?.excluded === "delete" && G.mcq?.[3]?.altKeys?.includes("B"));

  const calculated = await page.evaluate(() => ({
    averagePct: G._lastAvg,
    alpha: G._lastAlpha,
    totals: G.students.map(student => student.kt),
    items: G.mcq.map(item => ({
      difficulty: item.p,
      discrimination: item.rpbis,
      disposition: item.excluded || "include",
      altKeys: item.altKeys || [],
      flag: item.flag,
    })),
    difNumbers: G.dif.map(item => item.num),
    scoreValidation: { ...G._scoreValidation },
  }));
  closeEnough(calculated.averagePct, reference.averagePct, 1e-10, "post-exception exam average");
  closeEnough(calculated.alpha, reference.alpha, 1e-10, "post-exception Cronbach alpha");
  assert.deepEqual(calculated.totals, reference.totals);
  for (let idx = 0; idx < reference.items.length; idx++) {
    assert.equal(calculated.items[idx].difficulty, reference.items[idx].difficulty, `Q${idx + 1} difficulty`);
    if (reference.items[idx].discrimination === null) {
      assert.equal(calculated.items[idx].discrimination, null, `Q${idx + 1} discrimination`);
    } else {
      closeEnough(calculated.items[idx].discrimination, reference.items[idx].discrimination, 1e-10, `Q${idx + 1} discrimination`);
    }
  }
  assert.equal(calculated.items[1].disposition, "credit");
  assert.equal(calculated.items[1].flag, "");
  assert.equal(calculated.items[2].disposition, "delete");
  assert.deepEqual(calculated.items[3].altKeys, ["B"]);
  assert.ok(!calculated.difNumbers.includes(2), "credited question must be absent from DIF");
  assert.ok(!calculated.difNumbers.includes(3), "deleted question must be absent from DIF");

  const nearThreshold = await page.evaluate(() => computeNearThreshold().map(item => ({
    number: item.r.num,
    signals: item.signals.map(signal => signal.id),
    category: _ntItemToFlag(item),
  })));
  assert.ok(nearThreshold.length > 0, "exception scenario must produce at least one Near Threshold item");
  const chosen = [];
  const mcqNear = nearThreshold.find(item => item.signals.some(signal => signal !== "dif_b"));
  const difNear = nearThreshold.find(item => item.signals.includes("dif_b"));
  if (mcqNear) chosen.push(mcqNear);
  if (difNear && !chosen.some(item => item.number === difNear.number)) chosen.push(difNear);
  assert.ok(chosen.length > 0);
  for (const item of chosen) await page.evaluate(number => toggleNtItem(number), item.number);
  await page.evaluate(() => { _reviewState[1] = true; saveSession(); });

  const reportState = await page.evaluate(() => {
    const report = id => ({
      text: document.getElementById(id).innerText,
      tables: [...document.querySelectorAll(`#${id} table`)].map(table =>
        [...table.rows].map(row => [...row.cells].map(cell => cell.innerText.trim()))),
    });
    return {
      included: Object.keys(_ntIncluded).map(Number).sort((a, b) => a - b),
      mcq: report("mcq-report"),
      dif: report("dif-report"),
      full: report("full-report"),
      feedback: report("feedback-report"),
      draft: JSON.parse(localStorage.getItem("aqp-draft")),
    };
  });
  assert.deepEqual(reportState.included, chosen.map(item => item.number).sort((a, b) => a - b));
  assert.match(reportState.mcq.text, /Golden credit decision/);
  assert.match(reportState.mcq.text, /Golden delete decision/);
  assert.match(reportState.mcq.text, /Golden alternate-key decision/);
  assert.match(reportState.full.text, /Golden credit decision/);
  assert.match(reportState.full.text, /Golden delete decision/);
  assert.match(reportState.full.text, /Golden alternate-key decision/);
  assert.match(reportState.feedback.text, /Student Feedback Report/);
  assert.equal(Object.keys(reportState.draft.ntIncluded).length, chosen.length);
  assert.equal(reportState.draft.G.exclusions[1].disposition, "credit");
  assert.equal(reportState.draft.G.exclusions[2].disposition, "delete");
  for (const item of chosen) {
    const target = item.category.isDif ? reportState.dif : reportState.mcq;
    assert.ok(target.tables.some(table => table.some(row => row[0] === String(item.number))), `Near Threshold Q${item.number} must appear in its report table`);
  }

  const mcqCsvPath = await saveDownload(page, () => doExport("mcq"), ".csv");
  const difCsvPath = await saveDownload(page, () => doExport("dif"), ".csv");
  const sessionCsvPath = await saveDownload(page, () => exportSessionRecord(), ".csv");
  const jsonPath = await saveDownload(page, () => exportSessionJSON(), ".json");
  const backupPath = await saveDownload(page, () => exportPortableSession(), ".json");
  const mcqDocxPath = await saveDownload(page, () => doExportReport("mcq"), ".docx");
  const difDocxPath = await saveDownload(page, () => doExportReport("dif"), ".docx");
  const fullDocxPath = await saveDownload(page, () => doExportReport("full"), ".docx");
  const feedbackDocxPath = await saveDownload(page, () => exportFeedbackReport(), ".docx");

  const mcqCsv = parseCsv(await fs.readFile(mcqCsvPath, "utf8"));
  assert.equal(mcqCsv.length, 13);
  assert.equal(mcqCsv[0][0], "Question #");
  assert.equal(mcqCsv[2][0], "2");
  assert.equal(mcqCsv[3][4], "—");
  closeEnough(Number(mcqCsv[4][4]), reference.items[3].difficulty, 0.0005, "MCQ CSV alternate-key difficulty");

  const difCsv = parseCsv(await fs.readFile(difCsvPath, "utf8"));
  const difCsvNumbers = difCsv.slice(1).map(row => Number(row[0]));
  assert.ok(!difCsvNumbers.includes(2));
  assert.ok(!difCsvNumbers.includes(3));
  assert.deepEqual(difCsvNumbers, calculated.difNumbers);

  const sessionCsv = parseCsv(await fs.readFile(sessionCsvPath, "utf8"));
  const summaryHeaderIndex = sessionCsv.findIndex(row => row[0] === "Export Version");
  const summaryHeaders = sessionCsv[summaryHeaderIndex];
  const summaryValues = sessionCsv[summaryHeaderIndex + 1];
  assert.equal(Number(summaryValues[summaryHeaders.indexOf("Effective Questions")]), reference.effectiveQuestions);
  const questionHeaderIndex = sessionCsv.findIndex(row => row[0] === "Q #");
  const questionHeaders = sessionCsv[questionHeaderIndex];
  const questionRows = sessionCsv.slice(questionHeaderIndex + 1, questionHeaderIndex + 13);
  const q2 = questionRows.find(row => row[0] === "2");
  const q3 = questionRows.find(row => row[0] === "3");
  const q4 = questionRows.find(row => row[0] === "4");
  assert.equal(q2[questionHeaders.indexOf("Disposition")], "Credit");
  assert.equal(q3[questionHeaders.indexOf("Disposition")], "Delete");
  assert.equal(q3[questionHeaders.indexOf("Difficulty (p)")], "");
  assert.equal(q4[questionHeaders.indexOf("Alt Keys")], "B");

  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  assert.equal(json.summary.effectiveQuestions, reference.effectiveQuestions);
  assert.equal(json.summary.creditedCount, 1);
  assert.equal(json.summary.deletedCount, 1);
  assert.equal(json.questions.find(item => item.number === 2).disposition, "credit");
  assert.equal(json.questions.find(item => item.number === 3).disposition, "delete");
  assert.deepEqual(json.questions.find(item => item.number === 4).altKeys, ["B"]);
  assert.ok(!JSON.stringify(json).includes("outcomes"));
  assert.ok(!JSON.stringify(json).includes("studentId"));

  const backup = JSON.parse(await fs.readFile(backupPath, "utf8"));
  assert.equal(backup.fileType, "aqp-portable-session");
  assert.equal(backup.schemaVersion, 1);
  assert.equal(backup.privacy.studentIdentifiersIncluded, false);
  assert.equal(backup.privacy.studentResponsesIncluded, true);
  assert.equal(backup.privacy.feedbackTextIncluded, true);
  assert.equal(backup.session.G.students.length, 40);
  assert.equal(backup.session.G.students[0].outcomes.length, 12);
  for (const student of backup.session.G.students) {
    for (const forbidden of ["id", "name", "first", "last"]) assert.ok(!(forbidden in student));
  }
  assert.equal(backup.session.G.exclusions[1].disposition, "credit");
  assert.equal(backup.session.reviewState[1], true);
  assert.equal(Object.keys(backup.session.ntIncluded).length, chosen.length);

  const validationErrors = await page.evaluate(payload => {
    const message = value => { try { validatePortableSession(value); return ""; } catch (error) { return error.message; } };
    return {
      aggregate: message({ meta: {}, summary: {} }),
      future: message({ ...payload, schemaVersion: 999 }),
      malformed: message({ ...payload, session: { ...payload.session, G: { ...payload.session.G, key: [] } } }),
    };
  }, backup);
  assert.match(validationErrors.aggregate, /report-only Analysis record/);
  assert.match(validationErrors.future, /newer AQP format/);
  assert.match(validationErrors.malformed, /answer key does not match/);

  const workflowUi = await page.evaluate(payload => {
    const older = { ...payload, app: { ...payload.app, build: "20260927-03" } };
    openSessionImportPreview(older, null);
    const importText = document.getElementById("session-import-preview").innerText;
    const importVisible = document.getElementById("session-import-modal").style.display === "flex";
    cancelSessionImport();
    openPrivacyPanel();
    const privacyText = document.getElementById("privacy-draft-details").innerText;
    closePrivacyPanel();
    goHome();
    const resumeEnabled = !document.getElementById("home-resume-action").disabled;
    const draftHeading = document.getElementById("session-history-content").innerText;
    goToResults();
    switchRoom("reports");
    return {
      importText, importVisible, privacyText, resumeEnabled, draftHeading,
      workflowVisible: document.getElementById("workflow-strip").style.display === "flex",
      exportCurrent: document.querySelector('[data-wf="export"]').classList.contains("wf-current"),
      analysisGroupVisible: document.getElementById("rp-section-session").style.display === "block",
      recoveryGroupVisible: document.getElementById("rp-section-recovery").style.display === "block",
    };
  }, backup);
  assert.equal(workflowUi.importVisible, true);
  assert.match(workflowUi.importText, /Different AQP build/);
  assert.match(workflowUi.importText, /Synthetic Exception Report Exam/);
  assert.match(workflowUi.importText, /40/);
  assert.match(workflowUi.importText, /de-identified responses/);
  assert.match(workflowUi.privacyText, /Synthetic Exception Report Exam/);
  assert.equal(workflowUi.resumeEnabled, true);
  assert.match(workflowUi.draftHeading, /Resume session/);
  assert.equal(workflowUi.workflowVisible, true);
  assert.equal(workflowUi.exportCurrent, true);
  assert.equal(workflowUi.analysisGroupVisible, true);
  assert.equal(workflowUi.recoveryGroupVisible, true);

  const docs = {
    mcq: await inspectDocx(page, mcqDocxPath),
    dif: await inspectDocx(page, difDocxPath),
    full: await inspectDocx(page, fullDocxPath),
    feedback: await inspectDocx(page, feedbackDocxPath),
  };
  for (const [type, doc] of Object.entries(docs)) {
    assert.ok(doc.hasDocument, `${type} Word report must contain document.xml`);
    assert.ok(doc.hasContentTypes, `${type} Word report must contain [Content_Types].xml`);
    assert.ok(doc.hasStyles, `${type} Word report must contain required styles`);
    assert.equal(doc.tableGridCount, doc.tableCount, `${type} Word report must grid every table`);
  }
  for (const type of ["mcq", "full"]) {
    assert.ok(docs[type].tableGridCount > 0, `${type} Word report must contain table grids`);
  }
  assert.ok(
    docs.dif.tableGridCount > 0 || /No items with statistically significant DIF/.test(docs.dif.text),
    "DIF Word report must contain either a conformant results table or the explicit all-clear statement",
  );
  for (const type of ["mcq", "full"]) {
    assert.match(docs[type].text, /Golden credit decision/);
    assert.match(docs[type].text, /Golden delete decision/);
    assert.match(docs[type].text, /Golden alternate-key decision/);
  }
  assert.match(docs.dif.text, /DIF Analysis Report/);
  assert.match(docs.feedback.text, /Student Feedback Report/);
  for (const item of chosen) {
    const text = item.category.isDif ? docs.dif.text : docs.mcq.text;
    assert.match(text, new RegExp(`(?:^|\\n|\\s)${item.number}(?:\\s|\\n)`), `Near Threshold Q${item.number} must appear in Word output`);
  }

  const expectedIncluded = reportState.included;
  // Portable backup must restore the same analysis independently of the
  // browser's autosaved draft.
  await page.evaluate(payload => {
    localStorage.clear();
    importPortableSessionObject(payload);
  }, backup);
  await page.waitForFunction(() => G._lastN === 40 && G.mcq?.length === 12 && FB.ready === true);
  const portableRestored = await page.evaluate(() => ({
    build: APP_BUILD,
    title: document.getElementById("exam-title").value,
    credit: G.mcq[1].excluded,
    deleted: G.mcq[2].excluded,
    altKeys: G.mcq[3].altKeys,
    included: Object.keys(_ntIncluded).map(Number).sort((a, b) => a - b),
    review: _reviewState[1],
    feedbackCount: FB.parsed.length,
    createdAtIsDate: ExamSession.createdAt instanceof Date,
    backupCardVisible: document.getElementById("rp-card-backup").style.display === "flex",
  }));
  assert.equal(portableRestored.title, "Synthetic Exception Report Exam");
  assert.equal(portableRestored.credit, "credit");
  assert.equal(portableRestored.deleted, "delete");
  assert.deepEqual(portableRestored.altKeys, ["B"]);
  assert.deepEqual(portableRestored.included, expectedIncluded);
  assert.equal(portableRestored.review, true);
  assert.ok(portableRestored.feedbackCount > 0);
  assert.equal(portableRestored.createdAtIsDate, true);
  assert.equal(portableRestored.backupCardVisible, true);

  await page.reload({ waitUntil: "domcontentloaded" });
  if (!(await page.evaluate(() => typeof XLSX !== "undefined"))) await page.addScriptTag({ path: path.join(projectRoot, "tests", "golden", "xlsx.full.min.js") });
  if (!(await page.evaluate(() => typeof JSZip !== "undefined"))) await page.addScriptTag({ path: path.join(projectRoot, "tests", "golden", "jszip.min.js") });
  await page.evaluate(() => resumeSession());
  await page.waitForFunction(() => G._lastN === 40 && G.mcq?.length === 12);
  const restored = await page.evaluate(() => ({
    credit: G.mcq[1].excluded,
    deleted: G.mcq[2].excluded,
    altKeys: G.mcq[3].altKeys,
    included: Object.keys(_ntIncluded).map(Number).sort((a, b) => a - b),
    mcqTables: [...document.querySelectorAll("#mcq-report table")].map(table =>
      [...table.rows].map(row => [...row.cells].map(cell => cell.innerText.trim()))),
    difTables: [...document.querySelectorAll("#dif-report table")].map(table =>
      [...table.rows].map(row => [...row.cells].map(cell => cell.innerText.trim()))),
  }));
  assert.equal(restored.credit, "credit");
  assert.equal(restored.deleted, "delete");
  assert.deepEqual(restored.altKeys, ["B"]);
  assert.deepEqual(restored.included, expectedIncluded);
  for (const item of chosen) {
    const tables = item.category.isDif ? restored.difTables : restored.mcqTables;
    assert.ok(tables.some(table => table.some(row => row[0] === String(item.number))), `restored report must retain Near Threshold Q${item.number}`);
  }

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(alerts, []);
  console.log(`PASS: exceptions, Near Threshold persistence, portable session round-trip, HTML previews, CSV, JSON, and 4 Word reports validated.`);
  console.log(`Generated report files: ${outputDir}`);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}

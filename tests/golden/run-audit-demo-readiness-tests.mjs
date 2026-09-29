import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "aqp-audit-demo-"));
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
    res.writeHead(404); res.end("Not found");
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

async function saveDownload(page, trigger, extension) {
  const pending = page.waitForEvent("download", { timeout: 30000 });
  await page.evaluate(trigger);
  const download = await pending;
  assert.equal(path.extname(download.suggestedFilename()).toLowerCase(), extension);
  const target = path.join(outputDir, download.suggestedFilename());
  await download.saveAs(target);
  return target;
}

async function docxText(page, filename) {
  const bytes = await fs.readFile(filename);
  return page.evaluate(async base64 => {
    const raw = atob(base64);
    const data = Uint8Array.from(raw, ch => ch.charCodeAt(0));
    const zip = await JSZip.loadAsync(data);
    const xml = await zip.file("word/document.xml").async("string");
    return xml.replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  }, bytes.toString("base64"));
}

let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ acceptDownloads: true });
  const pageErrors = [];
  const alerts = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("dialog", async dialog => { alerts.push(dialog.message()); await dialog.dismiss(); });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded" });
  if (!(await page.evaluate(() => typeof JSZip !== "undefined"))) {
    await page.addScriptTag({ path: path.join(projectRoot, "tests", "golden", "jszip.min.js") });
  }
  await page.evaluate(() => { localStorage.clear(); loadDemonstrationSession(true); });
  await page.waitForFunction(() => G._lastN === 40 && G.mcq?.length === 12 && FB.ready === true);

  const initial = await page.evaluate(() => ({
    build: APP_BUILD,
    title: document.getElementById("exam-title").value,
    bannerVisible: getComputedStyle(document.getElementById("demo-session-banner")).display !== "none",
    isDemo: G._isDemo,
    students: G._lastN,
    questions: G.nQ,
    feedback: FB.parsed.length,
    difLength: G.dif.length,
    hasStream: G._hasStream,
    enabled: G_DIF_ENABLED,
    suppressions: G.dif.filter(d => d.suppressionCode).map(d => ({ number: d.num, code: d.suppressionCode, reason: d.suppressionReason })),
    readiness: getReportReadiness(),
    difText: document.getElementById("dif-table").innerText,
    audit: buildAuditSnapshot(),
    design: (() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const bodyStyle = getComputedStyle(document.body);
      const sidebarStyle = getComputedStyle(document.querySelector(".sidebar"));
      const tableStyle = getComputedStyle(document.querySelector(".mcq-table"));
      const primaryButton = document.querySelector(".btn-primary, .btn-dl-primary");
      const uottawa = {
        accent: rootStyle.getPropertyValue("--c-accent").trim(),
        success: rootStyle.getPropertyValue("--s-ok").trim(),
        radius: rootStyle.getPropertyValue("--radius-md").trim(),
      };
      document.documentElement.dataset.theme = "elentra";
      const elentraStyle = getComputedStyle(document.documentElement);
      const elentra = {
        accent: elentraStyle.getPropertyValue("--c-accent").trim(),
        success: elentraStyle.getPropertyValue("--s-ok").trim(),
        radius: elentraStyle.getPropertyValue("--radius-md").trim(),
      };
      document.documentElement.dataset.theme = "uottawa";
      return {
        bodyFontSize: bodyStyle.fontSize,
        bodyBackground: bodyStyle.backgroundColor,
        sidebarBackground: sidebarStyle.backgroundColor,
        tableNumerals: tableStyle.fontVariantNumeric,
        primaryButtonHeight: primaryButton ? parseFloat(getComputedStyle(primaryButton).minHeight) : 0,
        uottawa,
        elentra,
      };
    })(),
  }));
  assert.equal(initial.build, "20260928-02");
  assert.equal(initial.title, "AQP Synthetic Demonstration Exam");
  assert.equal(initial.bannerVisible, true);
  assert.equal(initial.isDemo, true);
  assert.equal(initial.students, 40);
  assert.equal(initial.questions, 12);
  assert.equal(initial.feedback, 5);
  assert.ok(initial.suppressions.length > 0, `demo must exercise DIF suppression; enabled=${initial.enabled}, hasStream=${initial.hasStream}, difLength=${initial.difLength}, table=${initial.difText}`);
  assert.ok(initial.suppressions.every(s => s.code && s.reason), "every suppression needs a code and explanation");
  assert.match(initial.difText, /Not estimated|Sparse cells|separation|Singular model|No convergence/i);
  assert.equal(initial.readiness.ready, false, "unreviewed demo flags should produce advisory readiness");
  assert.equal(initial.audit.demonstration, true);
  assert.equal(initial.audit.application.build, "20260928-02");
  assert.equal(initial.audit.sourceFiles.demonstration.name, "Built-in synthetic dataset");
  assert.ok(initial.audit.inputInterpretation.reconciliation);
  assert.ok(initial.audit.events.some(event => event.type === "demonstration_loaded"));
  assert.equal(initial.audit.difSuppressions.length, initial.suppressions.length);
  assert.equal(initial.design.bodyFontSize, "14px");
  assert.equal(initial.design.sidebarBackground, "rgb(32, 40, 45)");
  assert.match(initial.design.tableNumerals, /tabular-nums/);
  assert.ok(initial.design.primaryButtonHeight >= 36);
  assert.equal(initial.design.uottawa.radius, "12px");
  assert.equal(initial.design.elentra.radius, initial.design.uottawa.radius);
  assert.notEqual(initial.design.elentra.accent, initial.design.uottawa.accent);
  assert.equal(initial.design.elentra.success, initial.design.uottawa.success, "semantic status colours must remain stable across themes");

  const ready = await page.evaluate(() => {
    const now = new Date().toISOString();
    getReviewQueueQuestions().forEach(q => { _reviewState[q] = true; G._reviewedAt[q] = now; });
    renderReviewQueue(); renderReportReadiness(); saveSession();
    return { state: getReportReadiness(), audit: buildAuditSnapshot(), panel: document.getElementById("report-readiness").innerText };
  });
  assert.equal(ready.state.ready, true);
  assert.match(ready.panel, /Ready for director export/);
  assert.equal(ready.audit.decisions.reviewQueue.filter(item => item.reviewed && item.reviewedAt).length, ready.state.reviewTotal);

  const csvPath = await saveDownload(page, () => exportSessionRecord(), ".csv");
  const jsonPath = await saveDownload(page, () => exportSessionJSON(), ".json");
  const backupPath = await saveDownload(page, () => exportPortableSession(), ".json");
  const difDocx = await saveDownload(page, () => doExportReport("dif"), ".docx");
  const fullDocx = await saveDownload(page, () => doExportReport("full"), ".docx");

  const csv = await fs.readFile(csvPath, "utf8");
  assert.match(csv, /AUDIT METADATA/);
  assert.match(csv, /SOURCE FILES/);
  assert.match(csv, /COORDINATOR DECISIONS/);
  assert.match(csv, /DIF SUPPRESSIONS/);
  assert.match(csv, /EVENT LOG/);
  assert.match(csv, /sparse_cells|separation|singular_model_matrix|maximum_iterations/);

  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  assert.equal(json.meta.build, "20260928-02");
  assert.equal(json.audit.demonstration, true);
  assert.ok(json.audit.difSuppressions.length > 0);
  assert.ok(json.questions.some(q => q.dif?.estimationStatus !== "estimated" && q.dif?.suppressionReason));

  const difText = await docxText(page, difDocx);
  const fullText = await docxText(page, fullDocx);
  for (const text of [difText, fullText]) {
    assert.match(text, /DIF estimation notes/);
    assert.match(text, /could not be estimated reliably/);
    assert.ok(initial.suppressions.some(s => text.includes(s.reason)), "Word report must preserve a precise suppression reason");
  }

  const backup = JSON.parse(await fs.readFile(backupPath, "utf8"));
  assert.equal(backup.fileType, "aqp-portable-session");
  assert.equal(backup.session.G.isDemo, true);
  await page.evaluate(data => { resetAll(); importPortableSessionObject(data); }, backup);
  await page.waitForFunction(() => G._lastN === 40 && G._isDemo === true);
  const restored = await page.evaluate(() => ({
    sourceFiles: G._sourceFiles,
    auditEvents: G._auditEvents,
    reviewedAt: G._reviewedAt,
    banner: getComputedStyle(document.getElementById("demo-session-banner")).display !== "none",
  }));
  assert.equal(restored.sourceFiles.demonstration.name, "Built-in synthetic dataset");
  assert.ok(restored.auditEvents.length > 0);
  assert.equal(Object.keys(restored.reviewedAt).length, ready.state.reviewTotal);
  assert.equal(restored.banner, true);

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(alerts, []);
  console.log("PASS: demonstration, audit trail, report readiness, DIF suppression, exports, and portable recovery are verified.");
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}

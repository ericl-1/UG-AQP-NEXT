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
    difView: (() => {
      const table = document.getElementById("dif-table");
      const button = document.getElementById("btn-dif-technical");
      const defaultHeaders = [...table.querySelectorAll("thead th:not(.dif-tech-col)")].map(th => th.textContent.trim());
      const technicalHeaders = [...table.querySelectorAll("thead th.dif-tech-col")].map(th => th.textContent.trim());
      const technicalInitiallyHidden = [...table.querySelectorAll(".dif-tech-col")].every(cell => getComputedStyle(cell).display === "none");
      toggleDIFTechnical();
      const technicalShown = [...table.querySelectorAll("thead th.dif-tech-col")].every(cell => getComputedStyle(cell).display !== "none");
      const expandedLabel = button.textContent.trim();
      toggleDIFTechnical();
      const unable = table.querySelector(".dif-result-button");
      unable?.click();
      const details = unable ? document.getElementById(unable.getAttribute("aria-controls")) : null;
      const unableDetails = { expanded: unable?.getAttribute("aria-expanded"), hidden: details?.hidden, text: details?.textContent.trim() };
      unable?.click();
      return { defaultHeaders, technicalHeaders, technicalInitiallyHidden, technicalShown, expandedLabel, unableDetails };
    })(),
    distractorQ2: (() => { computeQuartileData(); return buildDistractorDetailHtml(1); })(),
    distractorQ3: (() => {
      computeQuartileData();
      const html = buildDistractorDetailHtml(2);
      const host = document.createElement("div");
      host.innerHTML = html;
      const distributionWidths = Object.fromEntries([...host.querySelectorAll(".dist-bar-wrap")].map(row => [
        row.querySelector(".dist-opt-label")?.textContent.trim(),
        row.querySelector(".dist-bar-fill")?.style.width,
      ]));
      return {
        html,
        evidence: host.querySelector(".da-evidence-text")?.textContent.trim(),
        relatedLabels: [...host.querySelectorAll(".da-related-label")].map(el => el.textContent.trim()),
        optionRoles: [...host.querySelectorAll(".da-option-role")].map(el => el.textContent.trim()),
        quartileSizes: [...host.querySelectorAll(".da-quartile-n")].map(el => el.textContent.trim()),
        qN: [...G._quartileData[2].qN],
        c: G._quartileData[2].optCounts.map(group => group.c),
        d: G._quartileData[2].optCounts.map(group => group.d),
        globalC: G.mcq[2].distCounts.c,
        globalD: G.mcq[2].distCounts.d,
        distributionWidths,
      };
    })(),
    distractorMethodology: (() => {
      const button = document.querySelector("#room-distractor .da-method-btn");
      const panel = document.getElementById("da-methodology-panel");
      toggleDistractorMethodology(button);
      const result = { expanded: button.getAttribute("aria-expanded"), hidden: panel.hidden, text: panel.textContent };
      toggleDistractorMethodology(button);
      return result;
    })(),
    betaRooms: [...document.querySelectorAll("#room-distractor .beta-badge, #room-nearthreshold .beta-badge")].map(el => ({
      text: el.textContent.trim(),
      display: getComputedStyle(el).display,
    })),
    overviewSections: document.querySelectorAll("#landing-mcq-summary .landing-summary-section").length,
    difKpiInToolbar: document.getElementById("dif-kpi-strip")?.parentElement?.classList.contains("mcq-toolbar"),
    audit: buildAuditSnapshot(),
    design: (() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const bodyStyle = getComputedStyle(document.body);
      const sidebarStyle = getComputedStyle(document.querySelector(".sidebar"));
      const tableStyle = getComputedStyle(document.querySelector(".mcq-table"));
      const primaryButton = document.querySelector(".btn-primary, .btn-dl-primary");
      const activeIcon = document.querySelector(".nav-item.active .fui-icon");
      const topBrandTile = document.querySelector(".topbar .aqp-tile");
      const footerBrandTile = document.querySelector(".footer-inner .aqp-tile");
      if (activeIcon) activeIcon.style.transition = "none";
      const uottawa = {
        accent: rootStyle.getPropertyValue("--c-accent").trim(),
        success: rootStyle.getPropertyValue("--s-ok").trim(),
        radius: rootStyle.getPropertyValue("--radius-md").trim(),
        topBrandFill: topBrandTile ? getComputedStyle(topBrandTile).fill : "",
        footerBrandFill: footerBrandTile ? getComputedStyle(footerBrandTile).fill : "",
      };
      document.documentElement.dataset.theme = "elentra";
      const elentraStyle = getComputedStyle(document.documentElement);
      const elentra = {
        accent: elentraStyle.getPropertyValue("--c-accent").trim(),
        success: elentraStyle.getPropertyValue("--s-ok").trim(),
        radius: elentraStyle.getPropertyValue("--radius-md").trim(),
        activeIconColor: activeIcon ? getComputedStyle(activeIcon).color : "",
        topBrandFill: topBrandTile ? getComputedStyle(topBrandTile).fill : "",
        footerBrandFill: footerBrandTile ? getComputedStyle(footerBrandTile).fill : "",
      };
      document.documentElement.dataset.theme = "uottawa";
      const uottawaIconColor = activeIcon ? getComputedStyle(activeIcon).color : "";
      return {
        bodyFontSize: bodyStyle.fontSize,
        bodyBackground: bodyStyle.backgroundColor,
        sidebarBackground: sidebarStyle.backgroundColor,
        tableNumerals: tableStyle.fontVariantNumeric,
        primaryButtonHeight: primaryButton ? parseFloat(getComputedStyle(primaryButton).minHeight) : 0,
        uottawa: { ...uottawa, activeIconColor: uottawaIconColor },
        elentra,
      };
    })(),
  }));
  assert.equal(initial.build, "20261004-01");
  assert.equal(initial.title, "AQP Synthetic Demonstration Exam");
  assert.equal(initial.bannerVisible, true);
  assert.equal(initial.isDemo, true);
  assert.equal(initial.students, 40);
  assert.equal(initial.questions, 12);
  assert.equal(initial.feedback, 5);
  assert.ok(initial.suppressions.length > 0, `demo must exercise DIF suppression; enabled=${initial.enabled}, hasStream=${initial.hasStream}, difLength=${initial.difLength}, table=${initial.difText}`);
  assert.ok(initial.suppressions.every(s => s.code && s.reason), "every suppression needs a code and explanation");
  assert.match(initial.difText, /Unable to assess/i);
  assert.deepEqual(initial.difView.defaultHeaders, ["Question", "Elentra ID", "DIF Result", "EN% correct", "FR% correct", "Δ Gap", "Comments"]);
  assert.deepEqual(initial.difView.technicalHeaders, ["B1 χ²", "B1 R²", "B3 χ²", "B3 R²", "χ² diff", "R² diff", "p-value"]);
  assert.equal(initial.difView.technicalInitiallyHidden, true, "technical DIF columns must be hidden in the default coordinator view");
  assert.equal(initial.difView.technicalShown, true, "Show statistical details must reveal every model column");
  assert.equal(initial.difView.expandedLabel, "Hide statistical details");
  assert.equal(initial.difView.unableDetails.expanded, "true");
  assert.equal(initial.difView.unableDetails.hidden, false);
  assert.match(initial.difView.unableDetails.text, /What this means:/i);
  assert.match(initial.difView.unableDetails.text, /Technical details:/i);
  assert.doesNotMatch(initial.distractorQ2, /Option (A|D|E).*possible defensible answer/i, "unselected options must not be labelled key competitors");
  assert.match(initial.distractorQ2, /Quartile 3: 100% chose option C vs 0% for keyed option B/i, "real key competition must identify both percentages and the keyed option");
  assert.deepEqual(initial.distractorQ3.qN, [10, 10, 10, 10], "demo Q3 must retain four equal performance groups");
  assert.deepEqual(initial.distractorQ3.c, [10, 6, 0, 0], "demo Q3 keyed-option counts must run from lowest to highest performance group");
  assert.deepEqual(initial.distractorQ3.d, [0, 4, 10, 10], "demo Q3 distractor counts must run from lowest to highest performance group");
  assert.equal(initial.distractorQ3.globalC, 16);
  assert.equal(initial.distractorQ3.globalD, 24);
  assert.equal(initial.distractorQ3.distributionWidths.C, "40%", "global answer bars must use the actual percentage");
  assert.equal(initial.distractorQ3.distributionWidths.D, "60%", "global answer bars must not stretch the most popular option to 100%");
  assert.match(initial.distractorQ3.html, /Quartile 3: 100% chose option D vs 0% for keyed option C/i);
  assert.match(initial.distractorQ3.html, /Quartile 4: 100% chose option D vs 0% for keyed option C/i);
  assert.match(initial.distractorQ3.html, /within-quartile percentages, not the overall answer distribution/i);
  assert.match(initial.distractorQ3.evidence, /Quartile 3: 100% chose option D vs 0% for keyed option C/i, "observed evidence must be presented separately before interpretation");
  assert.deepEqual(initial.distractorQ3.relatedLabels, ["Student feedback", "DIF analysis", "Exception"], "related evidence must exclude Review Queue state");
  assert.ok(initial.distractorQ3.optionRoles.includes("✓ key"), "keyed options must be labelled directly in charts");
  assert.deepEqual(initial.distractorQ3.quartileSizes, ["N=10", "N=10", "N=10", "N=10"], "quartile headers must disclose their group sizes");
  assert.equal(initial.distractorMethodology.expanded, "true");
  assert.equal(initial.distractorMethodology.hidden, false);
  assert.match(initial.distractorMethodology.text, /evidence prompts, not automated decisions/i);
  assert.doesNotMatch(initial.distractorQ3.html, /In Q[1-4],/i, "interpretations must not use ambiguous Q1–Q4 abbreviations");
  assert.equal(initial.betaRooms.length, 2, "Distractor Analysis and Near Threshold must both carry Beta badges");
  assert.ok(initial.betaRooms.every(badge => badge.text === "Beta" && ["flex", "inline-flex"].includes(badge.display)));
  assert.ok(initial.overviewSections >= 2, "overview result groups must be visually separated into sections");
  assert.equal(initial.difKpiInToolbar, true, "DIF KPI tiles must share the toolbar row with the CSV action");
  assert.equal(initial.readiness.ready, false, "unreviewed demo flags should produce advisory readiness");
  assert.equal(initial.audit.demonstration, true);
  assert.equal(initial.audit.application.build, "20261004-01");
  assert.equal(initial.audit.sourceFiles.demonstration.name, "Built-in synthetic dataset");
  assert.ok(initial.audit.inputInterpretation.reconciliation);
  assert.ok(initial.audit.events.some(event => event.type === "demonstration_loaded"));
  assert.equal(initial.audit.difSuppressions.length, initial.suppressions.length);
  assert.equal(initial.design.bodyFontSize, "14px");
  assert.equal(initial.design.bodyBackground, "rgb(255, 255, 255)");
  assert.equal(initial.design.sidebarBackground, "rgb(255, 255, 255)");
  assert.match(initial.design.tableNumerals, /tabular-nums/);
  assert.ok(initial.design.primaryButtonHeight >= 36);
  assert.equal(initial.design.uottawa.radius, "12px");
  assert.equal(initial.design.elentra.radius, initial.design.uottawa.radius);
  assert.notEqual(initial.design.elentra.accent, initial.design.uottawa.accent);
  assert.notEqual(initial.design.elentra.activeIconColor, initial.design.uottawa.activeIconColor, "Fluent active-state icons must follow the selected theme");
  assert.equal(initial.design.elentra.success, initial.design.uottawa.success, "semantic status colours must remain stable across themes");
  assert.equal(initial.design.uottawa.topBrandFill, initial.design.uottawa.footerBrandFill, "uOttawa brand marks must share the active theme colour");
  assert.equal(initial.design.elentra.topBrandFill, initial.design.elentra.footerBrandFill, "Elentra brand marks must share the active theme colour");
  assert.notEqual(initial.design.elentra.topBrandFill, initial.design.uottawa.topBrandFill, "analytical-Q marks must follow the selected theme");

  const feedbackOverview = await page.evaluate(() => {
    switchRoom("feedback-overview");
    const routing = [...document.querySelectorAll(".fb-overview-route")].map(el => ({
      value: el.querySelector(".fb-overview-route-value")?.textContent.trim(),
      label: el.querySelector(".fb-overview-route-label")?.textContent.trim(),
    }));
    return {
      title: document.querySelector(".fb-overview-status-title")?.textContent.trim(),
      routing,
      reviewAction: [...document.querySelectorAll(".fb-overview-actions button")].some(el => /Open Feedback Review/i.test(el.textContent)),
      topQuestionCount: document.querySelectorAll(".fb-top-question").length,
      topQuestionLabels: [...document.querySelectorAll(".fb-top-question")].map(el => el.getAttribute("aria-label")),
    };
  });
  assert.match(feedbackOverview.title, /ready for coordinator review/i);
  assert.deepEqual(feedbackOverview.routing, [
    { value: "5", label: "Responses received" },
    { value: "4", label: "Question-attributed" },
    { value: "1", label: "General feedback" },
    { value: "0", label: "Unmapped" },
  ]);
  assert.equal(feedbackOverview.reviewAction, true, "Feedback Overview must provide a direct path to detailed review");
  assert.ok(feedbackOverview.topQuestionCount > 0, "Feedback Overview must surface the most-commented questions");
  assert.ok(feedbackOverview.topQuestionLabels.every(label => /^Open feedback for question \d+$/.test(label)), "top-question actions need clear accessible names");
  const unresolvedFeedback = await page.evaluate(() => {
    FB.parsed[0].status = "pending";
    FB.parsed[0].qNums = [];
    FB.pending = [0];
    groupComments();
    renderFbKpiZone();
    return {
      title: document.querySelector(".fb-overview-status-title")?.textContent.trim(),
      action: [...document.querySelectorAll(".fb-overview-actions button")].some(el => /Resolve unmapped/i.test(el.textContent)),
      unmapped: [...document.querySelectorAll(".fb-overview-route")].find(el => /Unmapped/i.test(el.textContent))?.querySelector(".fb-overview-route-value")?.textContent.trim(),
    };
  });
  assert.match(unresolvedFeedback.title, /1 comment still needs/i);
  assert.equal(unresolvedFeedback.action, true, "unresolved feedback must provide a direct mapping action");
  assert.equal(unresolvedFeedback.unmapped, "1");
  await page.evaluate(() => { loadDemonstrationSession(true); switchRoom("feedback-overview"); });
  await page.waitForFunction(() => document.querySelectorAll(".fb-top-question").length > 0);
  await page.evaluate(() => {
    const first = document.querySelector(".fb-top-question");
    const match = first?.getAttribute("aria-label")?.match(/(\d+)$/);
    openFeedbackQuestion(Number(match?.[1]));
  });
  await page.waitForFunction(() => document.querySelector("#nav-feedback.active") && document.activeElement?.id?.startsWith("fb-question-"));
  await page.evaluate(() => switchRoom("landing"));

  const appearances = await page.evaluate(() => {
    const capture = () => {
      const root = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      return {
        mode: document.documentElement.getAttribute("data-appearance-mode"),
        resolved: document.documentElement.getAttribute("data-appearance"),
        canvas: root.getPropertyValue("--c-canvas").trim(),
        bodyBackground: body.backgroundColor,
        brand: document.documentElement.getAttribute("data-theme") || "",
      };
    };
    applyTheme("");
    applyAppearance("dark");
    const darkUottawa = capture();
    applyTheme("elentra");
    const darkElentra = capture();
    const preview = document.createElement("div");
    preview.className = "report-preview";
    preview.textContent = "Paper preview";
    document.body.appendChild(preview);
    const previewStyle = getComputedStyle(preview);
    const paper = { background: previewStyle.backgroundColor, color: previewStyle.color };
    preview.remove();
    openReportPreviewModal("mcq");
    const modalPreviewStyle = getComputedStyle(document.getElementById("rpm-body"));
    const modalPaper = { background: modalPreviewStyle.backgroundColor, color: modalPreviewStyle.color };
    const modalFlaggedCell = document.querySelector("#rpm-body tr.row-flagged td");
    const modalFlagged = modalFlaggedCell ? getComputedStyle(modalFlaggedCell).backgroundColor : "";
    closeReportPreviewModal();
    switchRoom("exceptions");
    const secondDisposition = document.querySelector('#excl-rows .excl-row[data-idx="1"] select');
    secondDisposition.value = "credit";
    onExclChange(secondDisposition, 1);
    toggleAltKeyRow(0);
    const exceptionSurface = selector => getComputedStyle(document.querySelector(selector)).backgroundColor;
    const exceptionColours = {
      definitions: exceptionSurface(".excl-definitions"),
      included: exceptionSurface(".excl-main-row"),
      credited: exceptionSurface(".excl-main-row.excl-credit"),
      altKey: exceptionSurface(".excl-alt-row"),
    };
    switchRoom("landing");
    applyAppearance("light");
    const lightElentra = capture();
    applyAppearance("system");
    const system = capture();
    applyTheme("");
    return { darkUottawa, darkElentra, lightElentra, system, paper, modalPaper, modalFlagged, exceptionColours };
  });
  assert.equal(appearances.darkUottawa.mode, "dark");
  assert.equal(appearances.darkUottawa.resolved, "dark");
  assert.notEqual(appearances.darkUottawa.bodyBackground, "rgb(255, 255, 255)");
  assert.equal(appearances.darkElentra.resolved, "dark", "changing brand must not change appearance");
  assert.equal(appearances.darkElentra.brand, "elentra");
  assert.equal(appearances.lightElentra.resolved, "light");
  assert.equal(appearances.lightElentra.brand, "elentra", "changing appearance must not change brand");
  assert.equal(appearances.system.mode, "system");
  assert.match(appearances.system.resolved, /^(light|dark)$/);
  assert.equal(appearances.paper.background, "rgb(255, 255, 255)", "report previews must remain paper-white in dark mode");
  assert.equal(appearances.paper.color, "rgb(24, 34, 43)");
  assert.equal(appearances.modalPaper.background, "rgb(255, 255, 255)", "the report-preview modal must remain paper-white in dark mode");
  assert.equal(appearances.modalPaper.color, "rgb(24, 34, 43)");
  assert.equal(appearances.modalFlagged, "rgb(255, 248, 230)", "flagged report rows must retain their paper-report highlight in dark mode");
  assert.notEqual(appearances.exceptionColours.definitions, "rgb(247, 248, 249)", "exception definitions must use a dark-mode surface");
  assert.notEqual(appearances.exceptionColours.included, "rgb(255, 255, 255)", "included exception rows must use a dark-mode surface");
  assert.notEqual(appearances.exceptionColours.credited, "rgb(255, 251, 234)", "credit decisions must use a dark semantic highlight");
  assert.equal(appearances.exceptionColours.altKey, appearances.exceptionColours.definitions, "alternate-key workspaces must use the dark surface token");

  const feedbackNavigation = await page.evaluate(() => {
    const navIds = [...document.querySelectorAll("#main-sidebar .sidebar-nav > .nav-item")].map(el => el.id);
    const capture = room => {
      switchRoom(room);
      return {
        room: _currentRoom,
        title: document.getElementById("rph-fb-title")?.textContent.trim() || "",
        kpiVisible: getComputedStyle(document.getElementById("kpi-zone-fb")).display !== "none",
        activeNav: document.querySelector("#main-sidebar .nav-item[aria-current='page']")?.id || "",
        toolbarText: document.getElementById("fb-toolbar-host")?.textContent.trim() || "",
        contentText: document.getElementById("fb-results-content")?.textContent.trim() || "",
        hierarchy: (() => {
          const section = document.getElementById("main-section-feedback");
          const header = section?.querySelector(".room-page-hdr");
          const kpis = document.getElementById("kpi-zone-fb");
          const details = document.getElementById("section-feedback");
          if (!section || !header || !kpis || !details) return false;
          return !!(header.compareDocumentPosition(kpis) & Node.DOCUMENT_POSITION_FOLLOWING)
            && !!(kpis.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING);
        })(),
      };
    };
    const overview = capture("feedback-overview");
    const review = capture("feedback");
    const unmapped = capture("mapping");
    switchRoom("landing");
    return {
      navIds,
      mappingIsFullRoom: document.getElementById("nav-mapping")?.classList.contains("nav-item"),
      mappingIsSubRoom: document.getElementById("nav-mapping")?.classList.contains("nav-sub"),
      overview,
      review,
      unmapped,
    };
  });
  const feedbackNavStart = feedbackNavigation.navIds.indexOf("nav-feedback-overview");
  assert.deepEqual(
    feedbackNavigation.navIds.slice(feedbackNavStart, feedbackNavStart + 3),
    ["nav-feedback-overview", "nav-feedback", "nav-mapping"],
    "Student Feedback navigation must present Overview, Feedback Review, then Unmapped Comments"
  );
  assert.equal(feedbackNavigation.mappingIsFullRoom, true);
  assert.equal(feedbackNavigation.mappingIsSubRoom, false);
  assert.deepEqual(
    { room: feedbackNavigation.overview.room, title: feedbackNavigation.overview.title, kpiVisible: feedbackNavigation.overview.kpiVisible, activeNav: feedbackNavigation.overview.activeNav },
    { room: "feedback-overview", title: "Feedback Overview", kpiVisible: true, activeNav: "nav-feedback-overview" }
  );
  assert.equal(feedbackNavigation.overview.toolbarText, "", "Feedback Overview must not inherit detailed review controls");
  assert.equal(feedbackNavigation.overview.hierarchy, true, "Feedback Overview KPIs must sit below the room header and above detail content");
  assert.equal(feedbackNavigation.review.title, "Feedback Review");
  assert.equal(feedbackNavigation.review.kpiVisible, false, "Feedback Review must remain focused on detailed comments");
  assert.equal(feedbackNavigation.review.activeNav, "nav-feedback");
  assert.equal(feedbackNavigation.unmapped.title, "Unmapped Comments");
  assert.equal(feedbackNavigation.unmapped.kpiVisible, false);
  assert.equal(feedbackNavigation.unmapped.activeNav, "nav-mapping");
  assert.match(feedbackNavigation.unmapped.contentText, /No unmapped comments/);
  assert.doesNotMatch(feedbackNavigation.unmapped.contentText, /NaN%/);

  const ready = await page.evaluate(() => {
    const now = new Date().toISOString();
    getReviewQueueQuestions().forEach(q => { _reviewState[q] = true; G._reviewedAt[q] = now; });
    renderReviewQueue(); renderReportReadiness(); saveSession();
    return { state: getReportReadiness(), audit: buildAuditSnapshot(), panel: document.getElementById("report-readiness").innerText };
  });
  assert.equal(ready.state.ready, true);
  assert.match(ready.panel, /Ready for director export/);
  assert.equal(ready.audit.decisions.reviewQueue.filter(item => item.reviewed && item.reviewedAt).length, ready.state.reviewTotal);

  const recordUi = await page.evaluate(() => ({
    cardCount: document.querySelectorAll("#rp-card-record").length,
    oldCsvCard: !!document.getElementById("rp-card-csv"),
    oldJsonCard: !!document.getElementById("rp-card-json"),
    recordText: document.getElementById("rp-card-record")?.innerText || "",
    backupText: document.getElementById("rp-card-backup")?.innerText || "",
    canonical: JSON.parse(JSON.stringify(buildAnalysisRecord())),
  }));
  assert.equal(recordUi.cardCount, 1);
  assert.equal(recordUi.oldCsvCard, false);
  assert.equal(recordUi.oldJsonCard, false);
  assert.match(recordUi.recordText, /Analysis record/);
  assert.match(recordUi.recordText, /CSV/);
  assert.match(recordUi.recordText, /JSON/);
  assert.match(recordUi.backupText, /Reopenable AQP backup/);

  const reportAudience = await page.evaluate(() => {
    renderDIFReport();
    renderFullReport(G._lastAvg, G._lastAlpha);
    return {
      dif: document.getElementById("dif-report").innerText,
      combined: document.getElementById("full-report").innerText,
    };
  });
  assert.doesNotMatch(reportAudience.dif, /DIF estimation notes|could not be estimated reliably/i, "DIF preview must remain focused on actionable flags");
  assert.doesNotMatch(reportAudience.combined, /DIF estimation notes|could not be estimated reliably/i, "combined preview must remain focused on actionable flags");

  const csvPath = await saveDownload(page, () => exportSessionRecord(), ".csv");
  const jsonPath = await saveDownload(page, () => exportSessionJSON(), ".json");
  const backupPath = await saveDownload(page, () => exportPortableSession(), ".json");
  const difDocx = await saveDownload(page, () => doExportReport("dif"), ".docx");
  const fullDocx = await saveDownload(page, () => doExportReport("full"), ".docx");

  const csv = await fs.readFile(csvPath, "utf8");
  assert.match(path.basename(csvPath), /_analysis-record\.csv$/);
  assert.match(csv, /AUDIT METADATA/);
  assert.match(csv, /SOURCE FILES/);
  assert.match(csv, /COORDINATOR DECISIONS/);
  assert.match(csv, /DIF SUPPRESSIONS/);
  assert.match(csv, /EVENT LOG/);
  assert.match(csv, /sparse_cells|separation|singular_model_matrix|maximum_iterations/);

  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  assert.match(path.basename(jsonPath), /_analysis-record\.json$/);
  assert.equal(json.recordType, "aqp-analysis-record");
  assert.equal(json.schemaVersion, "1.0");
  assert.equal(json.meta.build, "20261004-01");
  assert.deepEqual(json.summary, recordUi.canonical.summary);
  assert.deepEqual(json.thresholds, recordUi.canonical.thresholds);
  assert.deepEqual(json.questions, recordUi.canonical.questions);
  assert.deepEqual(json.feedback, recordUi.canonical.feedback);
  assert.match(csv, new RegExp(`AQP Synthetic Demonstration Exam,${json.meta.examDate},${json.summary.totalStudents},${json.summary.enStudents},${json.summary.frStudents},${json.summary.totalQuestions},${json.summary.effectiveQuestions}`));
  assert.equal(json.audit.demonstration, true);
  assert.ok(json.audit.difSuppressions.length > 0);
  assert.ok(json.questions.some(q => q.dif?.estimationStatus !== "estimated" && q.dif?.suppressionReason));

  const difText = await docxText(page, difDocx);
  const fullText = await docxText(page, fullDocx);
  for (const text of [difText, fullText]) {
    assert.doesNotMatch(text, /DIF estimation notes|could not be estimated reliably/i, "distributed Word reports must remain focused on actionable DIF flags");
    assert.ok(initial.suppressions.every(s => !text.includes(s.reason)), "technical suppression reasons must remain outside distributed Word reports");
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

  const exceptionRefresh = await page.evaluate(() => {
    switchRoom("exceptions");
    const creditSelect = document.querySelector('.excl-row[data-idx="0"] select');
    creditSelect.value = "credit";
    onExclChange(creditSelect, 0);
    document.getElementById("excl-reason-0").value = "Regression test credit";

    const original = String(G.key[1] || "").toUpperCase();
    const alternate = ["A", "B", "C", "D", "E"].find(letter => letter !== original);
    const alternateBox = document.querySelector('#altkey-row-1 input[data-altletter="' + alternate + '"]');
    alternateBox.checked = true;
    document.getElementById("altkey-reason-1").value = "Regression test alternate";
    saveAltKey(1);
    saveExclusions();
    const roomAfterSave = _currentRoom;
    const quartileCacheCleared = G._quartileData === null;
    switchRoom("distractor");
    const quartileCacheRebuilt = Array.isArray(G._quartileData) && G._quartileData.length === G.nQ;
    const acceptedOptionWarning = new RegExp("option " + alternate + ".*possible defensible answer", "i").test(buildDistractorDetailHtml(1));
    const mutedRow = document.querySelector(".nt-table tr.nt-excluded");
    const rowOpacity = mutedRow ? getComputedStyle(mutedRow.querySelector("td")).opacity : null;
    const actionOpacity = mutedRow ? getComputedStyle(mutedRow.querySelector("td:last-child")).opacity : null;
    return {
      credited: G.mcq[0].excluded,
      alternate,
      altKeys: G.mcq[1].altKeys,
      roomAfterSave,
      dirty: G_DIRTY,
      quartileCacheCleared,
      quartileCacheRebuilt,
      acceptedOptionWarning,
      rowOpacity,
      actionOpacity,
    };
  });
  assert.equal(exceptionRefresh.credited, "credit", "saved credit must immediately appear in Item Analysis data");
  assert.ok(exceptionRefresh.altKeys.includes(exceptionRefresh.alternate), "saved alternate key must immediately appear in Item Analysis data");
  assert.equal(exceptionRefresh.roomAfterSave, "mcq", "successful exception save must return to updated Item Analysis");
  assert.equal(exceptionRefresh.dirty, false, "successful exception save must leave results current");
  assert.equal(exceptionRefresh.quartileCacheCleared, true, "exception recalculation must invalidate the prior quartile breakdown");
  assert.equal(exceptionRefresh.quartileCacheRebuilt, true, "opening Distractor Analysis must rebuild quartiles from updated totals");
  assert.equal(exceptionRefresh.acceptedOptionWarning, false, "an accepted alternate key must not be reported as a distractor problem");
  if (exceptionRefresh.rowOpacity !== null) {
    assert.ok(Number(exceptionRefresh.rowOpacity) < 1, "unincluded Near Threshold data remains muted");
    assert.equal(exceptionRefresh.actionOpacity, "1", "Near Threshold inclusion action remains fully visible");
  }

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(alerts, []);
  console.log("PASS: demonstration, audit trail, report readiness, DIF suppression, exports, and portable recovery are verified.");
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}

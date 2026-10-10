import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const server = http.createServer(async (req, res) => {
  try {
    const requestPath = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
    const filename = path.resolve(projectRoot, relative);
    if (!filename.startsWith(projectRoot + path.sep)) throw new Error("outside project root");
    const body = await fs.readFile(filename);
    res.writeHead(200, { "Content-Type": path.extname(filename) === ".html" ? "text/html" : "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const applicationHtml = await fs.readFile(path.join(projectRoot, "index.html"), "utf8");
assert.doesNotMatch(applicationHtml, /tabler-icons|class=["'][^"']*\bti\s+ti-/, "the external Tabler icon family must not return");
assert.match(applicationHtml, /id="fluent-icon-sprite"/, "the local Fluent icon sprite must be present");
assert.match(applicationHtml, /id="fui-apps"/, "the Fluent navigation family must be embedded");
assert.match(applicationHtml, /AQP analytical Q icon|Analytical-Q identity/, "the analytical-Q identity must be present");
assert.match(applicationHtml, /aqp-mark aqp-lockup-mark/, "primary headers must use the analytical-Q lockup");
assert.match(applicationHtml, /class="sp-grid"/, "the Assessment Pulse splash must retain its ECG-style grid");
assert.match(applicationHtml, /From responses to confident review/, "the approved splash slogan must be present");
assert.match(applicationHtml, /Institutional sign-in/, "the splash must include the institutional authentication placeholder");
assert.match(applicationHtml, /No credentials are requested or stored/, "the authentication placeholder must explain its privacy boundary");
assert.match(applicationHtml, /window\.addEventListener\('load',startSplashSequence/, "the sign-in preview timer must start after the application finishes loading");
assert.match(applicationHtml, /spPulseReveal 1\.8s/, "the ECG draw must remain visibly staged before the identity appears");
assert.match(applicationHtml, /sp-identity-shifted/, "the identity shift must be a separate stage before sign-in appears");
assert.doesNotMatch(applicationHtml, /id="sp-pct"|id="sp-fill"/, "the splash must not imply artificial loading progress");
assert.match(applicationHtml, /APP_BUILD\s*=\s*'20261007-01'/, "the feedback-parser strengthening build must be stamped");
assert.match(applicationHtml, /class="btn-dl-secondary da-method-btn"[^>]+aria-expanded="false"[^>]+aria-controls="da-methodology-panel"/, "Distractor methodology must use an accessible disclosure control");
assert.match(applicationHtml, /class="app-version-pill"/, "the footer version must use the theme-aware pill");
assert.match(applicationHtml, /id="btn-appearance-topbar"/, "the top bar must expose the approved quick Appearance control");
assert.match(applicationHtml, /id="appearance-popover"[^>]*role="dialog"/, "the quick Appearance control must expose a named dialog");
assert.match(applicationHtml, /is a browser-based workspace for reviewing multiple-choice exam performance and student feedback/, "the About modal must use the approved product description");
assert.match(applicationHtml, /function buildDifReportOverviewHtml\(/, "DIF previews need the current KPI overview");
assert.match(applicationHtml, /function buildDifKpiCanvas\(/, "DIF Word exports need the current KPI overview");
assert.match(applicationHtml, /rImgDifKpiFull/, "the combined Word report must include the DIF KPI overview");
assert.match(applicationHtml, /unresolvedCount: unresolvedCount, attributedRows: attributedRows/, "Feedback previews need current routing metrics");
assert.match(applicationHtml, /1250000[\s\S]*320000/, "the Word-report AQP wordmark must retain its corrected aspect ratio");
assert.match(applicationHtml, /id="fb-config-card"/, "feedback-only analysis must use the shared Configure step");
assert.match(applicationHtml, /Feedback review dark-mode parity/, "feedback assignment controls need an explicit Dark Mode parity layer");
assert.match(applicationHtml, /Not used in feedback-only analysis/, "MCQ-only rooms need an explicit feedback-only state");

let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());

  const structure = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll("[id]")).map(el => el.id);
    const duplicateIds = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).map(el => ({
      id: el.id,
      labelledby: el.getAttribute("aria-labelledby"),
      label: el.getAttribute("aria-label"),
    }));
    const unnamedDialogs = dialogs.filter(d => !d.label && (!d.labelledby || !document.getElementById(d.labelledby)));
    const switches = Array.from(document.querySelectorAll('[role="switch"]')).map(el => ({
      id: el.id,
      checked: el.getAttribute("aria-checked"),
      label: el.getAttribute("aria-label"),
    }));
    return { duplicateIds, unnamedDialogs, switches };
  });
  assert.deepEqual(structure.duplicateIds, [], "IDs must be unique for reliable accessible relationships");
  assert.deepEqual(structure.unnamedDialogs, [], "every dialog needs an accessible name");
  assert.ok(structure.switches.every(s => /^(true|false)$/.test(s.checked) && s.label), "switches need names and checked state");
  assert.ok(await page.locator("#theme-select").count(), "Settings must expose an independent brand control");
  assert.ok(await page.locator("#appearance-select").count(), "Settings must expose an independent appearance control");

  await page.waitForFunction(() => document.getElementById("splash-screen")?.classList.contains("sp-identity-shifted"));
  assert.equal(await page.locator("#splash-screen").evaluate(el => el.classList.contains("sp-auth-ready")), false, "the identity must move before sign-in rises into view");
  await page.waitForFunction(() => document.getElementById("splash-screen")?.classList.contains("sp-auth-ready"));
  assert.equal(await page.locator("#sp-auth-card").getAttribute("aria-hidden"), "false", "the sign-in preview must become available after startup");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "sp-auth-continue", "the sign-in preview must receive focus when it appears");
  await page.setViewportSize({ width: 716, height: 806 });
  await page.waitForTimeout(700);
  const inAppSplashLayout = await page.evaluate(() => {
    const identity = document.querySelector(".sp-lockup").getBoundingClientRect();
    const card = document.querySelector(".sp-auth-card").getBoundingClientRect();
    return { identityRight: identity.right, cardLeft: card.left, cardRight: card.right, viewport: innerWidth };
  });
  assert.ok(inAppSplashLayout.cardLeft > inAppSplashLayout.identityRight, `the in-app-browser splash must place sign-in beside the identity: ${JSON.stringify(inAppSplashLayout)}`);
  assert.ok(inAppSplashLayout.cardRight <= inAppSplashLayout.viewport, `the in-app-browser sign-in card must remain on screen: ${JSON.stringify(inAppSplashLayout)}`);
  await page.locator("#sp-auth-continue").click();
  await page.waitForFunction(() => getComputedStyle(document.getElementById("splash-screen")).display === "none");
  await page.setViewportSize({ width: 1280, height: 900 });

  const contrast = await page.evaluate(() => {
    function rgb(value) {
      const hex = value.trim().replace("#", "");
      return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    }
    function luminance(color) {
      const channels = rgb(color).map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4));
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
    }
    function ratio(a, b) {
      const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (lighter + .05) / (darker + .05);
    }
    const root = getComputedStyle(document.documentElement);
    const values = name => root.getPropertyValue(name).trim();
    const white = values("--c-bg");
    return {
      primary: ratio(values("--c-primary"), white),
      secondary: ratio(values("--c-secondary"), white),
      muted: ratio(values("--c-muted"), white),
      accent: ratio(values("--c-accent"), white),
    };
  });
  Object.entries(contrast).forEach(([name, ratio]) => assert.ok(ratio >= 4.5, `${name} text contrast is ${ratio.toFixed(2)}:1; expected at least 4.5:1`));

  await page.evaluate(() => openFAQ());
  const unnamedVisibleButtons = await page.evaluate(() => Array.from(document.querySelectorAll("button")).filter(el => el.getClientRects().length).filter(el => !(el.innerText.trim() || el.getAttribute("aria-label") || el.getAttribute("title"))).map(el => el.id || el.outerHTML.slice(0, 100)));
  assert.deepEqual(unnamedVisibleButtons, [], "visible buttons need accessible names");
  const firstFaq = page.locator("#faq-overlay .faq-q").first();
  await firstFaq.focus();
  assert.equal(await firstFaq.getAttribute("role"), "button");
  assert.equal(await firstFaq.getAttribute("aria-expanded"), "false");
  const answerId = await firstFaq.getAttribute("aria-controls");
  assert.ok(answerId);
  await page.keyboard.press("Enter");
  assert.equal(await firstFaq.getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator(`#${answerId}`).getAttribute("aria-labelledby"), await firstFaq.getAttribute("id"));
  await page.keyboard.press("Space");
  assert.equal(await firstFaq.getAttribute("aria-expanded"), "false");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#faq-overlay").evaluate(el => getComputedStyle(el).display), "none");

  const appearanceButton = page.locator("#btn-appearance-topbar");
  await page.evaluate(() => { applyTheme(""); applyAppearance("light"); });
  await appearanceButton.focus();
  await appearanceButton.press("Enter");
  assert.equal(await appearanceButton.getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator("#appearance-popover").getAttribute("role"), "dialog");
  await page.waitForFunction(() => document.activeElement?.classList.contains("appearance-choice"));
  await page.locator('[data-quick-brand="elentra"]').click();
  await page.locator('[data-quick-mode="dark"]').click();
  const quickAppearance = await page.evaluate(() => ({
    brand: document.documentElement.getAttribute("data-theme"),
    mode: document.documentElement.getAttribute("data-appearance-mode"),
    resolved: document.documentElement.getAttribute("data-appearance"),
    savedBrand: localStorage.getItem("ugme-theme"),
    savedMode: localStorage.getItem("ugme-appearance"),
    settingsBrand: document.getElementById("theme-select").value,
    settingsMode: document.getElementById("appearance-select").value,
    buttonLabel: document.getElementById("btn-appearance-topbar").getAttribute("aria-label"),
    icon: document.getElementById("appearance-mode-icon").getAttribute("href"),
    popoverSurface: getComputedStyle(document.getElementById("appearance-popover")).backgroundColor,
    popoverRight: Math.round(document.getElementById("appearance-popover").getBoundingClientRect().right),
    viewportWidth: document.documentElement.clientWidth,
  }));
  assert.deepEqual({ ...quickAppearance, popoverSurface: undefined, popoverRight: undefined, viewportWidth: undefined }, {
    brand: "elentra", mode: "dark", resolved: "dark",
    savedBrand: "elentra", savedMode: "dark",
    settingsBrand: "elentra", settingsMode: "dark",
    buttonLabel: "Appearance: Elentra, Dark", icon: "#fui-moon",
    popoverSurface: undefined, popoverRight: undefined, viewportWidth: undefined,
  });
  assert.doesNotMatch(quickAppearance.popoverSurface, /rgba?\(255, 255, 255/, "the quick Appearance panel must follow Dark Mode");
  assert.ok(quickAppearance.popoverRight <= quickAppearance.viewportWidth, "the quick Appearance panel must remain inside the viewport");
  await page.keyboard.press("Escape");
  assert.equal(await appearanceButton.getAttribute("aria-expanded"), "false");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "btn-appearance-topbar");
  await page.evaluate(() => { applyTheme(""); applyAppearance("light"); });

  const menu = page.locator("#btn-menu-topbar");
  await menu.focus();
  await menu.press("Enter");
  assert.equal(await menu.getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator("#hamburger-dropdown").getAttribute("role"), "menu");
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menuitem");
  const firstMenuItem = await page.evaluate(() => document.activeElement?.textContent.trim());
  await page.keyboard.press("ArrowDown");
  assert.notEqual(await page.evaluate(() => document.activeElement?.textContent.trim()), firstMenuItem);
  await page.keyboard.press("Escape");
  assert.equal(await menu.getAttribute("aria-expanded"), "false");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "btn-menu-topbar");

  const switchStates = await page.evaluate(() => {
    setSource("scantron");
    const sourceOn = document.getElementById("source-toggle-track").getAttribute("aria-checked");
    setSource("qm");
    const sourceOff = document.getElementById("source-toggle-track").getAttribute("aria-checked");
    const before = document.getElementById("dif-toggle-track").getAttribute("aria-checked");
    toggleDIF();
    const after = document.getElementById("dif-toggle-track").getAttribute("aria-checked");
    toggleDIF();
    return { sourceOn, sourceOff, before, after };
  });
  assert.deepEqual(switchStates, { sourceOn: "true", sourceOff: "false", before: "true", after: "false" });

  await page.evaluate(() => {
    document.getElementById("home-panel").style.display = "none";
    document.getElementById("setup-panel").style.display = "block";
    document.getElementById("exam-title").value = "Synthetic feedback workflow";
    selectAnalysisType("fb");
  });
  await page.waitForTimeout(450);
  const feedbackConfigure = await page.evaluate(() => ({
    step: G_WIZARD_STEP,
    feedbackCard: getComputedStyle(document.getElementById("fb-config-card")).display,
    mcqCard: getComputedStyle(document.getElementById("mcq-config-card")).display,
    questionCountInConfigure: !!document.querySelector("#fb-config-card #fb-max-q"),
    nextLabel: document.getElementById("configure-next-label").textContent,
  }));
  assert.equal(feedbackConfigure.step, 3, "feedback-only analysis must visit Configure before Upload");
  assert.notEqual(feedbackConfigure.feedbackCard, "none");
  assert.equal(feedbackConfigure.mcqCard, "none");
  assert.equal(feedbackConfigure.questionCountInConfigure, true);
  assert.match(feedbackConfigure.nextLabel, /feedback export/i);
  await page.evaluate(() => wizardGoTo(4));
  await page.waitForTimeout(450);
  const feedbackUpload = await page.evaluate(() => ({
    step: G_WIZARD_STEP,
    uploadVisible: getComputedStyle(document.getElementById("setup-tab-fb")).display,
    questionCountInUpload: !!document.querySelector("#setup-tab-fb #fb-max-q"),
    heading: document.querySelector("#setup-tab-fb .section-hdr-title")?.textContent,
  }));
  assert.equal(feedbackUpload.step, 4);
  assert.notEqual(feedbackUpload.uploadVisible, "none");
  assert.equal(feedbackUpload.questionCountInUpload, false, "question count belongs in Configure, not the upload screen");
  assert.equal(feedbackUpload.heading, "Feedback Data");
  await page.evaluate(() => wizardBackTo(3));
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(() => G_WIZARD_STEP), 3, "feedback-only Back must return to Configure");

  const feedbackOnlyRooms = await page.evaluate(() => {
    ExamSession.hasFeedback = true;
    ExamSession.hasMcq = false;
    const targets = {
      mcq: "#main-section-analysis",
      dif: "#main-section-analysis",
      distractor: "#room-distractor",
      exceptions: "#room-exceptions",
      nearthreshold: "#room-nearthreshold",
      queue: "#main-section-review",
    };
    const states = {};
    Object.entries(targets).forEach(([room, selector]) => {
      switchRoom(room);
      const container = document.querySelector(selector);
      states[room] = {
        title: container.querySelector(".feedback-only-room-state:not([hidden]) .room-empty-title, #da-content .room-empty-title, #nt-content .room-empty-title")?.textContent.trim(),
        body: container.querySelector(".feedback-only-room-state:not([hidden]) .room-empty-sub, #da-content .room-empty-sub, #nt-content .room-empty-sub")?.textContent.trim(),
      };
    });
    switchRoom("reports");
    states.reports = { feedbackOnlyState: !!document.querySelector("#main-section-reports .feedback-only-room-state:not([hidden])") };
    return states;
  });
  for (const room of ["mcq", "dif", "distractor", "exceptions", "nearthreshold", "queue"]) {
    assert.equal(feedbackOnlyRooms[room].title, "Not used in feedback-only analysis", `${room} needs the shared feedback-only state`);
    assert.match(feedbackOnlyRooms[room].body, /MCQ/i, `${room} needs to explain its MCQ dependency`);
  }
  assert.equal(feedbackOnlyRooms.reports.feedbackOnlyState, false, "feedback Reports must remain available");

  await page.evaluate(() => loadDemonstrationSession(true));
  await page.waitForFunction(() => G._lastN === 40 && G.mcq?.length === 12);
  await page.evaluate(() => applyAppearance("dark"));
  await page.waitForTimeout(250);
  const darkMode = await page.evaluate(() => {
    const color = selector => getComputedStyle(document.querySelector(selector)).backgroundColor;
    openSettings();
    const modalShell = color("#settings-modal > div");
    const modalHeader = color("#settings-modal > div > div:first-child");
    const profileBadge = color("#settings-profile-badge");
    cancelSettings();
    return {
      appearance: document.documentElement.getAttribute("data-appearance"),
      versionPill: color(".app-version-pill"),
      menu: color("#hamburger-dropdown"),
      modalShell,
      modalHeader,
      profileBadge,
      sessionPill: color("#session-pills .session-pill"),
    };
  });
  assert.equal(darkMode.appearance, "dark", `Dark Mode must resolve before visual checks: ${JSON.stringify(darkMode)}`);
  assert.doesNotMatch(darkMode.versionPill, /rgba?\(255, 255, 255/, "the Dark Mode version pill must not retain a light fill");
  assert.doesNotMatch(darkMode.menu, /rgba?\(255, 255, 255/, "the Dark Mode menu must use a solid dark surface");
  assert.doesNotMatch(darkMode.modalShell, /rgba?\(255, 255, 255/, "modal bodies must follow Dark Mode");
  assert.doesNotMatch(darkMode.profileBadge, /rgba?\(232, 245, 233/, "modal badges must follow Dark Mode");
  assert.doesNotMatch(darkMode.sessionPill, /rgba?\(255, 255, 255/, "session pills must follow Dark Mode");
  assert.notEqual(darkMode.modalHeader, darkMode.modalShell, "modal headers need a distinct brand-colour surface");
  const feedbackDarkMode = await page.evaluate(() => {
    const saved = FB;
    FB = {
      raw: [], grouped: {}, bareRefs: {}, general: [], ready: true,
      parsed: [
        { text: "Synthetic pending comment", qNums: [], status: "pending", rawIdx: 0, _staged: [12] },
        { text: "Synthetic resolved comment", qNums: [4], mappedQs: [4], status: "mapped", rawIdx: 1 },
        { text: "Synthetic general comment", qNums: [], status: "general", rawIdx: 2 },
        { text: "Synthetic discarded comment", qNums: [], status: "discard", rawIdx: 3 }
      ],
      pending: [0, 1, 2, 3]
    };
    renderMappingScreen();
    const style = selector => {
      const el = document.querySelector(selector);
      const css = el ? getComputedStyle(el) : null;
      return css ? { background: css.backgroundColor, color: css.color } : null;
    };
    const result = {
      input: style(".fb-map-input"),
      staged: style('[style*="background:#e8f0fd"]'),
      resolved: style(".fb-map-row.resolved-mapped"),
      general: style(".fb-map-row.resolved-general"),
      discarded: style(".fb-map-row.resolved-discard"),
      columns: getComputedStyle(document.querySelector(".fb-map-columns")).gridTemplateColumns,
      rowColumns: getComputedStyle(document.querySelector(".fb-map-main")).gridTemplateColumns,
      controls: getComputedStyle(document.querySelector(".fb-map-controls")).gridTemplateColumns,
    };
    FB = saved;
    return result;
  });
  assert.ok(feedbackDarkMode.input && feedbackDarkMode.staged && feedbackDarkMode.resolved && feedbackDarkMode.general && feedbackDarkMode.discarded, "feedback mapping Dark Mode fixtures must render");
  assert.doesNotMatch(feedbackDarkMode.input.background, /rgba?\(255, 255, 255/, "manual assignment inputs must not retain a light fill");
  assert.doesNotMatch(feedbackDarkMode.staged.background, /rgb\(232, 240, 253\)/, "staged question badges must use a Dark Mode surface");
  assert.doesNotMatch(feedbackDarkMode.resolved.background, /rgb\(240, 253, 244\)/, "resolved feedback rows must use a Dark Mode surface");
  assert.notEqual(feedbackDarkMode.general.background, feedbackDarkMode.discarded.background, "General and Discarded comments need distinct resolved states");
  assert.notEqual(feedbackDarkMode.resolved.background, feedbackDarkMode.discarded.background, "Discarded comments must not retain the mapped green state");
  assert.equal(feedbackDarkMode.columns, feedbackDarkMode.rowColumns, "Unmapped headers and rows must share the same column grid");
  assert.match(feedbackDarkMode.controls, /164px 28px 60px 58px/, "Unmapped controls must use the Feedback Review alignment rhythm");
  await page.evaluate(() => switchRoom("reports"));
  const previewTrigger = page.locator("#rp-card-mcq button, #rp-card-mcq").first();
  await previewTrigger.focus();
  await page.evaluate(() => openReportPreviewModal("mcq"));
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Close preview");
  const paperPreview = await page.evaluate(() => {
    const body = getComputedStyle(document.querySelector("#report-preview-modal #rpm-body"));
    const flagged = document.querySelector("#report-preview-modal tr.row-flagged td");
    return { body: body.backgroundColor, flagged: flagged ? getComputedStyle(flagged).backgroundColor : null };
  });
  assert.equal(paperPreview.body, "rgb(255, 255, 255)", "report previews must stay paper-white in Dark Mode");
  if (paperPreview.flagged) assert.equal(paperPreview.flagged, "rgb(255, 248, 230)", "flagged report rows must retain the light-paper highlight");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#report-preview-modal").evaluate(el => getComputedStyle(el).display), "none");

  const targets = await page.evaluate(() => {
    const selectors = [".alpha-info-btn", ".expand-btn"];
    return selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)).filter(el => el.getClientRects().length).map(el => {
      const r = el.getBoundingClientRect(); return { selector, width: r.width, height: r.height };
    }));
  });
  assert.ok(targets.every(t => t.width >= 24 && t.height >= 24), `interactive targets must be at least 24px: ${JSON.stringify(targets)}`);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotion = await page.evaluate(() => {
    const el = document.querySelector(".room.room-active, .main-section.active");
    const style = el ? getComputedStyle(el) : null;
    return style ? { animation: style.animationName, duration: style.animationDuration } : null;
  });
  assert.ok(!reducedMotion || reducedMotion.animation === "none" || reducedMotion.duration === "0s");

  await page.setViewportSize({ width: 320, height: 800 });
  await page.evaluate(() => { closeReportPreviewModal(); goHome(); });
  const narrow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
    primaryActionVisible: !!Array.from(document.querySelectorAll("button")).find(el => el.getClientRects().length && /new analysis|start/i.test(el.textContent)),
    offenders: Array.from(document.querySelectorAll("body *")).filter(el => el.getClientRects().length && el.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 8).map(el => ({ tag: el.tagName, id: el.id, className: String(el.className), right: Math.round(el.getBoundingClientRect().right), width: Math.round(el.getBoundingClientRect().width) })),
  }));
  assert.ok(narrow.bodyWidth <= narrow.viewport + 1, `page must reflow at 320px (${narrow.bodyWidth}px > ${narrow.viewport}px): ${JSON.stringify(narrow.offenders)}`);
  assert.equal(narrow.primaryActionVisible, true, "a primary start action must remain available at narrow width");

  assert.deepEqual(pageErrors, []);
  console.log("PASS: keyboard, focus, dialog, switch, target-size, reduced-motion, and narrow-reflow accessibility checks passed.");
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}

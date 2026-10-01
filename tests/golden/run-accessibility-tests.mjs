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

  await page.evaluate(() => { document.getElementById("splash-screen").style.display = "none"; openFAQ(); });
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

  await page.evaluate(() => loadDemonstrationSession(true));
  await page.waitForFunction(() => G._lastN === 40 && G.mcq?.length === 12);
  await page.evaluate(() => switchRoom("reports"));
  const previewTrigger = page.locator("#rp-card-mcq button, #rp-card-mcq").first();
  await previewTrigger.focus();
  await page.evaluate(() => openReportPreviewModal("mcq"));
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Close preview");
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

import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing required argument ${name}`);
  return path.resolve(process.argv[index + 1]);
}

const resultsPath = argument("--results");
const keyPath = argument("--key");
const outputPath = argument("--output");
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function sha256(filename) {
  const bytes = await fs.readFile(filename);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

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
  const alerts = [];
  page.on("dialog", async dialog => { alerts.push(dialog.message()); await dialog.dismiss(); });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded" });
  if (!(await page.evaluate(() => typeof window.XLSX !== "undefined"))) {
    await page.addScriptTag({ path: path.join(projectRoot, "tests", "golden", "xlsx.full.min.js") });
  }
  await page.waitForFunction(() => typeof window.XLSX !== "undefined", null, { timeout: 30000 });
  await page.evaluate(() => {
    localStorage.clear();
    G_ANALYSIS_TYPE = "mcq";
    G_SOURCE = "qm";
    G_DIF_ENABLED = true;
    document.getElementById("eng-code").value = "E";
    document.getElementById("fre-code").value = "F";
    document.getElementById("exam-title").value = "Private validation exam";
    document.getElementById("exam-date").value = "2026-09-25";
  });

  await page.setInputFiles("#fi-main", resultsPath);
  await page.waitForFunction(() => G.students && G.students.length > 0 && G.nQ > 0);
  await page.setInputFiles("#fi-key", keyPath);
  await page.waitForFunction(() => G.key && G.key.length > 0);
  await page.evaluate(() => {
    const blockers = qmUploadBlockers();
    if (blockers.length) throw new Error(`Operational inputs failed AQP upload validation: ${blockers.join(" | ")}`);
    confirmParsePreview("qm");
    _runAnalysis();
  });
  await page.waitForFunction(() => G._lastN > 0 && G.mcq && G.mcq.length > 0);

  const snapshot = await page.evaluate(() => ({
    privacy: {
      containsStudentNames: false,
      containsStudentIds: false,
      containsResponses: false,
      containsAnswerKey: false,
      containsFeedbackText: false,
    },
    parser: {
      students: G.students.length,
      scoredQuestions: G.nQ,
      disclosureDetected: G._hasDisclosure,
      questionLabels: G.qLabels.slice(),
    },
    exam: {
      averagePct: Number(G._lastAvg.toFixed(9)),
      cronbachAlpha: Number(G._lastAlpha.toFixed(12)),
      englishStudents: G._lastNE,
      frenchStudents: G._lastNF,
      englishAveragePct: G._lastEAvg,
      frenchAveragePct: G._lastFAvg,
    },
    items: G.mcq.map(q => ({
      number: q.num,
      label: q.q,
      difficulty: q.p == null ? null : Number(q.p.toFixed(12)),
      discrimination: q.rpbis == null ? null : Number(q.rpbis.toFixed(12)),
      flag: q.flag,
      recommendation: q.rec,
      responses: q.n,
    })),
    dif: G.dif.map(d => ({
      number: d.num,
      label: d.q,
      block1ChiSquare: Number(d.chi1),
      block1NagelkerkeR2: Number(d.r1),
      block3ChiSquare: Number(d.chi3),
      block3NagelkerkeR2: Number(d.r3),
      chiSquareDifference: Number(d.cd),
      deltaR2: Math.abs(Number(d.rd)),
      pValue: Number(d.sig),
      englishPct: d.ePct,
      frenchPct: d.fPct,
      flagged: d.imp,
      sparse: d.lowN,
      modelFailed: d.modelFailed,
    })),
    scoreValidation: { ...G._scoreValidation },
  }));
  snapshot.sourceHashes = { resultsSha256: await sha256(resultsPath), keySha256: await sha256(keyPath) };
  snapshot.alerts = alerts.map(message => message.replace(/\b[A-Z]?\d{6,10}\b/g, "[redacted]"));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`Captured privacy-safe AQP statistics: ${snapshot.parser.students} students, ${snapshot.parser.scoredQuestions} scored questions.`);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}

// Rebuild all .trae-html-share-packages/*.zip from working tree, using the
// existing zip file lists as ground truth (so content stays in sync after edits).
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PKG = path.join(ROOT, ".trae-html-share-packages");
const TMP = path.join(PKG, ".build");

function listZip(zipPath) {
  const out = execSync(`unzip -l "${zipPath}"`).toString();
  const files = [];
  out.split("\n").forEach((line) => {
    const m = line.match(/^\s+\d+\s+[\d-]+\s+[\d:]+\s+(.+)$/);
    if (m && !m[1].endsWith("/")) files.push(m[1]);
  });
  return files;
}

// Delete the old fib zip so we can add it fresh
const fibZip = path.join(PKG, "game_fib.html.zip");
if (fs.existsSync(fibZip)) fs.rmSync(fibZip);

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

for (const zipName of fs.readdirSync(PKG).filter((f) => f.endsWith(".zip"))) {
  const old = path.join(PKG, zipName);
  const files = listZip(old);
  const dir = path.join(TMP, zipName.replace(/\.zip$/, ""));
  fs.mkdirSync(dir, { recursive: true });
  const missing = [];
  for (const f of files) {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src)) { missing.push(f); continue; }
    const dst = path.join(dir, f);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
  if (missing.length) { console.log("SKIP " + zipName + " missing: " + missing.join(",")); continue; }
  execSync(`cd "${dir}" && zip -q -r "${old}" .`);
  console.log("rebuilt " + zipName + " (" + fs.statSync(old).size + " bytes)");
}
fs.rmSync(TMP, { recursive: true, force: true });

// Now create game_fib.html.zip alongside the others
const FONTS = [
  "style/fonts/clear-sans.css",
  "style/fonts/ClearSans-Regular-webfont.eot", "style/fonts/ClearSans-Regular-webfont.svg",
  "style/fonts/ClearSans-Regular-webfont.woff", "style/fonts/ClearSans-Bold-webfont.eot",
  "style/fonts/ClearSans-Bold-webfont.svg", "style/fonts/ClearSans-Bold-webfont.woff",
  "style/fonts/ClearSans-Light-webfont.eot", "style/fonts/ClearSans-Light-webfont.svg",
  "style/fonts/ClearSans-Light-webfont.woff",
];
const SHARED = ["index.html", "js/spa.js", "style/spa.css", "js/swipe.js", "js/sfx.js", "favicon.ico"].concat(FONTS);
const fibFiles = ["game_fib.html", "js/fib2048.js", "js/assist.js", "style/ui.css", "style/fib.css"].concat(SHARED);
const dir = path.join(TMP, "game_fib");
fs.mkdirSync(dir, { recursive: true });
for (const f of fibFiles) {
  const src = path.join(ROOT, f);
  const dst = path.join(dir, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
execSync(`cd "${dir}" && zip -q -r "${fibZip}" .`);
console.log("created " + path.basename(fibZip) + " (" + fs.statSync(fibZip).size + " bytes)");
fs.rmSync(TMP, { recursive: true, force: true });
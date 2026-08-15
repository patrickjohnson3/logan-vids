"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const APP_SCRIPTS = [
  "youtube.js",
  "state.js",
  "speech.js",
  "render-parent.js",
  "render-kid.js",
  "player.js",
  "toml.js",
  "app.js"
];
const PAGE_SCRIPTS = {
  "index.html": APP_SCRIPTS,
  "tests.html": [...APP_SCRIPTS, "tests.js"]
};

function readRepositoryFile(fileName) {
  return fs.readFileSync(path.join(ROOT, fileName), "utf8");
}

function findRequiredIds() {
  const appSource = readRepositoryFile("app.js");
  const ids = Array.from(
    appSource.matchAll(/getRequiredElement\("([^"]+)"\)/g),
    (match) => match[1]
  );
  return [...new Set(ids)];
}

function countHtmlIds(html) {
  const counts = new Map();
  for (const match of html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
    counts.set(match[1], (counts.get(match[1]) || 0) + 1);
  }
  return counts;
}

function findExternalScripts(html) {
  return Array.from(
    html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi),
    (match) => match[1]
  );
}

const failures = [];
const requiredIds = findRequiredIds();

if (requiredIds.length === 0) {
  failures.push("app.js did not expose any getRequiredElement() IDs to validate.");
}

for (const [fileName, expectedScripts] of Object.entries(PAGE_SCRIPTS)) {
  const html = readRepositoryFile(fileName);
  const idCounts = countHtmlIds(html);

  for (const id of requiredIds) {
    const count = idCounts.get(id) || 0;
    if (count === 0) failures.push(`${fileName} is missing required startup ID #${id}.`);
    if (count > 1) failures.push(`${fileName} contains required startup ID #${id} ${count} times.`);
  }

  const actualScripts = findExternalScripts(html);
  if (actualScripts.join("\n") !== expectedScripts.join("\n")) {
    failures.push([
      `${fileName} has the wrong classic-script order.`,
      `  Expected: ${expectedScripts.join(" -> ")}`,
      `  Found:    ${actualScripts.join(" -> ") || "none"}`
    ].join("\n"));
  }
}

if (failures.length > 0) {
  console.error(`Structure validation failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Structure validation passed for ${requiredIds.length} startup IDs and both script lists.`);
}

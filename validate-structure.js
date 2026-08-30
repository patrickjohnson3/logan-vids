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
const REQUIRED_ELEMENT_CONTRACTS = {
  homeScreen: { classTokens: ["screen", "active"] },
  unlockScreen: { classTokens: ["screen"] },
  parentScreen: { classTokens: ["screen"] },
  kidScreen: { classTokens: ["screen"] },
  playerScreen: { classTokens: ["screen"] },
  parentTitle: { attributes: { tabindex: "-1" } },
  kidTitle: { attributes: { tabindex: "-1" } },
  playerTitle: { attributes: { tabindex: "-1" } },
  playerFrameWrap: {
    attributes: {
      role: "group",
      "aria-labelledby": "playerTitle",
      "aria-busy": "false"
    }
  },
  favoriteButton: { attributes: { "aria-pressed": "false" } }
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

function findElementOpeningTag(html, id) {
  const idPattern = new RegExp(`\\bid\\s*=\\s*["']${id}["']`, "i");
  for (const match of html.matchAll(/<([A-Za-z][A-Za-z0-9-]*)\b[^>]*>/g)) {
    if (!idPattern.test(match[0])) continue;
    return {
      index: match.index,
      source: match[0],
      tagName: match[1].toLowerCase()
    };
  }
  return null;
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? match[1] : null;
}

function validateElementContracts(html, fileName) {
  for (const [id, contract] of Object.entries(REQUIRED_ELEMENT_CONTRACTS)) {
    const element = findElementOpeningTag(html, id);
    if (!element) continue;

    for (const [name, expectedValue] of Object.entries(contract.attributes || {})) {
      if (getAttribute(element.source, name) !== expectedValue) {
        failures.push(`${fileName} #${id} must have ${name}="${expectedValue}".`);
      }
    }

    const classTokens = new Set((getAttribute(element.source, "class") || "").split(/\s+/));
    for (const className of contract.classTokens || []) {
      if (!classTokens.has(className)) {
        failures.push(`${fileName} #${id} must include class "${className}".`);
      }
    }
  }

  const kidOrder = ["favoritesRow", "kidVideoGrid", "kidParentButton"]
    .map((id) => ({ id, element: findElementOpeningTag(html, id) }));
  for (let index = 1; index < kidOrder.length; index += 1) {
    if (kidOrder[index - 1].element.index >= kidOrder[index].element.index) {
      failures.push(
        `${fileName} #${kidOrder[index].id} must follow #${kidOrder[index - 1].id} in Kid Mode.`,
      );
    }
  }

  for (const formId of ["unlockForm", "addVideoForm"]) {
    const form = findElementOpeningTag(html, formId);
    if (!form || form.tagName !== "form") {
      failures.push(`${fileName} #${formId} must remain a form.`);
      continue;
    }
    const formEnd = html.indexOf("</form>", form.index + form.source.length);
    const formBody = formEnd === -1
      ? ""
      : html.slice(form.index + form.source.length, formEnd);
    if (!/<button\b[^>]*\btype\s*=\s*["']submit["'][^>]*>/i.test(formBody)) {
      failures.push(`${fileName} #${formId} must contain a submit button.`);
    }
  }
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

  validateElementContracts(html, fileName);

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

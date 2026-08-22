"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

const ROOT = __dirname;
const TEST_BASE_URL = new URL("https://example.test/logan-vids/");
const failures = [];

function readRepositoryFile(fileName) {
  return fs.readFileSync(path.join(ROOT, fileName), "utf8");
}

function addFailure(message) {
  failures.push(message);
}

function findLinkHref(html, relation) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1] || "";
    if (!rel.split(/\s+/).includes(relation)) continue;
    return tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] || "";
  }
  return "";
}

function findMetaContent(html, name) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const metaName = tag.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1] || "";
    if (metaName !== name) continue;
    return tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1] || "";
  }
  return "";
}

function normalizeLocalReference(reference, description) {
  if (typeof reference !== "string" || !reference) {
    addFailure(`${description} must be a non-empty local path.`);
    return "";
  }

  let url;
  try {
    url = new URL(reference, TEST_BASE_URL);
  } catch {
    addFailure(`${description} is not a valid URL: ${reference}`);
    return "";
  }
  if (url.origin !== TEST_BASE_URL.origin || !url.pathname.startsWith(TEST_BASE_URL.pathname)) {
    addFailure(`${description} must stay inside the application scope: ${reference}`);
    return "";
  }

  return decodeURIComponent(url.pathname.slice(TEST_BASE_URL.pathname.length));
}

function readPngSize(fileName) {
  const data = fs.readFileSync(path.join(ROOT, fileName));
  const signature = "89504e470d0a1a0a";
  if (data.length < 24 || data.subarray(0, 8).toString("hex") !== signature) {
    addFailure(`${fileName} is not a valid PNG file.`);
    return null;
  }
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20)
  };
}

function getShellFileName(asset) {
  if (asset === "./") return "index.html";
  return normalizeLocalReference(asset, "Application-shell asset");
}

function calculateShellDigest(assets) {
  const hash = crypto.createHash("sha256");

  for (const asset of assets) {
    const fileName = getShellFileName(asset);
    if (!fileName || !fs.existsSync(path.join(ROOT, fileName))) return "";

    hash.update(asset);
    hash.update("\0");
    hash.update(fs.readFileSync(path.join(ROOT, fileName)));
    hash.update("\0");
  }

  return hash.digest("hex").slice(0, 12);
}

const indexHtml = readRepositoryFile("index.html");
const appSource = readRepositoryFile("app.js");
const serviceWorkerSource = readRepositoryFile("service-worker.js");
const manifestReference = findLinkHref(indexHtml, "manifest");
const manifestFile = normalizeLocalReference(manifestReference, "Manifest link");

let manifest = null;
if (manifestFile && fs.existsSync(path.join(ROOT, manifestFile))) {
  try {
    manifest = JSON.parse(readRepositoryFile(manifestFile));
  } catch (error) {
    addFailure(`${manifestFile} is not valid JSON: ${error.message}`);
  }
} else if (manifestFile) {
  addFailure(`Manifest file does not exist: ${manifestFile}`);
}

const shellMatch = serviceWorkerSource.match(/const APP_SHELL = (\[[\s\S]*?\n\]);/);
let shellAssets = [];
if (!shellMatch) {
  addFailure("service-worker.js must define a JSON-compatible APP_SHELL array.");
} else {
  try {
    shellAssets = JSON.parse(shellMatch[1]);
  } catch (error) {
    addFailure(`APP_SHELL could not be parsed: ${error.message}`);
  }
}

if (!appSource.includes('navigator.serviceWorker.register("./service-worker.js")')) {
  addFailure("app.js must register ./service-worker.js.");
}
if (serviceWorkerSource.includes("skipWaiting(")) {
  addFailure("service-worker.js must not activate updates during an active session.");
}
const cacheNameMatch = serviceWorkerSource.match(/const CACHE_NAME = "([^"]+)";/);
const cacheName = cacheNameMatch?.[1] || "";
if (!cacheNameMatch) addFailure("service-worker.js must define CACHE_NAME as a string.");

const shellSet = new Set(shellAssets);
if (shellSet.size !== shellAssets.length) {
  addFailure("APP_SHELL must not contain duplicate assets.");
}
const requiredShellAssets = new Set(["./", "./index.html"]);
for (const match of indexHtml.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
  requiredShellAssets.add(`./${normalizeLocalReference(match[1], "Application script")}`);
}
const stylesheetReference = findLinkHref(indexHtml, "stylesheet");
requiredShellAssets.add(`./${normalizeLocalReference(stylesheetReference, "Stylesheet")}`);
if (manifestFile) requiredShellAssets.add(`./${manifestFile}`);

if (manifest) {
  const requiredStrings = ["name", "short_name", "start_url", "scope", "display", "background_color", "theme_color"];
  requiredStrings.forEach((key) => {
    if (typeof manifest[key] !== "string" || !manifest[key]) {
      addFailure(`Manifest field ${key} must be a non-empty string.`);
    }
  });

  if (manifest.display !== "standalone") {
    addFailure('Manifest display must be "standalone".');
  }
  if (findMetaContent(indexHtml, "theme-color") !== manifest.theme_color) {
    addFailure("index.html theme-color must match the manifest theme_color.");
  }

  try {
    const startUrl = new URL(manifest.start_url || "", TEST_BASE_URL);
    const scopeUrl = new URL(manifest.scope || "", TEST_BASE_URL);
    if (startUrl.origin !== scopeUrl.origin || !startUrl.pathname.startsWith(scopeUrl.pathname)) {
      addFailure("Manifest start_url must be inside its scope.");
    }
  } catch {
    addFailure("Manifest start_url and scope must be valid URLs.");
  }

  const iconPurposes = new Set();
  for (const icon of Array.isArray(manifest.icons) ? manifest.icons : []) {
    const iconFile = normalizeLocalReference(icon.src, "Manifest icon");
    if (!iconFile) continue;
    requiredShellAssets.add(`./${iconFile}`);
    if (!fs.existsSync(path.join(ROOT, iconFile))) {
      addFailure(`Manifest icon does not exist: ${iconFile}`);
      continue;
    }
    if (icon.type !== "image/png") {
      addFailure(`${iconFile} must declare type image/png.`);
    }
    const size = readPngSize(iconFile);
    if (size && icon.sizes !== `${size.width}x${size.height}`) {
      addFailure(`${iconFile} declares ${icon.sizes}, but is ${size.width}x${size.height}.`);
    }
    String(icon.purpose || "any").split(/\s+/).forEach((purpose) => {
      iconPurposes.add(`${icon.sizes}:${purpose}`);
    });
  }

  if (!iconPurposes.has("192x192:any")) addFailure("Manifest needs a 192x192 any-purpose icon.");
  if (!iconPurposes.has("512x512:any")) addFailure("Manifest needs a 512x512 any-purpose icon.");
  if (!iconPurposes.has("512x512:maskable")) addFailure("Manifest needs a 512x512 maskable icon.");
}

const iconReference = findLinkHref(indexHtml, "icon");
if (iconReference) {
  const iconFile = normalizeLocalReference(iconReference, "Page icon");
  if (iconFile) requiredShellAssets.add(`./${iconFile}`);
}

for (const asset of shellAssets) {
  const fileName = getShellFileName(asset);
  if (!fileName) continue;
  if (!fs.existsSync(path.join(ROOT, fileName))) {
    addFailure(`Application-shell asset does not exist: ${asset}`);
  }
}

const shellDigest = calculateShellDigest(shellAssets);
if (shellDigest) {
  const expectedCacheName = `repeat-logan-vids-shell-${shellDigest}`;
  if (cacheName !== expectedCacheName) {
    addFailure(
      `CACHE_NAME does not match the application shell. Set it to "${expectedCacheName}".`,
    );
  }
}

for (const requiredAsset of requiredShellAssets) {
  if (!shellSet.has(requiredAsset)) {
    addFailure(`APP_SHELL is missing required local asset: ${requiredAsset}`);
  }
}

if (failures.length > 0) {
  console.error(`PWA validation failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `PWA validation passed for ${shellAssets.length} shell assets, ${manifest.icons.length} icons, and cache revision ${shellDigest}.`,
  );
}

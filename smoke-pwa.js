"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const ROOT = __dirname;
const TEST_MARKER = '<meta name="pwa-smoke-version" content="old">';
const OLD_CACHE_NAME = "repeat-logan-vids-shell-smoke-old";

function parseServiceWorker(source) {
  const cacheMatch = source.match(/const CACHE_NAME = "([^"]+)";/);
  const shellMatch = source.match(/const APP_SHELL = (\[[\s\S]*?\n\]);/);
  if (!cacheMatch || !shellMatch) {
    throw new Error("service-worker.js must expose CACHE_NAME and a JSON-compatible APP_SHELL.");
  }

  return {
    cacheName: cacheMatch[1],
    shellAssets: JSON.parse(shellMatch[1])
  };
}

function shellFileName(asset) {
  if (asset === "./") return "index.html";
  const baseUrl = new URL("http://repeat.test/");
  const url = new URL(asset, baseUrl);
  if (url.origin !== baseUrl.origin || !url.pathname.startsWith(baseUrl.pathname)) {
    throw new Error(`Application-shell asset must be local: ${asset}`);
  }
  return decodeURIComponent(url.pathname.slice(baseUrl.pathname.length));
}

function copyDeployment(targetRoot, shellAssets) {
  const files = new Set(shellAssets.map(shellFileName));
  files.add("service-worker.js");

  for (const fileName of files) {
    const destination = path.join(targetRoot, fileName);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(ROOT, fileName), destination);
  }
}

function createOldDeployment(targetRoot, currentCacheName) {
  const indexFile = path.join(targetRoot, "index.html");
  const serviceWorkerFile = path.join(targetRoot, "service-worker.js");
  const oldIndex = fs.readFileSync(indexFile, "utf8")
    .replace("<head>", `<head>\n    ${TEST_MARKER}`);
  const oldWorker = fs.readFileSync(serviceWorkerFile, "utf8")
    .replace(
      `const CACHE_NAME = "${currentCacheName}";`,
      `const CACHE_NAME = "${OLD_CACHE_NAME}";`,
    );

  fs.writeFileSync(indexFile, oldIndex);
  fs.writeFileSync(serviceWorkerFile, oldWorker);
}

function contentType(fileName) {
  const extension = path.extname(fileName);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".webmanifest") return "application/manifest+json; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  return "application/octet-stream";
}

function startServer(root) {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1/");
    let relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
    if (!relativePath || relativePath.endsWith("/")) relativePath += "index.html";

    const fileName = path.resolve(root, relativePath);
    if (!fileName.startsWith(`${path.resolve(root)}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    fs.readFile(fileName, (error, data) => {
      if (error) {
        response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Unavailable");
        return;
      }
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Connection": "close",
        "Content-Type": contentType(fileName)
      });
      response.end(data);
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        server
      });
    });
  });
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ].filter(Boolean);
  const chrome = candidates.find((candidate) => fs.existsSync(candidate));
  if (!chrome) {
    throw new Error("Chrome was not found. Set CHROME_BIN to the Chrome executable.");
  }
  return chrome;
}

function createCdpConnection(chrome) {
  const pending = new Map();
  let buffer = Buffer.alloc(0);
  let nextId = 1;

  chrome.stdio[4].on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    let separator = buffer.indexOf(0);
    while (separator !== -1) {
      const payload = buffer.subarray(0, separator).toString("utf8");
      buffer = buffer.subarray(separator + 1);
      separator = buffer.indexOf(0);
      if (!payload) continue;

      const message = JSON.parse(payload);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) {
        request.reject(new Error(message.error.message));
      } else {
        request.resolve(message.result);
      }
    }
  });

  chrome.once("exit", (code) => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error(`Chrome exited before completing the smoke test (code ${code}).`));
    }
    pending.clear();
  });

  function send(method, params = {}, sessionId = "") {
    const id = nextId;
    nextId += 1;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Chrome DevTools command timed out: ${method}`));
      }, 15000);
      pending.set(id, { reject, resolve, timer });
      chrome.stdio[3].write(`${JSON.stringify(message)}\0`);
    });
  }

  return { send };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function createPage(send, url) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { flatten: true, targetId });
  await send("Page.enable", {}, sessionId);
  const navigation = await send("Page.navigate", { url }, sessionId);
  if (navigation.errorText) throw new Error(`Chrome could not navigate to ${url}: ${navigation.errorText}`);
  await delay(500);
  return { sessionId, targetId };
}

async function evaluate(send, sessionId, expression) {
  const result = await send("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true
  }, sessionId);
  if (result.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description
      || result.exceptionDetails.text;
    throw new Error(description);
  }
  return result.result.value;
}

function readyStateExpression(cacheName) {
  return `(async () => {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Service worker was not ready.")), 10000))
    ]);
    for (let attempt = 0; attempt < 100 && !navigator.serviceWorker.controller; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const cacheNames = await caches.keys();
    const cache = await caches.open(${JSON.stringify(cacheName)});
    return {
      activeState: registration.active?.state || null,
      cacheNames,
      cachedAssetCount: (await cache.keys()).length,
      controller: Boolean(navigator.serviceWorker.controller),
      homeVisible: !document.getElementById("homeScreen")?.classList.contains("hidden"),
      marker: document.querySelector('meta[name="pwa-smoke-version"]')?.content || null,
      waitingState: registration.waiting?.state || null
    };
  })()`;
}

function upgradeExpression() {
  return `(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration.update();
    for (let attempt = 0; attempt < 100 && !registration.waiting; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return {
      activeState: registration.active?.state || null,
      cacheNames: await caches.keys(),
      marker: document.querySelector('meta[name="pwa-smoke-version"]')?.content || null,
      waitingState: registration.waiting?.state || null
    };
  })()`;
}

async function closeServer(server) {
  if (!server?.listening) return;
  await new Promise((resolve) => server.close(resolve));
}

async function stopChrome(chrome) {
  if (!chrome || chrome.exitCode !== null) return;
  const exited = new Promise((resolve) => chrome.once("exit", resolve));
  chrome.kill("SIGTERM");
  await Promise.race([exited, delay(3000)]);
  if (chrome.exitCode === null) {
    chrome.kill("SIGKILL");
    await exited;
  }
}

async function run() {
  const workerSource = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
  const { cacheName, shellAssets } = parseServiceWorker(workerSource);
  const deploymentRoot = fs.mkdtempSync(path.join(os.tmpdir(), "repeat-pwa-deployment-"));
  const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), "repeat-pwa-profile-"));
  let chrome = null;
  let server = null;
  let chromeErrors = "";

  try {
    copyDeployment(deploymentRoot, shellAssets);
    createOldDeployment(deploymentRoot, cacheName);
    const startedServer = await startServer(deploymentRoot);
    server = startedServer.server;

    chrome = childProcess.spawn(findChrome(), [
      "--headless=new",
      "--no-sandbox",
      "--disable-background-networking",
      "--disable-breakpad",
      "--disable-crash-reporter",
      "--disable-gpu",
      "--no-default-browser-check",
      "--no-first-run",
      `--user-data-dir=${profileRoot}`,
      "--remote-debugging-pipe",
      "about:blank"
    ], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
    chrome.stderr.on("data", (chunk) => {
      chromeErrors = `${chromeErrors}${chunk}`.slice(-4000);
    });

    const { send } = createCdpConnection(chrome);
    await send("Browser.getVersion");

    const oldPage = await createPage(send, `${startedServer.origin}/`);
    const freshState = await evaluate(send, oldPage.sessionId, readyStateExpression(OLD_CACHE_NAME));
    assert.equal(freshState.controller, true, "Fresh installation did not control the page.");
    assert.equal(freshState.activeState, "activated", "Fresh worker did not activate.");
    assert.equal(freshState.marker, "old", "Fresh page did not use the old test shell.");
    assert.equal(freshState.cachedAssetCount, shellAssets.length, "Fresh cache is incomplete.");
    assert.deepEqual(freshState.cacheNames, [OLD_CACHE_NAME], "Fresh installation created unexpected caches.");

    copyDeployment(deploymentRoot, shellAssets);
    const waitingState = await evaluate(send, oldPage.sessionId, upgradeExpression());
    assert.equal(waitingState.activeState, "activated", "Old worker stopped during the open session.");
    assert.equal(waitingState.waitingState, "installed", "Updated worker did not wait for the old client.");
    assert.equal(waitingState.marker, "old", "Open client changed shell during the update.");
    assert.deepEqual(
      new Set(waitingState.cacheNames),
      new Set([OLD_CACHE_NAME, cacheName]),
      "Versioned upgrade did not keep separate old and new caches.",
    );

    await send("Target.closeTarget", { targetId: oldPage.targetId });
    await delay(750);
    await closeServer(server);

    const currentPage = await createPage(send, `${startedServer.origin}/`);
    const offlineState = await evaluate(send, currentPage.sessionId, readyStateExpression(cacheName));
    assert.equal(offlineState.controller, true, "Offline launch was not service-worker controlled.");
    assert.equal(offlineState.activeState, "activated", "Updated worker did not activate.");
    assert.equal(offlineState.marker, null, "Offline launch used the stale shell.");
    assert.equal(offlineState.homeVisible, true, "Offline shell did not render Home.");
    assert.equal(offlineState.cachedAssetCount, shellAssets.length, "Updated cache is incomplete.");
    assert.deepEqual(offlineState.cacheNames, [cacheName], "Activation did not remove the old cache.");

    console.log(`PWA lifecycle smoke passed with cache revision ${cacheName}.`);
    console.log("PASS fresh install and complete shell cache");
    console.log("PASS waiting update preserves the open client");
    console.log("PASS activation removes the old cache");
    console.log("PASS updated shell launches offline");
  } catch (error) {
    const detail = chromeErrors.trim() ? `\nChrome output:\n${chromeErrors.trim()}` : "";
    throw new Error(`${error.message}${detail}`);
  } finally {
    await closeServer(server);
    await stopChrome(chrome);
    fs.rmSync(deploymentRoot, { force: true, maxRetries: 3, recursive: true, retryDelay: 100 });
    fs.rmSync(profileRoot, { force: true, maxRetries: 3, recursive: true, retryDelay: 100 });
  }
}

run().catch((error) => {
  console.error(`PWA lifecycle smoke failed: ${error.message}`);
  process.exitCode = 1;
});

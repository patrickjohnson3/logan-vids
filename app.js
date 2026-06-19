"use strict";

const STORAGE_KEY = "repeat.runtimeState.v1";
const DEFAULT_STATE = {
  settings: {
    unlockCode: "2468",
    audioFeedback: "true",
    speechRate: "0.9",
    theme: "dark"
  },
  videos: []
};

let state = loadState();
let currentVideoId = null;

const screens = {
  home: document.getElementById("homeScreen"),
  unlock: document.getElementById("unlockScreen"),
  parent: document.getElementById("parentScreen"),
  kid: document.getElementById("kidScreen"),
  player: document.getElementById("playerScreen")
};

const els = {
  kidModeButton: document.getElementById("kidModeButton"),
  parentModeButton: document.getElementById("parentModeButton"),
  unlockForm: document.getElementById("unlockForm"),
  unlockCode: document.getElementById("unlockCode"),
  unlockMessage: document.getElementById("unlockMessage"),
  settingCode: document.getElementById("settingCode"),
  settingAudioFeedback: document.getElementById("settingAudioFeedback"),
  settingSpeechRate: document.getElementById("settingSpeechRate"),
  speechRateOutput: document.getElementById("speechRateOutput"),
  settingTheme: document.getElementById("settingTheme"),
  saveSettingsButton: document.getElementById("saveSettingsButton"),
  settingsMessage: document.getElementById("settingsMessage"),
  addVideoForm: document.getElementById("addVideoForm"),
  videoTitle: document.getElementById("videoTitle"),
  videoUrl: document.getElementById("videoUrl"),
  addVideoMessage: document.getElementById("addVideoMessage"),
  parentVideoList: document.getElementById("parentVideoList"),
  emptyParentMessage: document.getElementById("emptyParentMessage"),
  clearAllButton: document.getElementById("clearAllButton"),
  importToml: document.getElementById("importToml"),
  exportToml: document.getElementById("exportToml"),
  importTomlButton: document.getElementById("importTomlButton"),
  copyTomlButton: document.getElementById("copyTomlButton"),
  downloadTomlButton: document.getElementById("downloadTomlButton"),
  tomlMessage: document.getElementById("tomlMessage"),
  favoritesRow: document.getElementById("favoritesRow"),
  kidVideoGrid: document.getElementById("kidVideoGrid"),
  emptyFavoritesMessage: document.getElementById("emptyFavoritesMessage"),
  emptyKidMessage: document.getElementById("emptyKidMessage"),
  playerFrameWrap: document.getElementById("playerFrameWrap"),
  keepButton: document.getElementById("keepButton"),
  againButton: document.getElementById("againButton"),
  playerHomeButton: document.getElementById("playerHomeButton"),
  stopButton: document.getElementById("stopButton")
};

init();

function init() {
  applyTheme();
  bindEvents();
  renderAll();
  showScreen("home");
}

function bindEvents() {
  els.kidModeButton.addEventListener("click", () => {
    speak("choose");
    showScreen("kid");
  });

  els.parentModeButton.addEventListener("click", () => {
    els.unlockCode.value = "";
    setMessage(els.unlockMessage, "");
    showScreen("unlock");
    els.unlockCode.focus();
  });

  document.querySelectorAll("[data-go-home]").forEach((button) => {
    button.addEventListener("click", () => showScreen("home"));
  });

  els.unlockForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (els.unlockCode.value === state.settings.unlockCode) {
      setMessage(els.unlockMessage, "");
      showScreen("parent");
    } else {
      setMessage(els.unlockMessage, "That code did not work.");
    }
  });

  els.settingSpeechRate.addEventListener("input", () => {
    els.speechRateOutput.value = els.settingSpeechRate.value;
  });

  els.saveSettingsButton.addEventListener("click", saveSettingsFromForm);
  els.addVideoForm.addEventListener("submit", addVideoFromForm);
  els.clearAllButton.addEventListener("click", clearAllVideos);
  els.importTomlButton.addEventListener("click", importTomlFromTextarea);
  els.copyTomlButton.addEventListener("click", copyToml);
  els.downloadTomlButton.addEventListener("click", downloadToml);
  els.keepButton.addEventListener("click", toggleCurrentFavorite);
  els.againButton.addEventListener("click", playCurrentAgain);
  els.playerHomeButton.addEventListener("click", returnToKidMode);
  els.stopButton.addEventListener("click", stopPlayer);
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
  if (name === "parent") renderParent();
  if (name === "kid") renderKid();
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return cloneDefaultState();

  try {
    const parsed = JSON.parse(saved);
    return normalizeState(parsed);
  } catch {
    return cloneDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function normalizeState(raw) {
  const normalized = cloneDefaultState();
  if (raw && raw.settings) {
    Object.keys(normalized.settings).forEach((key) => {
      if (typeof raw.settings[key] === "string") normalized.settings[key] = raw.settings[key];
    });
  }

  if (Array.isArray(raw && raw.videos)) {
    normalized.videos = raw.videos
      .filter((video) => video && typeof video.id === "string")
      .map((video) => ({
        id: video.id,
        title: String(video.title || "Untitled"),
        youtubeUrl: String(video.youtubeUrl || ""),
        embedUrl: String(video.embedUrl || buildEmbedUrl(video.id)),
        favorite: String(video.favorite || "false")
      }));
  }

  return normalized;
}

function renderAll() {
  applyTheme();
  renderParent();
  renderKid();
}

function applyTheme() {
  document.body.classList.toggle("light", state.settings.theme === "light");
}

function renderParent() {
  els.settingCode.value = state.settings.unlockCode;
  els.settingAudioFeedback.checked = state.settings.audioFeedback === "true";
  els.settingSpeechRate.value = state.settings.speechRate;
  els.speechRateOutput.value = state.settings.speechRate;
  els.settingTheme.value = state.settings.theme;
  els.exportToml.value = writeToml(state);

  els.parentVideoList.innerHTML = "";
  els.emptyParentMessage.hidden = state.videos.length > 0;

  state.videos.forEach((video, index) => {
    const item = document.createElement("li");
    item.className = "parent-video-item";

    const title = document.createElement("p");
    title.className = "parent-video-title";
    title.textContent = video.title;
    const url = document.createElement("p");
    url.className = "parent-video-url";
    url.textContent = video.youtubeUrl;

    const actions = document.createElement("div");
    actions.className = "parent-video-actions";
    actions.append(
      makeSmallButton("Up", () => moveVideo(index, -1), index === 0),
      makeSmallButton("Down", () => moveVideo(index, 1), index === state.videos.length - 1),
      makeSmallButton("Delete", () => deleteVideo(video.id), false, "danger-action")
    );

    item.append(title, url, actions);
    els.parentVideoList.append(item);
  });
}

function renderKid() {
  els.favoritesRow.innerHTML = "";
  els.kidVideoGrid.innerHTML = "";

  const favorites = state.videos.filter((video) => video.favorite === "true");
  els.emptyFavoritesMessage.hidden = favorites.length > 0;
  els.emptyKidMessage.hidden = state.videos.length > 0;

  favorites.forEach((video) => els.favoritesRow.append(makeVideoTile(video)));
  state.videos.forEach((video) => els.kidVideoGrid.append(makeVideoTile(video)));
}

function makeSmallButton(label, onClick, disabled, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = disabled;
  if (className) button.classList.add(className);
  button.addEventListener("click", onClick);
  return button;
}

function makeVideoTile(video) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "video-tile";
  button.setAttribute("aria-label", video.title);

  const thumbnail = document.createElement("img");
  thumbnail.className = "video-thumbnail";
  thumbnail.src = `https://i.ytimg.com/vi/${encodeURIComponent(video.id)}/hqdefault.jpg`;
  thumbnail.alt = "";
  thumbnail.referrerPolicy = "no-referrer";
  thumbnail.addEventListener("error", () => thumbnail.classList.add("unavailable"));

  const title = document.createElement("span");
  title.className = "tile-title";
  title.textContent = video.title;

  button.append(thumbnail, title);
  button.addEventListener("click", () => {
    openPlayer(video.id);
  });

  return button;
}

function saveSettingsFromForm() {
  const code = els.settingCode.value.trim();
  if (!/^\d{4,12}$/.test(code)) {
    setMessage(els.settingsMessage, "Use a numeric code with 4 to 12 digits.");
    return;
  }

  state.settings.unlockCode = code;
  state.settings.audioFeedback = String(els.settingAudioFeedback.checked);
  state.settings.speechRate = els.settingSpeechRate.value;
  state.settings.theme = els.settingTheme.value;
  saveState();
  setMessage(els.settingsMessage, "Settings saved.");
}

function addVideoFromForm(event) {
  event.preventDefault();
  const title = els.videoTitle.value.trim();
  const url = els.videoUrl.value.trim();
  const result = parseYouTubeUrl(url);

  if (!title) {
    setMessage(els.addVideoMessage, "Add a title.");
    return;
  }

  if (!result.ok) {
    setMessage(els.addVideoMessage, result.message);
    return;
  }

  if (state.videos.some((video) => video.id === result.id)) {
    setMessage(els.addVideoMessage, "That video is already saved.");
    return;
  }

  state.videos.push({
    id: result.id,
    title,
    youtubeUrl: url,
    embedUrl: buildEmbedUrl(result.id),
    favorite: "false"
  });

  els.addVideoForm.reset();
  saveState();
  setMessage(els.addVideoMessage, "Video added.");
}

function moveVideo(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= state.videos.length) return;
  const [video] = state.videos.splice(index, 1);
  state.videos.splice(nextIndex, 0, video);
  saveState();
}

function deleteVideo(id) {
  state.videos = state.videos.filter((video) => video.id !== id);
  saveState();
}

function clearAllVideos() {
  if (!confirm("Clear all saved videos?")) return;
  state.videos = [];
  saveState();
}

function openPlayer(id) {
  currentVideoId = id;
  showScreen("player");
  updateFavoriteButton();

  // Wait for the tile label before starting the video, so the two audio cues do not compete.
  speak(findVideo(id).title, () => {
    if (currentVideoId === id && screens.player.classList.contains("active")) {
      renderPlayer(true);
    }
  });
}

function renderPlayer(autoplay) {
  const video = findVideo(currentVideoId);
  if (!video) {
    returnToKidMode();
    return;
  }

  els.playerFrameWrap.innerHTML = "";
  updateFavoriteButton();
  const iframe = document.createElement("iframe");
  iframe.title = video.title;
  // Keep the remote player inside this frame: no fullscreen, popups, sharing, or top-level navigation.
  iframe.allow = "autoplay; encrypted-media";
  iframe.sandbox = "allow-scripts allow-same-origin";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.src = buildEmbedUrl(video.id, autoplay);
  els.playerFrameWrap.append(iframe);
}

function toggleCurrentFavorite() {
  const video = findVideo(currentVideoId);
  if (!video) return;
  const isFavorite = video.favorite === "true";
  video.favorite = isFavorite ? "false" : "true";
  saveState();
  updateFavoriteButton();
  speak(isFavorite ? "remove" : "keep");
}

function updateFavoriteButton() {
  const video = findVideo(currentVideoId);
  const isFavorite = Boolean(video && video.favorite === "true");
  const label = isFavorite ? "Remove" : "Keep";
  els.keepButton.firstChild.textContent = isFavorite ? "♥" : "♡";
  els.keepButton.querySelector("span").textContent = label;
  els.keepButton.setAttribute("aria-pressed", String(isFavorite));
  els.keepButton.setAttribute(
    "aria-label",
    isFavorite ? "Remove from favorites" : "Keep as favorite"
  );
}

function playCurrentAgain() {
  const videoId = currentVideoId;
  speak("again", () => {
    if (currentVideoId === videoId && screens.player.classList.contains("active")) {
      renderPlayer(true);
    }
  });
}

function returnToKidMode() {
  els.playerFrameWrap.innerHTML = "";
  currentVideoId = null;
  showScreen("kid");
}

function stopPlayer() {
  els.playerFrameWrap.innerHTML = "";
  currentVideoId = null;
  showScreen("kid");
}

function findVideo(id) {
  return state.videos.find((video) => video.id === id);
}

function parseYouTubeUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, message: "Use a full YouTube watch or youtu.be video URL." };
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname;

  if (url.searchParams.has("list")) {
    return { ok: false, message: "Playlists are not supported." };
  }

  if (path.startsWith("/shorts/")) {
    return { ok: false, message: "Shorts are not supported." };
  }

  if (path.startsWith("/channel/") || path.startsWith("/c/") || path.startsWith("/@") || path.startsWith("/user/")) {
    return { ok: false, message: "Channels are not supported." };
  }

  if (path.startsWith("/live/") || url.searchParams.get("live") === "1") {
    return { ok: false, message: "Livestream URLs are not supported." };
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (path !== "/watch") {
      return { ok: false, message: "Only individual YouTube watch URLs are supported." };
    }
    const id = url.searchParams.get("v");
    return validateVideoId(id);
  }

  if (host === "youtu.be") {
    const id = path.split("/").filter(Boolean)[0];
    return validateVideoId(id);
  }

  return { ok: false, message: "Use a YouTube watch URL or youtu.be URL." };
}

function validateVideoId(id) {
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return { ok: false, message: "That YouTube video ID does not look valid." };
  }
  return { ok: true, id };
}

function buildEmbedUrl(id, autoplay = false) {
  const params = new URLSearchParams({
    rel: "0",
    playsinline: "1",
    controls: "1",
    loop: "1",
    playlist: id,
    modestbranding: "1"
  });

  if (autoplay) {
    params.set("autoplay", "1");
  }

  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

function speak(text, onComplete) {
  const finish = once(onComplete);
  if (state.settings.audioFeedback !== "true") {
    finish();
    return;
  }
  if (!("speechSynthesis" in window)) {
    finish();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = Number(state.settings.speechRate) || 0.9;
  utterance.addEventListener("end", finish);
  utterance.addEventListener("error", finish);
  window.speechSynthesis.speak(utterance);
}

function once(callback) {
  let called = false;
  return () => {
    if (called || typeof callback !== "function") return;
    called = true;
    callback();
  };
}

function importTomlFromTextarea() {
  const result = parseToml(els.importToml.value);
  if (!result.ok) {
    setMessage(els.tomlMessage, result.message);
    return;
  }
  state = result.state;
  saveState();
  setMessage(els.tomlMessage, "TOML imported.");
}

function copyToml() {
  const text = writeToml(state);
  els.exportToml.value = text;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(
      () => setMessage(els.tomlMessage, "TOML copied."),
      () => fallbackCopyToml()
    );
  } else {
    fallbackCopyToml();
  }
}

function fallbackCopyToml() {
  els.exportToml.focus();
  els.exportToml.select();
  document.execCommand("copy");
  setMessage(els.tomlMessage, "TOML copied.");
}

function downloadToml() {
  const blob = new Blob([writeToml(state)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "safe-loop-config.toml";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setMessage(els.tomlMessage, "TOML downloaded.");
}

function setMessage(element, text) {
  element.textContent = text;
}

// Minimal TOML reader for this app only:
// [settings], [[videos]], and quoted string key/value pairs.
function parseToml(text) {
  const nextState = cloneDefaultState();
  nextState.videos = [];
  let section = null;
  let currentVideo = null;

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index].trim();
    if (!line || line.startsWith("#")) continue;

    if (line === "[settings]") {
      section = "settings";
      currentVideo = null;
      continue;
    }

    if (line === "[[videos]]") {
      section = "videos";
      currentVideo = {};
      nextState.videos.push(currentVideo);
      continue;
    }

    const match = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=\s*"((?:\\.|[^"\\])*)"$/);
    if (!match) {
      return failToml(lineNumber, "Use key = \"value\" with quoted string values.");
    }

    if (!section) {
      return failToml(lineNumber, "Add [settings] or [[videos]] before values.");
    }

    const key = match[1];
    const stringResult = unescapeTomlString(match[2]);
    if (!stringResult.ok) {
      return failToml(lineNumber, "Only \\\" and \\\\ escapes are supported in strings.");
    }
    const value = stringResult.value;

    if (section === "settings") {
      if (key === "continuousLoop") continue;
      if (!(key in nextState.settings)) {
        return failToml(lineNumber, `Unknown setting "${key}".`);
      }
      nextState.settings[key] = value;
    } else {
      if (!["title", "url", "icon", "favorite"].includes(key)) {
        return failToml(lineNumber, `Unknown video value "${key}".`);
      }
      // Legacy icon values are accepted but ignored: videos no longer have icons.
      currentVideo[key] = value;
    }
  }

  const importedIds = new Set();
  for (let index = 0; index < nextState.videos.length; index += 1) {
    const video = nextState.videos[index];
    if (!video.title || !video.url) {
      return { ok: false, message: `Video ${index + 1} needs title and url values.` };
    }

    const parsedUrl = parseYouTubeUrl(video.url);
    if (!parsedUrl.ok) {
      return { ok: false, message: `Video ${index + 1}: ${parsedUrl.message}` };
    }

    if (importedIds.has(parsedUrl.id)) {
      return { ok: false, message: `Video ${index + 1} is a duplicate.` };
    }
    importedIds.add(parsedUrl.id);

    nextState.videos[index] = {
      id: parsedUrl.id,
      title: video.title,
      youtubeUrl: video.url,
      embedUrl: buildEmbedUrl(parsedUrl.id),
      favorite: video.favorite === "true" ? "true" : "false"
    };
  }

  return { ok: true, state: normalizeState(nextState) };
}

function failToml(lineNumber, message) {
  return { ok: false, message: `Line ${lineNumber}: ${message}` };
}

function writeToml(currentState) {
  const lines = [
    "# Repeat configuration",
    "[settings]",
    `unlockCode = "${escapeTomlString(currentState.settings.unlockCode)}"`,
    `audioFeedback = "${escapeTomlString(currentState.settings.audioFeedback)}"`,
    `speechRate = "${escapeTomlString(currentState.settings.speechRate)}"`,
    `theme = "${escapeTomlString(currentState.settings.theme)}"`
  ];

  currentState.videos.forEach((video) => {
    lines.push(
      "",
      "[[videos]]",
      `title = "${escapeTomlString(video.title)}"`,
      `url = "${escapeTomlString(video.youtubeUrl)}"`,
      `favorite = "${escapeTomlString(video.favorite)}"`
    );
  });

  return `${lines.join("\n")}\n`;
}

function escapeTomlString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function unescapeTomlString(value) {
  if (/\\[^"\\]/.test(value)) {
    return { ok: false, value: "" };
  }
  return { ok: true, value: value.replace(/\\(["\\])/g, "$1") };
}

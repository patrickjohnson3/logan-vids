"use strict";

const STORAGE_KEY = "repeat.runtimeState.v1";
const MAX_TITLE_LENGTH = 48;
const MAX_TAGS_LENGTH = 120;
const MAX_TOML_FILE_BYTES = 256 * 1024;
const BOOLEAN_VALUES = ["true", "false"];
const THEME_VALUES = ["dark", "light"];
const VIDEO_GRID_ORDER_VALUES = ["manual", "alpha"];
const TOML_VIDEO_KEYS = ["title", "url", "icon", "favorite", "tags"];
const MESSAGES = {
  storageUnavailable: "Storage is unavailable. Changes will be lost when this page closes.",
  storageUnreadable: "Saved data could not be read. Repeat started with an empty library.",
  importConfirmation: "Importing TOML replaces all saved videos, favorites, and settings. Continue?",
  importCancelled: "Import cancelled.",
  importSessionOnly: "TOML imported for this session, but it could not be saved.",
  unreadableFile: "That file could not be read.",
  fileTooLarge: "Choose a TOML file smaller than 256 KB.",
  copyFailed: "Copy did not work. Select the TOML and copy it manually."
};
let storageWarning = "";
const DEFAULT_STATE = {
  settings: {
    unlockCode: "2468",
    audioFeedback: "true",
    youtubeControls: "false",
    speechRate: "0.9",
    theme: "dark",
    videoGridOrder: "manual"
  },
  videos: []
};

// Runtime state and DOM references stay together; pure parsing helpers are below.
let state = loadState();
let currentVideoId = null;
let unlockReturnScreen = "home";
let speechPlaybackToken = 0;
let editingVideoId = null;

const screens = {
  home: document.getElementById("homeScreen"),
  unlock: document.getElementById("unlockScreen"),
  parent: document.getElementById("parentScreen"),
  kid: document.getElementById("kidScreen"),
  player: document.getElementById("playerScreen")
};

const els = {
  app: document.getElementById("app"),
  kidModeButton: document.getElementById("kidModeButton"),
  kidTitle: document.getElementById("kidTitle"),
  parentModeButton: document.getElementById("parentModeButton"),
  kidParentButton: document.getElementById("kidParentButton"),
  unlockBackButton: document.getElementById("unlockBackButton"),
  unlockForm: document.getElementById("unlockForm"),
  unlockCode: document.getElementById("unlockCode"),
  unlockMessage: document.getElementById("unlockMessage"),
  settingCode: document.getElementById("settingCode"),
  settingAudioFeedback: document.getElementById("settingAudioFeedback"),
  settingYouTubeControls: document.getElementById("settingYouTubeControls"),
  settingSpeechRate: document.getElementById("settingSpeechRate"),
  speechRateOutput: document.getElementById("speechRateOutput"),
  settingTheme: document.getElementById("settingTheme"),
  settingVideoGridOrder: document.getElementById("settingVideoGridOrder"),
  saveSettingsButton: document.getElementById("saveSettingsButton"),
  settingsMessage: document.getElementById("settingsMessage"),
  storageMessage: document.getElementById("storageMessage"),
  addVideoForm: document.getElementById("addVideoForm"),
  videoTitle: document.getElementById("videoTitle"),
  videoTags: document.getElementById("videoTags"),
  videoUrl: document.getElementById("videoUrl"),
  addVideoMessage: document.getElementById("addVideoMessage"),
  parentVideoList: document.getElementById("parentVideoList"),
  emptyParentMessage: document.getElementById("emptyParentMessage"),
  clearAllButton: document.getElementById("clearAllButton"),
  importToml: document.getElementById("importToml"),
  exportToml: document.getElementById("exportToml"),
  importTomlButton: document.getElementById("importTomlButton"),
  uploadTomlButton: document.getElementById("uploadTomlButton"),
  tomlFileInput: document.getElementById("tomlFileInput"),
  copyTomlButton: document.getElementById("copyTomlButton"),
  downloadTomlButton: document.getElementById("downloadTomlButton"),
  tomlMessage: document.getElementById("tomlMessage"),
  favoritesSection: document.getElementById("favoritesSection"),
  favoritesRow: document.getElementById("favoritesRow"),
  kidVideoGrid: document.getElementById("kidVideoGrid"),
  emptyKidMessage: document.getElementById("emptyKidMessage"),
  playerFrameWrap: document.getElementById("playerFrameWrap"),
  favoriteButton: document.getElementById("favoriteButton"),
  similarButton: document.getElementById("similarButton"),
  againButton: document.getElementById("againButton"),
  playerHomeButton: document.getElementById("playerHomeButton")
};

init();

// Startup and event wiring
function init() {
  applyTheme();
  bindEvents();
  renderAll();
  showScreen("home");
}

function bindEvents() {
  els.kidModeButton.addEventListener("click", () => {
    requestKidFullscreen();
    speak(els.kidTitle.textContent);
    showScreen("kid");
  });

  els.parentModeButton.addEventListener("click", () => openParentUnlock("home"));
  els.kidParentButton.addEventListener("click", () => openParentUnlock("kid"));
  els.unlockBackButton.addEventListener("click", closeParentUnlock);

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
  els.uploadTomlButton.addEventListener("click", () => els.tomlFileInput.click());
  els.tomlFileInput.addEventListener("change", importTomlFromFile);
  els.copyTomlButton.addEventListener("click", copyToml);
  els.downloadTomlButton.addEventListener("click", downloadToml);
  els.favoriteButton.addEventListener("click", toggleCurrentFavorite);
  els.similarButton.addEventListener("click", playSimilarVideo);
  els.againButton.addEventListener("click", playCurrentAgain);
  els.playerHomeButton.addEventListener("click", returnToKidMode);
}

function showScreen(name) {
  if (name === "home" || name === "parent") {
    exitKidFullscreen();
  }
  els.app.classList.toggle("player-active", name === "player");
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
  if (name === "parent") renderParent();
  if (name === "kid") renderKid();
}

function requestKidFullscreen() {
  if (document.fullscreenElement || !els.app.requestFullscreen) return;
  els.app.requestFullscreen().catch(() => {});
}

function exitKidFullscreen() {
  if (!document.fullscreenElement || !document.exitFullscreen) return;
  document.exitFullscreen().catch(() => {});
}

function openParentUnlock(returnScreen) {
  unlockReturnScreen = returnScreen;
  els.unlockCode.value = "";
  els.unlockBackButton.textContent = returnScreen === "kid" ? "Back" : "Home";
  setMessage(els.unlockMessage, "");
  showScreen("unlock");
  els.unlockCode.focus();
}

function closeParentUnlock() {
  showScreen(unlockReturnScreen);
  if (unlockReturnScreen === "kid") {
    els.kidParentButton.focus();
  } else {
    els.parentModeButton.focus();
  }
}

// State and persistence
function loadState() {
  let saved;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    storageWarning = MESSAGES.storageUnavailable;
    return cloneDefaultState();
  }

  if (!saved) return cloneDefaultState();

  try {
    const parsed = JSON.parse(saved);
    return normalizeState(parsed);
  } catch {
    storageWarning = MESSAGES.storageUnreadable;
    return cloneDefaultState();
  }
}

function persistState() {
  let persisted = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageWarning = "";
  } catch {
    persisted = false;
    storageWarning = MESSAGES.storageUnavailable;
  }
  renderAll();
  return persisted;
}

function updateState(mutator) {
  mutator(state);
  return persistState();
}

function replaceState(nextState) {
  state = nextState;
  return persistState();
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
  normalized.settings = normalizeSettings(normalized.settings);

  if (Array.isArray(raw && raw.videos)) {
    normalized.videos = raw.videos
      .map(normalizeVideo)
      .filter(Boolean);
  }

  return normalized;
}

// Rendering
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
  els.settingYouTubeControls.checked = state.settings.youtubeControls === "true";
  els.settingSpeechRate.value = state.settings.speechRate;
  els.speechRateOutput.value = state.settings.speechRate;
  els.settingTheme.value = state.settings.theme;
  els.settingVideoGridOrder.value = state.settings.videoGridOrder;
  els.exportToml.value = writeRepeatToml(state);
  els.storageMessage.textContent = storageWarning;

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
    const tags = document.createElement("p");
    tags.className = "parent-video-tags";
    tags.textContent = video.tags ? `Tags: ${video.tags}` : "No tags";

    if (editingVideoId === video.id) {
      item.append(url, makeVideoMetadataEditor(video));
      els.parentVideoList.append(item);
      return;
    }

    const actions = document.createElement("div");
    actions.className = "parent-video-actions";
    actions.append(
      makeSmallButton("Edit", () => startEditingVideo(video.id)),
      makeSmallButton("Up", () => moveVideo(index, -1), index === 0),
      makeSmallButton("Down", () => moveVideo(index, 1), index === state.videos.length - 1),
      makeSmallButton("Delete", () => deleteVideo(video.id), false, "danger-action")
    );

    item.append(title, tags, url, actions);
    els.parentVideoList.append(item);
  });
}

function makeVideoMetadataEditor(video) {
  const form = document.createElement("form");
  form.className = "parent-video-edit";

  const titleLabel = document.createElement("label");
  titleLabel.textContent = "Title";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.value = video.title;
  titleInput.maxLength = MAX_TITLE_LENGTH;
  titleInput.required = true;
  titleInput.addEventListener("input", () => titleInput.setCustomValidity(""));
  titleLabel.append(titleInput);

  const tagsLabel = document.createElement("label");
  tagsLabel.textContent = "Tags";
  const tagsInput = document.createElement("input");
  tagsInput.type = "text";
  tagsInput.value = video.tags || "";
  tagsInput.maxLength = MAX_TAGS_LENGTH;
  tagsInput.placeholder = "trains, music, calm";
  tagsInput.addEventListener("input", () => tagsInput.setCustomValidity(""));
  tagsLabel.append(tagsInput);

  const actions = document.createElement("div");
  actions.className = "parent-video-edit-actions";
  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "primary-action";
  saveButton.textContent = "Save";
  actions.append(
    saveButton,
    makeSmallButton("Cancel", () => {
      editingVideoId = null;
      renderParent();
    })
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveVideoMetadata(video.id, titleInput, tagsInput);
  });
  form.append(titleLabel, tagsLabel, actions);
  return form;
}

function renderKid() {
  els.favoritesRow.innerHTML = "";
  els.kidVideoGrid.innerHTML = "";

  const favorites = state.videos.filter((video) => video.favorite === "true");
  const approvedVideos = getKidGridVideos();
  els.favoritesSection.hidden = favorites.length === 0;
  els.emptyKidMessage.hidden = state.videos.length > 0;

  favorites.forEach((video) => els.favoritesRow.append(makeVideoTile(video)));
  approvedVideos.forEach((video) => els.kidVideoGrid.append(makeVideoTile(video)));
}

function getKidGridVideos() {
  const videos = state.videos.filter((video) => video.favorite !== "true");
  if (state.settings.videoGridOrder !== "alpha") return videos;

  return videos.slice().sort((first, second) =>
    first.title.localeCompare(second.title, undefined, { sensitivity: "base" })
  );
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
  button.setAttribute(
    "aria-label",
    video.favorite === "true" ? `${video.title}, favorite` : video.title
  );

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
  if (video.favorite === "true") {
    const badge = document.createElement("span");
    badge.className = "favorite-badge";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = "❤️";
    button.append(badge);
  }
  button.addEventListener("click", () => {
    openPlayer(video.id);
  });

  return button;
}

// Parent actions
function saveSettingsFromForm() {
  const nextSettings = {
    unlockCode: els.settingCode.value.trim(),
    audioFeedback: String(els.settingAudioFeedback.checked),
    youtubeControls: String(els.settingYouTubeControls.checked),
    speechRate: els.settingSpeechRate.value,
    theme: els.settingTheme.value,
    videoGridOrder: els.settingVideoGridOrder.value
  };
  const settingsError = validateSettings(nextSettings);
  if (settingsError) {
    setMessage(els.settingsMessage, settingsError.replace("Settings: ", ""));
    return;
  }

  const persisted = updateState((draft) => {
    draft.settings = nextSettings;
  });
  setMessage(els.settingsMessage, persisted ? "Settings saved." : MESSAGES.storageUnavailable);
}

function addVideoFromForm(event) {
  event.preventDefault();
  const title = els.videoTitle.value.trim();
  const tags = normalizeTags(els.videoTags.value);
  const url = els.videoUrl.value.trim();
  const result = parseYouTubeUrl(url);

  if (!title) {
    setMessage(els.addVideoMessage, "Add a title.");
    return;
  }

  if (title.length > MAX_TITLE_LENGTH) {
    setMessage(els.addVideoMessage, `Use a title with ${MAX_TITLE_LENGTH} characters or fewer.`);
    return;
  }

  const tagsError = validateTags(tags);
  if (tagsError) {
    setMessage(els.addVideoMessage, tagsError);
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

  updateState((draft) => {
    draft.videos.push(normalizeVideo({
      id: result.id,
      title,
      tags,
      youtubeUrl: result.canonicalUrl,
      favorite: "false"
    }));
  });

  els.addVideoForm.reset();
  setMessage(els.addVideoMessage, "Video added.");
}

function moveVideo(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= state.videos.length) return;
  updateState((draft) => {
    const [video] = draft.videos.splice(index, 1);
    draft.videos.splice(nextIndex, 0, video);
  });
}

function deleteVideo(id) {
  if (editingVideoId === id) editingVideoId = null;
  updateState((draft) => {
    draft.videos = draft.videos.filter((video) => video.id !== id);
  });
}

function clearAllVideos() {
  if (!confirm("Clear all saved videos?")) return;
  editingVideoId = null;
  updateState((draft) => {
    draft.videos = [];
  });
}

function startEditingVideo(id) {
  editingVideoId = id;
  renderParent();
  els.parentVideoList.querySelector("input")?.focus();
}

function saveVideoMetadata(id, titleInput, tagsInput) {
  const title = titleInput.value.trim();
  const tags = normalizeTags(tagsInput.value);
  if (!title) {
    titleInput.setCustomValidity("Add a title.");
    titleInput.reportValidity();
    return;
  }

  if (title.length > MAX_TITLE_LENGTH) {
    titleInput.setCustomValidity(`Use a title with ${MAX_TITLE_LENGTH} characters or fewer.`);
    titleInput.reportValidity();
    return;
  }

  const tagsError = validateTags(tags);
  if (tagsError) {
    tagsInput.setCustomValidity(tagsError);
    tagsInput.reportValidity();
    return;
  }

  editingVideoId = null;
  updateState((draft) => {
    const video = draft.videos.find((item) => item.id === id);
    if (video) {
      video.title = title;
      video.tags = tags;
    }
  });
}

function normalizeTags(value) {
  return String(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(", ");
}

function validateTags(tags) {
  if (tags.length > MAX_TAGS_LENGTH) {
    return `Use tags with ${MAX_TAGS_LENGTH} characters or fewer.`;
  }
  return "";
}

// Player lifecycle
function openPlayer(id) {
  const video = findVideo(id);
  if (!video) return;

  currentVideoId = video.id;
  showScreen("player");
  renderPlayerControls(video);

  // Wait for the tile label before starting the video, so the two audio cues do not compete.
  startPlayerAfterSpeech(video.title, video.id);
}

function startCurrentPlayer(autoplay) {
  const video = findVideo(currentVideoId);
  if (!video) {
    leavePlayer();
    return;
  }

  els.playerFrameWrap.innerHTML = "";
  renderPlayerControls(video);
  const iframe = document.createElement("iframe");
  iframe.title = video.title;
  // Keep the remote player inside this frame: no fullscreen, popups, sharing, or top-level navigation.
  iframe.allow = "autoplay; encrypted-media";
  iframe.sandbox = "allow-scripts allow-same-origin";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.src = buildEmbedUrl(
    video.id,
    autoplay,
    state.settings.youtubeControls === "true"
  );
  els.playerFrameWrap.append(iframe);
}

function toggleCurrentFavorite() {
  const video = findVideo(currentVideoId);
  if (!video) return;
  const isFavorite = video.favorite === "true";
  updateState((draft) => {
    const currentVideo = draft.videos.find((item) => item.id === currentVideoId);
    currentVideo.favorite = isFavorite ? "false" : "true";
  });
  renderPlayerControls(findVideo(currentVideoId));
  speak(isFavorite ? "remove" : "favorites");
}

function renderPlayerControls(video) {
  const isFavorite = Boolean(video && video.favorite === "true");
  const label = isFavorite ? "Remove" : "Favorites";
  const similarVideo = video ? findSimilarVideo(video.id) : null;
  els.favoriteButton.querySelector(".favorite-icon").textContent = isFavorite ? "♥" : "♡";
  els.favoriteButton.querySelector(".player-button-label").textContent = label;
  els.favoriteButton.setAttribute("aria-pressed", String(isFavorite));
  els.favoriteButton.setAttribute(
    "aria-label",
    isFavorite ? "Remove from favorites" : "Add to favorites"
  );
  els.similarButton.disabled = !similarVideo;
  els.similarButton.setAttribute(
    "aria-label",
    similarVideo ? `Similar to ${video.title}` : "No similar videos"
  );
}

function playSimilarVideo() {
  const nextVideo = findSimilarVideo(currentVideoId);
  if (!nextVideo) return;

  currentVideoId = nextVideo.id;
  els.playerFrameWrap.innerHTML = "";
  renderPlayerControls(nextVideo);
  startPlayerAfterSpeech(nextVideo.title, nextVideo.id);
}

function playCurrentAgain() {
  startPlayerAfterSpeech("again", currentVideoId);
}

function startPlayerAfterSpeech(text, videoId) {
  const playbackToken = ++speechPlaybackToken;
  const startPlayer = once(() => {
    if (
      playbackToken === speechPlaybackToken &&
      currentVideoId === videoId &&
      screens.player.classList.contains("active")
    ) {
      startCurrentPlayer(true);
    }
  });

  // Some mobile speech engines never emit end/error; do not strand the child on an empty player.
  const timeoutId = window.setTimeout(startPlayer, estimateSpeechTimeout(text));
  speak(text, () => {
    window.clearTimeout(timeoutId);
    startPlayer();
  });
}

function estimateSpeechTimeout(text) {
  const speechRate = Number(state.settings.speechRate);
  const rate = Number.isFinite(speechRate) ? Math.min(Math.max(speechRate, 0.6), 1.2) : 0.9;
  const milliseconds = Math.ceil((String(text).length / (12 * rate)) * 1000) + 1000;
  return Math.min(Math.max(milliseconds, 3000), 12000);
}

function leavePlayer() {
  els.playerFrameWrap.innerHTML = "";
  currentVideoId = null;
  showScreen("kid");
}

function returnToKidMode() {
  leavePlayer();
}

function findVideo(id) {
  return state.videos.find((video) => video.id === id);
}

function findSimilarVideo(id) {
  const currentVideo = findVideo(id);
  if (!currentVideo) return null;

  const currentTags = makeTagSet(currentVideo.tags);
  if (currentTags.size === 0) return null;

  const currentIndex = state.videos.findIndex((video) => video.id === id);
  for (let offset = 1; offset < state.videos.length; offset += 1) {
    const candidate = state.videos[(currentIndex + offset) % state.videos.length];
    if (sharesAnyTag(currentTags, candidate.tags)) return candidate;
  }

  return null;
}

function makeTagSet(value) {
  return new Set(
    String(value)
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
  );
}

function sharesAnyTag(tagSet, value) {
  return Array.from(makeTagSet(value)).some((tag) => tagSet.has(tag));
}

// YouTube and speech helpers
function parseYouTubeUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, message: "Use a full YouTube watch or youtu.be video URL." };
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname;

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
    if (!id && url.searchParams.has("list")) {
      return { ok: false, message: "Playlist URLs are not supported." };
    }
    return validateVideoId(id);
  }

  if (host === "youtu.be") {
    const id = path.split("/").filter(Boolean)[0];
    return validateVideoId(id);
  }

  return { ok: false, message: "Use a YouTube watch URL or youtu.be URL." };
}

function validateVideoId(id) {
  if (!isValidVideoId(id)) {
    return { ok: false, message: "That YouTube video ID does not look valid." };
  }
  return { ok: true, id, canonicalUrl: buildCanonicalWatchUrl(id) };
}

function isValidVideoId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id);
}

function buildCanonicalWatchUrl(id) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}

function normalizeStoredYouTubeUrl(video) {
  const parsedUrl = parseYouTubeUrl(video.youtubeUrl || "");
  if (parsedUrl.ok && parsedUrl.id === video.id) return parsedUrl.canonicalUrl;
  return buildCanonicalWatchUrl(video.id);
}

function buildEmbedUrl(id, autoplay = false, controlsEnabled = true) {
  const params = new URLSearchParams({
    rel: "0",
    playsinline: "1",
    controls: controlsEnabled ? "1" : "0",
    loop: "1",
    playlist: id
  });

  if (!controlsEnabled) {
    params.set("disablekb", "1");
  }

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

// TOML input and output
function importTomlFromTextarea() {
  importToml(els.importToml.value);
}

async function importTomlFromFile(event) {
  const [file] = event.target.files;
  if (!file) return;

  if (file.size > MAX_TOML_FILE_BYTES) {
    setMessage(els.tomlMessage, MESSAGES.fileTooLarge);
    event.target.value = "";
    return;
  }

  try {
    const text = await file.text();
    els.importToml.value = text;
    importToml(text);
  } catch {
    setMessage(els.tomlMessage, MESSAGES.unreadableFile);
  } finally {
    event.target.value = "";
  }
}

function importToml(text) {
  const result = parseRepeatToml(text);
  if (!result.ok) {
    setMessage(els.tomlMessage, result.message);
    return;
  }

  if (!confirm(MESSAGES.importConfirmation)) {
    setMessage(els.tomlMessage, MESSAGES.importCancelled);
    return;
  }

  const persisted = replaceState(result.state);
  setMessage(
    els.tomlMessage,
    persisted ? "TOML imported." : MESSAGES.importSessionOnly
  );
}

function copyToml() {
  const text = writeRepeatToml(state);
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
  try {
    const copied = document.execCommand("copy");
    setMessage(
      els.tomlMessage,
      copied ? "TOML copied." : MESSAGES.copyFailed
    );
  } catch {
    setMessage(els.tomlMessage, MESSAGES.copyFailed);
  }
}

function downloadToml() {
  const blob = new Blob([writeRepeatToml(state)], { type: "text/plain;charset=utf-8" });
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
function parseRepeatToml(text) {
  const nextState = cloneDefaultState();
  nextState.videos = [];
  let section = null;
  let currentVideo = null;
  let hasSettingsSection = false;
  const settingsKeys = new Set();
  let videoKeys = new Set();

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index].trim();
    if (!line || line.startsWith("#")) continue;

    if (line === "[settings]") {
      if (hasSettingsSection) {
        return failToml(lineNumber, "The [settings] section can only appear once.");
      }
      hasSettingsSection = true;
      section = "settings";
      currentVideo = null;
      continue;
    }

    if (line === "[[videos]]") {
      section = "videos";
      currentVideo = {};
      videoKeys = new Set();
      nextState.videos.push(currentVideo);
      continue;
    }

    if (!section) {
      return failToml(lineNumber, "Add [settings] or [[videos]] before values.");
    }

    const assignment = parseTomlAssignment(line, lineNumber);
    if (!assignment.ok) return assignment;
    const { key, value } = assignment;

    if (section === "settings") {
      if (settingsKeys.has(key)) {
        return failToml(lineNumber, `Duplicate setting "${key}".`);
      }
      settingsKeys.add(key);
      if (key === "continuousLoop") continue;
      if (!(key in nextState.settings)) {
        return failToml(lineNumber, `Unknown setting "${key}".`);
      }
      nextState.settings[key] = value;
    } else {
      if (videoKeys.has(key)) {
        return failToml(lineNumber, `Duplicate video value "${key}".`);
      }
      videoKeys.add(key);
      if (!TOML_VIDEO_KEYS.includes(key)) {
        return failToml(lineNumber, `Unknown video value "${key}".`);
      }
      // Legacy icon values are accepted but ignored: videos no longer have icons.
      currentVideo[key] = value;
    }
  }

  const settingsError = validateSettings(nextState.settings);
  if (settingsError) {
    return { ok: false, message: settingsError };
  }

  const videosResult = normalizeTomlVideos(nextState.videos);
  if (!videosResult.ok) return videosResult;
  nextState.videos = videosResult.videos;

  return { ok: true, state: normalizeState(nextState) };
}

function parseTomlAssignment(line, lineNumber) {
  const match = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=\s*"((?:\\.|[^"\\])*)"$/);
  if (!match) {
    return failToml(lineNumber, "Use key = \"value\" with quoted string values.");
  }

  const stringResult = unescapeTomlString(match[2]);
  if (!stringResult.ok) {
    return failToml(lineNumber, "Only \\\" and \\\\ escapes are supported in strings.");
  }

  return { ok: true, key: match[1], value: stringResult.value };
}

function normalizeTomlVideos(videos) {
  const importedIds = new Set();
  const normalizedVideos = [];

  for (let index = 0; index < videos.length; index += 1) {
    const video = videos[index];
    if (!video.title || !video.url) {
      return { ok: false, message: `Video ${index + 1} needs title and url values.` };
    }

    if (video.title.length > MAX_TITLE_LENGTH) {
      return { ok: false, message: `Video ${index + 1} has a title longer than ${MAX_TITLE_LENGTH} characters.` };
    }

    const tags = normalizeTags(video.tags || "");
    const tagsError = validateTags(tags);
    if (tagsError) {
      return { ok: false, message: `Video ${index + 1}: ${tagsError}` };
    }

    if (Object.prototype.hasOwnProperty.call(video, "favorite") && !isAllowedValue(video.favorite, BOOLEAN_VALUES)) {
      return { ok: false, message: `Video ${index + 1}: favorite must be "true" or "false".` };
    }

    const parsedUrl = parseYouTubeUrl(video.url);
    if (!parsedUrl.ok) {
      return { ok: false, message: `Video ${index + 1}: ${parsedUrl.message}` };
    }

    if (importedIds.has(parsedUrl.id)) {
      return { ok: false, message: `Video ${index + 1} is a duplicate.` };
    }
    importedIds.add(parsedUrl.id);

    normalizedVideos.push({
      id: parsedUrl.id,
      title: video.title,
      tags,
      youtubeUrl: parsedUrl.canonicalUrl,
      favorite: video.favorite === "true" ? "true" : "false"
    });
  }

  return { ok: true, videos: normalizedVideos.map(normalizeVideo) };
}

function validateSettings(settings) {
  if (!/^\d{4,12}$/.test(settings.unlockCode)) {
    return "Settings: unlockCode must contain 4 to 12 digits.";
  }

  if (!isAllowedValue(settings.audioFeedback, BOOLEAN_VALUES)) {
    return "Settings: audioFeedback must be \"true\" or \"false\".";
  }

  if (!isAllowedValue(settings.youtubeControls, BOOLEAN_VALUES)) {
    return "Settings: youtubeControls must be \"true\" or \"false\".";
  }

  const speechRate = Number(settings.speechRate);
  if (!Number.isFinite(speechRate) || speechRate < 0.6 || speechRate > 1.2) {
    return "Settings: speechRate must be between 0.6 and 1.2.";
  }

  if (!isAllowedValue(settings.theme, THEME_VALUES)) {
    return "Settings: theme must be \"dark\" or \"light\".";
  }

  if (!isAllowedValue(settings.videoGridOrder, VIDEO_GRID_ORDER_VALUES)) {
    return "Settings: videoGridOrder must be \"manual\" or \"alpha\".";
  }

  return "";
}

function isAllowedValue(value, allowedValues) {
  return allowedValues.includes(value);
}

function normalizeSettings(settings) {
  const normalized = cloneDefaultState().settings;
  Object.keys(normalized).forEach((key) => {
    if (typeof settings[key] === "string") normalized[key] = settings[key];
  });

  return validateSettings(normalized) ? cloneDefaultState().settings : normalized;
}

function normalizeVideo(video) {
  if (!video || !isValidVideoId(video.id)) return null;
  return {
    id: video.id,
    title: String(video.title || "Untitled"),
    tags: normalizeTags(video.tags || ""),
    youtubeUrl: normalizeStoredYouTubeUrl(video),
    embedUrl: buildEmbedUrl(video.id),
    favorite: video.favorite === "true" ? "true" : "false"
  };
}

function failToml(lineNumber, message) {
  return { ok: false, message: `Line ${lineNumber}: ${message}` };
}

function writeRepeatToml(currentState) {
  const lines = [
    "# Repeat configuration",
    "[settings]",
    `unlockCode = "${escapeTomlString(currentState.settings.unlockCode)}"`,
    `audioFeedback = "${escapeTomlString(currentState.settings.audioFeedback)}"`,
    `youtubeControls = "${escapeTomlString(currentState.settings.youtubeControls)}"`,
    `speechRate = "${escapeTomlString(currentState.settings.speechRate)}"`,
    `theme = "${escapeTomlString(currentState.settings.theme)}"`,
    `videoGridOrder = "${escapeTomlString(currentState.settings.videoGridOrder)}"`
  ];

  currentState.videos.forEach((video) => {
    lines.push(
      "",
      "[[videos]]",
      `title = "${escapeTomlString(video.title)}"`,
      `tags = "${escapeTomlString(video.tags || "")}"`,
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

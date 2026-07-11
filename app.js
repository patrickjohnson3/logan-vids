"use strict";

let state = loadState();
let currentVideoId = null;
let unlockReturnScreen = SCREEN.home;
let speechPlaybackToken = 0;
let editingVideoId = null;

const screens = getScreens();
const els = getElements();

if (!IS_TEST_MODE) init();

// Startup and event wiring
function getRequiredElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }
  return element;
}

function getScreens() {
  return {
    home: getRequiredElement("homeScreen"),
    unlock: getRequiredElement("unlockScreen"),
    parent: getRequiredElement("parentScreen"),
    kid: getRequiredElement("kidScreen"),
    player: getRequiredElement("playerScreen")
  };
}

function getElements() {
  return {
    app: getRequiredElement("app"),
    kidModeButton: getRequiredElement("kidModeButton"),
    kidTitle: getRequiredElement("kidTitle"),
    parentModeButton: getRequiredElement("parentModeButton"),
    kidParentButton: getRequiredElement("kidParentButton"),
    unlockBackButton: getRequiredElement("unlockBackButton"),
    unlockForm: getRequiredElement("unlockForm"),
    unlockCode: getRequiredElement("unlockCode"),
    unlockMessage: getRequiredElement("unlockMessage"),
    settingCode: getRequiredElement("settingCode"),
    settingAudioFeedback: getRequiredElement("settingAudioFeedback"),
    settingYouTubeControls: getRequiredElement("settingYouTubeControls"),
    settingSpeechRate: getRequiredElement("settingSpeechRate"),
    speechRateOutput: getRequiredElement("speechRateOutput"),
    settingTheme: getRequiredElement("settingTheme"),
    settingVideoGridOrder: getRequiredElement("settingVideoGridOrder"),
    saveSettingsButton: getRequiredElement("saveSettingsButton"),
    settingsMessage: getRequiredElement("settingsMessage"),
    storageMessage: getRequiredElement("storageMessage"),
    addVideoForm: getRequiredElement("addVideoForm"),
    videoTitle: getRequiredElement("videoTitle"),
    videoTags: getRequiredElement("videoTags"),
    videoUrl: getRequiredElement("videoUrl"),
    addVideoMessage: getRequiredElement("addVideoMessage"),
    parentVideoList: getRequiredElement("parentVideoList"),
    emptyParentMessage: getRequiredElement("emptyParentMessage"),
    savedVideosMessage: getRequiredElement("savedVideosMessage"),
    clearAllButton: getRequiredElement("clearAllButton"),
    uploadTomlButton: getRequiredElement("uploadTomlButton"),
    tomlFileInput: getRequiredElement("tomlFileInput"),
    downloadTomlButton: getRequiredElement("downloadTomlButton"),
    tomlMessage: getRequiredElement("tomlMessage"),
    favoritesSection: getRequiredElement("favoritesSection"),
    favoritesRow: getRequiredElement("favoritesRow"),
    kidVideoGrid: getRequiredElement("kidVideoGrid"),
    emptyKidMessage: getRequiredElement("emptyKidMessage"),
    playerFrameWrap: getRequiredElement("playerFrameWrap"),
    favoriteButton: getRequiredElement("favoriteButton"),
    similarButton: getRequiredElement("similarButton"),
    againButton: getRequiredElement("againButton"),
    playerHomeButton: getRequiredElement("playerHomeButton"),
    homeButtons: Array.from(document.querySelectorAll("[data-go-home]"))
  };
}

function init() {
  applyTheme();
  bindEvents();
  renderCurrentScreen();
  showScreen(SCREEN.home);
}

function bindEvents() {
  els.kidModeButton.addEventListener("click", () => {
    requestKidFullscreen();
    speak(els.kidTitle.textContent);
    showScreen(SCREEN.kid);
  });

  els.parentModeButton.addEventListener("click", () => openParentUnlock(SCREEN.home));
  els.kidParentButton.addEventListener("click", () => openParentUnlock(SCREEN.kid));
  els.unlockBackButton.addEventListener("click", closeParentUnlock);

  els.homeButtons.forEach((button) => {
    button.addEventListener("click", () => showScreen(SCREEN.home));
  });

  els.unlockForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (els.unlockCode.value === state.settings.unlockCode) {
      setMessage(els.unlockMessage, "");
      showScreen(SCREEN.parent);
    } else {
      setMessage(els.unlockMessage, MESSAGES.unlockFailed);
    }
  });

  els.settingSpeechRate.addEventListener("input", () => {
    els.speechRateOutput.value = els.settingSpeechRate.value;
  });

  els.saveSettingsButton.addEventListener("click", saveSettingsFromForm);
  els.addVideoForm.addEventListener("submit", addVideoFromForm);
  els.clearAllButton.addEventListener("click", clearAllVideos);
  els.uploadTomlButton.addEventListener("click", () => els.tomlFileInput.click());
  els.tomlFileInput.addEventListener("change", importTomlFromFile);
  els.downloadTomlButton.addEventListener("click", downloadToml);
  els.favoriteButton.addEventListener("click", toggleCurrentFavorite);
  els.similarButton.addEventListener("click", playSimilarVideo);
  els.againButton.addEventListener("click", playCurrentAgain);
  els.playerHomeButton.addEventListener("click", returnToKidMode);
}

function showScreen(name) {
  if (name === SCREEN.home || name === SCREEN.parent) {
    exitKidFullscreen();
  }
  els.app.classList.toggle("player-active", name === SCREEN.player);
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
  if (name === SCREEN.parent) renderParent();
  if (name === SCREEN.kid) renderKid();
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
  els.unlockBackButton.textContent = returnScreen === SCREEN.kid ? "Back" : "Home";
  setMessage(els.unlockMessage, "");
  showScreen(SCREEN.unlock);
  els.unlockCode.focus();
}

function closeParentUnlock() {
  showScreen(unlockReturnScreen);
  if (unlockReturnScreen === SCREEN.kid) {
    els.kidParentButton.focus();
  } else {
    els.parentModeButton.focus();
  }
}

// Rendering coordinator.

function renderCurrentScreen() {
  applyTheme();
  const screenName = getActiveScreenName();
  if (screenName === SCREEN.parent) renderParent();
  if (screenName === SCREEN.kid) renderKid();
  if (screenName === SCREEN.player) renderPlayer();
}

function getActiveScreenName() {
  return Object.keys(screens).find((name) => screens[name].classList.contains("active")) || SCREEN.home;
}

function applyTheme() {
  document.body.classList.toggle("light", state.settings.theme === "light");
}

// Parent actions.

// Parent actions
function saveSettingsFromForm() {
  const nextSettings = {
    unlockCode: els.settingCode.value.trim(),
    audioFeedback: els.settingAudioFeedback.checked,
    youtubeControls: els.settingYouTubeControls.checked,
    speechRate: Number(els.settingSpeechRate.value),
    theme: els.settingTheme.value,
    videoGridOrder: els.settingVideoGridOrder.value
  };
  const settingsError = validateSettings(nextSettings);
  if (settingsError) {
    setMessage(els.settingsMessage, settingsError.replace("Settings: ", ""));
    return;
  }

  const persisted = updateState((draft) => {
    draft.settings = normalizeSettings(nextSettings);
  });
  setMessage(els.settingsMessage, persisted ? MESSAGES.settingsSaved : MESSAGES.storageUnavailable);
}

function addVideoFromForm(event) {
  event.preventDefault();
  const title = els.videoTitle.value.trim();
  const tags = normalizeTags(els.videoTags.value);
  const url = els.videoUrl.value.trim();
  const result = parseYouTubeUrl(url);

  if (!title) {
    setMessage(els.addVideoMessage, MESSAGES.addTitle);
    return;
  }

  if (title.length > MAX_TITLE_LENGTH) {
    setMessage(els.addVideoMessage, MESSAGES.titleTooLong);
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

  if (videoExists(result.id)) {
    setMessage(els.addVideoMessage, MESSAGES.duplicateVideo);
    return;
  }

  addStoredVideo({
    id: result.id,
    title,
    tags,
    youtubeUrl: result.canonicalUrl,
    favorite: "false"
  });

  els.addVideoForm.reset();
  setMessage(els.addVideoMessage, MESSAGES.videoAdded);
}

function moveVideo(index, direction) {
  moveStoredVideo(index, direction);
}

function deleteVideo(id) {
  const video = findVideo(id);
  if (!video) return;
  if (!confirm(`Delete "${video.title}"?`)) {
    setMessage(els.savedVideosMessage, MESSAGES.deleteVideoCancelled);
    return;
  }
  if (editingVideoId === id) editingVideoId = null;
  removeStoredVideo(id);
  setMessage(els.savedVideosMessage, MESSAGES.videoDeleted);
}

function clearAllVideos() {
  if (prompt(MESSAGES.clearAllPrompt) !== "CLEAR") {
    setMessage(els.savedVideosMessage, MESSAGES.clearAllCancelled);
    return;
  }
  editingVideoId = null;
  clearStoredVideos();
  setMessage(els.savedVideosMessage, MESSAGES.allVideosCleared);
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
    titleInput.setCustomValidity(MESSAGES.addTitle);
    titleInput.reportValidity();
    return;
  }

  if (title.length > MAX_TITLE_LENGTH) {
    titleInput.setCustomValidity(MESSAGES.titleTooLong);
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
  updateStoredVideoMetadata(id, {
    title,
    tags
  });
}

// Small DOM helpers.

function makeSmallButton(label, onClick, disabled, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = disabled;
  if (className) button.classList.add(className);
  button.addEventListener("click", onClick);
  return button;
}

function setMessage(element, text) {
  element.textContent = text;
}

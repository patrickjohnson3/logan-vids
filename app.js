"use strict";

let state = loadState();
let currentVideoId = null;
let unlockReturnScreen = SCREEN.home;
let editingVideoId = null;
let navigationSession = "";
let navigationTrail = [];
let navigationIndex = 0;
let navigationReturnIndex = null;
let restoringNavigation = false;

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
    parentTitle: getRequiredElement("parentTitle"),
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
    savedVideosTitle: getRequiredElement("savedVideosTitle"),
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
    playerTitle: getRequiredElement("playerTitle"),
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
  showScreen(SCREEN.home);
  if (!IS_TEST_MODE) initializeScreenHistory();
  registerServiceWorker();
}

function registerServiceWorker() {
  if (IS_TEST_MODE || !("serviceWorker" in navigator) || window.location.protocol === "file:") return;

  const register = () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}

function bindEvents() {
  window.addEventListener("popstate", restoreScreenHistory);
  window.addEventListener("pagehide", pausePendingPlayerStart);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pausePendingPlayerStart();
  });
  els.kidModeButton.addEventListener("click", enterKidMode);

  els.parentModeButton.addEventListener("click", () => openParentUnlock(SCREEN.home));
  els.kidParentButton.addEventListener("click", () => openParentUnlock(SCREEN.kid));
  els.unlockBackButton.addEventListener("click", closeParentUnlock);

  els.homeButtons.forEach((button) => {
    button.addEventListener("click", () => showScreen(SCREEN.home));
  });

  els.unlockForm.addEventListener("submit", handleParentUnlock);
  bindParentValidationEvents();

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

function bindParentValidationEvents() {
  [
    [els.settingCode, els.settingsMessage],
    [els.settingAudioFeedback, els.settingsMessage],
    [els.settingYouTubeControls, els.settingsMessage],
    [els.settingSpeechRate, els.settingsMessage],
    [els.settingTheme, els.settingsMessage],
    [els.settingVideoGridOrder, els.settingsMessage],
    [els.videoTitle, els.addVideoMessage],
    [els.videoTags, els.addVideoMessage],
    [els.videoUrl, els.addVideoMessage]
  ].forEach(([field, message]) => {
    field.addEventListener("input", () => clearFieldValidation(field, message));
  });
}

function enterKidMode() {
  requestKidFullscreen();
  speak(els.kidTitle.textContent);
  showScreen(SCREEN.kid);
  focusWithoutScrolling(els.kidTitle);
}

function handleParentUnlock(event) {
  event.preventDefault();
  if (els.unlockCode.value === state.settings.unlockCode) {
    setMessage(els.unlockMessage, "");
    showScreen(SCREEN.parent);
    focusWithoutScrolling(els.parentTitle);
  } else {
    setMessage(els.unlockMessage, MESSAGES.unlockFailed);
    focusWithoutScrolling(els.unlockCode);
  }
}

function showScreen(name) {
  recordScreenHistory(name);
  if (name === SCREEN.home || name === SCREEN.parent) {
    exitKidFullscreen();
  }
  els.app.classList.toggle("player-active", name === SCREEN.player);
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
  if (name === SCREEN.parent) renderParent();
  if (name === SCREEN.kid) renderKid();
}

function initializeScreenHistory() {
  navigationSession = `${Date.now()}-${Math.random()}`;
  navigationTrail = [{ screen: SCREEN.home }];
  navigationIndex = 0;
  navigationReturnIndex = null;
  try {
    history.replaceState({ repeatSession: navigationSession, repeatIndex: 0 }, "");
    history.scrollRestoration = "manual";
  } catch {
    navigationSession = "";
  }
}

function recordScreenHistory(name) {
  if (!navigationSession || restoringNavigation || navigationReturnIndex !== null) return;
  const previous = navigationTrail[navigationIndex];
  if (previous.screen === name) {
    if (name === SCREEN.player) previous.videoId = currentVideoId;
    return;
  }
  const entry = { screen: name, videoId: currentVideoId, returnScreen: unlockReturnScreen };
  const ancestorIndex = navigationTrail.slice(0, navigationIndex)
    .map((item) => item.screen).lastIndexOf(name);
  try {
    if (ancestorIndex !== -1) {
      // Render the explicit return immediately; consume its history entry asynchronously.
      navigationReturnIndex = ancestorIndex;
      history.go(ancestorIndex - navigationIndex);
    } else if (name === SCREEN.parent && previous.screen === SCREEN.unlock) {
      navigationTrail[navigationIndex] = entry;
    } else {
      history.pushState({ repeatSession: navigationSession, repeatIndex: navigationIndex + 1 }, "");
      navigationTrail = navigationTrail.slice(0, navigationIndex + 1);
      navigationTrail.push(entry);
      navigationIndex += 1;
    }
  } catch {
    navigationSession = "";
    navigationReturnIndex = null;
  }
}

function restoreScreenHistory(event) {
  if (!navigationSession) return;
  const index = event.state?.repeatIndex;
  const entry = event.state?.repeatSession === navigationSession && navigationTrail[index];
  if (entry && navigationReturnIndex === index) {
    navigationIndex = index;
    navigationReturnIndex = null;
    // A new tile may have been tapped before the previous return finished.
    recordScreenHistory(Object.keys(screens).find((name) => screens[name].classList.contains("active")));
    return;
  }

  navigationReturnIndex = null;
  restoringNavigation = true;
  try {
    const returningFromPlayer = currentVideoId !== null;
    if (returningFromPlayer) leavePlayer();
    stopSpeech();
    els.unlockCode.value = "";
    if (!entry) {
      showScreen(SCREEN.home);
      initializeScreenHistory();
      focusWithoutScrolling(els.kidModeButton);
      return;
    }
    navigationIndex = index;
    if (returningFromPlayer && entry.screen === SCREEN.kid) return;
    if (entry.screen === SCREEN.parent || entry.screen === SCREEN.unlock) {
      // History records a destination, never authorization to enter Parent Mode.
      openParentUnlock(entry.returnScreen || SCREEN.home);
    } else if (entry.screen === SCREEN.player && findVideo(entry.videoId)) {
      openPlayer(entry.videoId, false);
    } else {
      const name = entry.screen === SCREEN.home ? SCREEN.home : SCREEN.kid;
      if (entry.screen === SCREEN.player) restoringNavigation = false;
      showScreen(name);
      focusWithoutScrolling(name === SCREEN.home ? els.kidModeButton : els.kidTitle);
    }
  } finally {
    restoringNavigation = false;
  }
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
  focusWithoutScrolling(els.unlockCode);
}

function closeParentUnlock() {
  els.unlockCode.value = "";
  showScreen(unlockReturnScreen);
  if (unlockReturnScreen === SCREEN.kid) {
    focusWithoutScrolling(els.kidParentButton);
  } else {
    focusWithoutScrolling(els.parentModeButton);
  }
}

function applyTheme() {
  document.body.classList.toggle("light", state.settings.theme === "light");
}

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
    showFieldValidationError(
      getSettingsErrorField(settingsError),
      els.settingsMessage,
      settingsError.replace("Settings: ", "")
    );
    return;
  }

  [
    els.settingCode,
    els.settingAudioFeedback,
    els.settingYouTubeControls,
    els.settingSpeechRate,
    els.settingTheme,
    els.settingVideoGridOrder
  ].forEach((field) => clearFieldValidation(field, els.settingsMessage));

  const persisted = updateState((draft) => {
    draft.settings = normalizeSettings(nextSettings);
  });
  applyTheme();
  renderParentSettings();
  setMessage(els.settingsMessage, persisted ? MESSAGES.settingsSaved : MESSAGES.storageUnavailable);
}

function addVideoFromForm(event) {
  event.preventDefault();
  const title = els.videoTitle.value.trim();
  const tags = normalizeTags(els.videoTags.value);
  const url = els.videoUrl.value.trim();
  const result = parseYouTubeUrl(url);

  if (!title) {
    showFieldValidationError(els.videoTitle, els.addVideoMessage, MESSAGES.addTitle);
    return;
  }

  if (title.length > MAX_TITLE_LENGTH) {
    showFieldValidationError(els.videoTitle, els.addVideoMessage, MESSAGES.titleTooLong);
    return;
  }

  const tagsError = validateTags(tags);
  if (tagsError) {
    showFieldValidationError(els.videoTags, els.addVideoMessage, tagsError);
    return;
  }

  if (!result.ok) {
    showFieldValidationError(els.videoUrl, els.addVideoMessage, result.message);
    return;
  }

  if (videoExists(result.id)) {
    showFieldValidationError(els.videoUrl, els.addVideoMessage, MESSAGES.duplicateVideo);
    return;
  }

  const persisted = addStoredVideo({
    id: result.id,
    title,
    tags,
    youtubeUrl: result.canonicalUrl,
    favorite: "false"
  });

  els.addVideoForm.reset();
  [els.videoTitle, els.videoTags, els.videoUrl].forEach((field) => {
    clearFieldValidation(field, els.addVideoMessage);
  });
  renderParentVideoList();
  renderParentStorageWarning();
  setMessage(els.addVideoMessage, persisted ? MESSAGES.videoAdded : MESSAGES.storageUnavailable);
}

function moveVideo(id, direction) {
  const video = findVideo(id);
  const index = getVideos().findIndex((item) => item.id === id);
  const nextIndex = index + direction;
  if (!video || index < 0 || nextIndex < 0 || nextIndex >= getVideoCount()) return;

  moveStoredVideo(index, direction);
  renderParentVideoList();
  renderParentStorageWarning();
  const directionLabel = direction < 0 ? "up" : "down";
  setMessage(els.savedVideosMessage, `Moved ${video.title} ${directionLabel}.`);
  focusParentVideoAction(id, directionLabel);
}

function deleteVideo(id) {
  const video = findVideo(id);
  if (!video) return;
  if (!confirm(`Delete "${video.title}"?`)) {
    setMessage(els.savedVideosMessage, MESSAGES.deleteVideoCancelled);
    return;
  }
  const videos = getVideos();
  const deletedIndex = videos.findIndex((item) => item.id === id);
  const returnFocusVideoId =
    videos[deletedIndex + 1]?.id || videos[deletedIndex - 1]?.id || null;
  if (editingVideoId === id) editingVideoId = null;
  const persisted = removeStoredVideo(id);
  renderParentVideoList();
  renderParentStorageWarning();
  setMessage(els.savedVideosMessage, persisted ? MESSAGES.videoDeleted : MESSAGES.storageUnavailable);
  if (returnFocusVideoId) {
    focusParentVideoAction(returnFocusVideoId, "edit");
  } else {
    focusWithoutScrolling(els.savedVideosTitle);
  }
}

function clearAllVideos() {
  if (prompt(MESSAGES.clearAllPrompt) !== "CLEAR") {
    setMessage(els.savedVideosMessage, MESSAGES.clearAllCancelled);
    return;
  }
  editingVideoId = null;
  const persisted = clearStoredVideos();
  renderParentVideoList();
  renderParentStorageWarning();
  setMessage(els.savedVideosMessage, persisted ? MESSAGES.allVideosCleared : MESSAGES.storageUnavailable);
}

function startEditingVideo(id) {
  editingVideoId = id;
  renderParentVideoList();
  const titleInput = getParentVideoItem(id)?.querySelector("input");
  if (titleInput) focusAndReveal(titleInput);
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
  renderParentVideoList();
  renderParentStorageWarning();
  focusParentVideoAction(id, "edit");
}

function cancelEditingVideo(id) {
  editingVideoId = null;
  renderParentVideoList();
  focusParentVideoAction(id, "edit");
}

function getParentVideoItem(id) {
  return Array.from(els.parentVideoList.children)
    .find((item) => item.dataset.videoId === id);
}

function focusParentVideoAction(id, action) {
  const item = getParentVideoItem(id);
  if (!item) return;

  let control = item.querySelector(`[data-parent-action=${action}]`);
  if (control?.disabled && (action === "up" || action === "down")) {
    const fallbackAction = action === "up" ? "down" : "up";
    control = item.querySelector(`[data-parent-action=${fallbackAction}]`);
  }
  if (!control || control.disabled) {
    control = item.querySelector("[data-parent-action=edit]");
  }
  if (control) focusAndReveal(control);
}

function getSettingsErrorField(error) {
  if (error.includes("unlockCode")) return els.settingCode;
  if (error.includes("audioFeedback")) return els.settingAudioFeedback;
  if (error.includes("youtubeControls")) return els.settingYouTubeControls;
  if (error.includes("speechRate")) return els.settingSpeechRate;
  if (error.includes("theme")) return els.settingTheme;
  if (error.includes("videoGridOrder")) return els.settingVideoGridOrder;
  return els.settingCode;
}

function showFieldValidationError(field, message, text) {
  setMessage(message, text);
  field.setAttribute("aria-invalid", "true");
  field.setAttribute("aria-describedby", message.id);
  focusAndReveal(field);
}

function clearFieldValidation(field, message) {
  const describedByError = field.getAttribute("aria-describedby") === message.id;
  field.removeAttribute("aria-invalid");
  if (describedByError) {
    field.removeAttribute("aria-describedby");
    setMessage(message, "");
  }
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

function focusWithoutScrolling(element) {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function focusAndReveal(element) {
  focusWithoutScrolling(element);
  const rect = element.getBoundingClientRect();
  const viewport = window.visualViewport;
  const top = viewport ? viewport.offsetTop : 0;
  const left = viewport ? viewport.offsetLeft : 0;
  const height = viewport ? viewport.height : window.innerHeight;
  const width = viewport ? viewport.width : window.innerWidth;
  if (rect.top < top || rect.bottom > top + height || rect.left < left || rect.right > left + width) {
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

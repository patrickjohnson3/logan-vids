"use strict";

const STORAGE_KEY = "repeat.runtimeState.v1";
const MAX_TITLE_LENGTH = 48;
const MAX_TAGS_LENGTH = 120;
const MAX_TOML_FILE_BYTES = 256 * 1024;
const BOOLEAN_VALUES = ["true", "false"];
const THEME_VALUES = ["dark", "light"];
const VIDEO_GRID_ORDER_VALUES = ["manual", "alpha"];
const TOML_VIDEO_KEYS = ["title", "url", "icon", "favorite", "tags"];
const SCREEN = {
  home: "home",
  unlock: "unlock",
  parent: "parent",
  kid: "kid",
  player: "player"
};
const MESSAGES = {
  storageUnavailable: "Storage is unavailable. Changes will be lost when this page closes.",
  storageUnreadable: "Saved data could not be read. Repeat started with an empty library.",
  importConfirmation: "Importing TOML replaces all saved videos, favorites, and settings. Continue?",
  importCancelled: "Import cancelled.",
  importSessionOnly: "TOML imported for this session, but it could not be saved.",
  unreadableFile: "That file could not be read.",
  fileTooLarge: "Choose a TOML file smaller than 256 KB.",
  tomlDownloaded: "TOML downloaded.",
  clearAllPrompt: "Type CLEAR to delete all saved videos, favorites, and tags.",
  clearAllCancelled: "Clear all cancelled.",
  deleteVideoCancelled: "Delete cancelled."
};
const IS_TEST_MODE = typeof window !== "undefined" && window.REPEAT_TEST_MODE === true;
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

// State and persistence.

function loadState() {
  if (IS_TEST_MODE) return cloneDefaultState();

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
  if (IS_TEST_MODE) {
    renderCurrentScreen();
    return true;
  }

  let persisted = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageWarning = "";
  } catch {
    persisted = false;
    storageWarning = MESSAGES.storageUnavailable;
  }
  renderCurrentScreen();
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

function getVideos() {
  return state.videos;
}

function getVideoCount() {
  return getVideos().length;
}

function getFavorites() {
  return getVideos().filter(isFavoriteVideo);
}

function getNonFavoriteVideos() {
  return getVideos().filter((video) => !isFavoriteVideo(video));
}

function isFavoriteVideo(video) {
  return Boolean(video && video.favorite === "true");
}

function videoExists(id) {
  return getVideos().some((video) => video.id === id);
}

function addStoredVideo(video) {
  return updateState((draft) => {
    const normalized = normalizeVideo(video);
    if (normalized) draft.videos.push(normalized);
  });
}

function moveStoredVideo(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= getVideoCount()) return false;

  return updateState((draft) => {
    const [video] = draft.videos.splice(index, 1);
    draft.videos.splice(nextIndex, 0, video);
  });
}

function removeStoredVideo(id) {
  return updateState((draft) => {
    draft.videos = draft.videos.filter((video) => video.id !== id);
  });
}

function clearStoredVideos() {
  return updateState((draft) => {
    draft.videos = [];
  });
}

function updateStoredVideoMetadata(id, metadata) {
  return updateState((draft) => {
    const video = draft.videos.find((item) => item.id === id);
    if (!video) return;
    video.title = metadata.title;
    video.tags = metadata.tags;
  });
}

function setVideoFavorite(id, isFavorite) {
  return updateState((draft) => {
    const video = draft.videos.find((item) => item.id === id);
    if (video) video.favorite = isFavorite ? "true" : "false";
  });
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


// Tag helpers.

function normalizeTags(value) {
  const rawTags = Array.isArray(value) ? value : String(value).split(",");
  return rawTags
    .map(String)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function tagsToString(tags) {
  return normalizeTags(tags).join(", ");
}

function validateTags(tags) {
  if (tagsToString(tags).length > MAX_TAGS_LENGTH) {
    return `Use tags with ${MAX_TAGS_LENGTH} characters or fewer.`;
  }
  return "";
}

function makeTagSet(value) {
  return new Set(
    normalizeTags(value)
      .map((tag) => tag.toLowerCase())
      .filter(Boolean)
  );
}

function sharesAnyTag(tagSet, value) {
  return normalizeTags(value).some((tag) => tagSet.has(tag.toLowerCase()));
}


// Video lookup helpers.

function findVideo(id) {
  return getVideos().find((video) => video.id === id);
}

function findSimilarVideo(id) {
  const currentVideo = findVideo(id);
  if (!currentVideo) return null;

  const currentTags = makeTagSet(currentVideo.tags);
  if (currentTags.size === 0) return null;

  const videos = getVideos();
  const currentIndex = videos.findIndex((video) => video.id === id);
  for (let offset = 1; offset < videos.length; offset += 1) {
    const candidate = videos[(currentIndex + offset) % videos.length];
    if (isFavoriteVideo(candidate)) continue;
    if (sharesAnyTag(currentTags, candidate.tags)) return candidate;
  }

  return null;
}

// State validation and normalization.

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

  const defaults = cloneDefaultState().settings;
  if (!/^\d{4,12}$/.test(normalized.unlockCode)) {
    normalized.unlockCode = defaults.unlockCode;
  }
  if (!isAllowedValue(normalized.audioFeedback, BOOLEAN_VALUES)) {
    normalized.audioFeedback = defaults.audioFeedback;
  }
  if (!isAllowedValue(normalized.youtubeControls, BOOLEAN_VALUES)) {
    normalized.youtubeControls = defaults.youtubeControls;
  }
  const speechRate = Number(normalized.speechRate);
  if (!Number.isFinite(speechRate) || speechRate < 0.6 || speechRate > 1.2) {
    normalized.speechRate = defaults.speechRate;
  }
  if (!isAllowedValue(normalized.theme, THEME_VALUES)) {
    normalized.theme = defaults.theme;
  }
  if (!isAllowedValue(normalized.videoGridOrder, VIDEO_GRID_ORDER_VALUES)) {
    normalized.videoGridOrder = defaults.videoGridOrder;
  }
  return normalized;
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

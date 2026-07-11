"use strict";

// TOML import, export, parsing, and writing.

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
  setMessage(els.tomlMessage, MESSAGES.tomlDownloaded);
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
      `tags = "${escapeTomlString(tagsToString(video.tags))}"`,
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

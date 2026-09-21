"use strict";

const tests = [];
const results = document.getElementById("results");

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeTestStorage(initialValue = null, failures = {}) {
  let storedValue = initialValue;
  return {
    getItem(key) {
      assert(key === STORAGE_KEY, "storage should read the Repeat key");
      if (failures.read) throw new Error("read failed");
      return storedValue;
    },
    setItem(key, value) {
      assert(key === STORAGE_KEY, "storage should write the Repeat key");
      if (failures.write) throw new Error("write failed");
      storedValue = String(value);
    },
    getStoredValue() {
      return storedValue;
    }
  };
}

function withControlledPersistence(run) {
  const previousState = state;
  const previousStorageWarning = storageWarning;
  const previousStorageWriteBlocked = storageWriteBlocked;
  storageWarning = "";
  storageWriteBlocked = false;
  try {
    run();
  } finally {
    state = previousState;
    storageWarning = previousStorageWarning;
    storageWriteBlocked = previousStorageWriteBlocked;
  }
}

function withParentVideoState(videos, run) {
  const previousState = state;
  const previousEditingVideoId = editingVideoId;
  state = normalizeState({ settings: {}, videos });
  editingVideoId = null;
  setMessage(els.settingsMessage, "");
  setMessage(els.addVideoMessage, "");
  setMessage(els.savedVideosMessage, "");
  showScreen(SCREEN.parent);

  try {
    run();
  } finally {
    [
      els.settingCode,
      els.settingAudioFeedback,
      els.settingYouTubeControls,
      els.settingSpeechRate,
      els.settingTheme,
      els.settingVideoGridOrder,
      els.videoTitle,
      els.videoTags,
      els.videoUrl
    ].forEach((field) => {
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
    });
    setMessage(els.settingsMessage, "");
    setMessage(els.addVideoMessage, "");
    setMessage(els.savedVideosMessage, "");
    state = previousState;
    editingVideoId = previousEditingVideoId;
    showScreen(SCREEN.home);
  }
}

function getParentActionForTest(id, action) {
  return getParentVideoItem(id)?.querySelector(`[data-parent-action=${action}]`);
}

function withControlledPlayerPlayback(run) {
  const previousState = state;
  const previousCurrentVideoId = currentVideoId;
  const previousPlayerStartToken = playerStartToken;
  const previousPendingTimeoutId = pendingPlayerStartTimeoutId;
  const previousPreparationPending = playerPreparationPending;
  const previousPlayerOriginVideoId = playerOriginVideoId;
  const previousPlayerOriginScroll = playerOriginScroll;
  const previousStartCurrentPlayer = startCurrentPlayer;
  const previousSpeak = speak;
  const previousStopSpeech = stopSpeech;
  const previousBrowserIsOnline = browserIsOnline;
  const previousSetTimeout = window.setTimeout;
  const previousClearTimeout = window.clearTimeout;
  const speechRequests = [];
  const timers = new Map();
  let activeSpeech = null;
  let nextTimerId = 1;
  let playerStartCount = 0;
  let browserOnline = true;

  state = normalizeState({
    settings: { audioFeedback: true },
    videos: [
      { id: "AbCdEfGhI_j", title: "Trains", tags: "trains" },
      { id: "BbCdEfGhI_j", title: "More trains", tags: "trains" }
    ]
  });
  currentVideoId = null;
  playerStartToken = 0;
  pendingPlayerStartTimeoutId = null;
  playerPreparationPending = false;
  playerOriginVideoId = null;
  els.playerFrameWrap.innerHTML = "";
  els.playerFrameWrap.setAttribute("aria-busy", "false");
  els.playerTitle.textContent = "Player";

  window.setTimeout = (callback) => {
    const timerId = nextTimerId;
    nextTimerId += 1;
    timers.set(timerId, callback);
    return timerId;
  };
  window.clearTimeout = (timerId) => timers.delete(timerId);

  speak = (text, onComplete) => {
    const cancelledSpeech = activeSpeech;
    activeSpeech = null;
    if (cancelledSpeech) cancelledSpeech.complete();

    let completed = false;
    const request = {
      text,
      complete() {
        if (completed) return;
        completed = true;
        if (activeSpeech === request) activeSpeech = null;
        if (typeof onComplete === "function") onComplete();
      }
    };
    activeSpeech = request;
    speechRequests.push(request);
  };

  stopSpeech = () => {
    const cancelledSpeech = activeSpeech;
    activeSpeech = null;
    if (cancelledSpeech) cancelledSpeech.complete();
  };

  browserIsOnline = () => browserOnline;

  startCurrentPlayer = (autoplay) => {
    previousStartCurrentPlayer(autoplay);
    if (els.playerFrameWrap.querySelector("iframe")) playerStartCount += 1;
  };

  const controls = {
    speechRequests,
    completeSpeech(index) {
      speechRequests[index].complete();
    },
    fireNextTimer() {
      const nextTimer = timers.entries().next();
      assert(!nextTimer.done, "a pending player timer should exist");
      const [timerId, callback] = nextTimer.value;
      timers.delete(timerId);
      callback();
    },
    fireAllTimers() {
      while (timers.size > 0) this.fireNextTimer();
    },
    getPlayerStartCount() {
      return playerStartCount;
    },
    setBrowserOnline(value) {
      browserOnline = value;
    }
  };

  try {
    run(controls);
  } finally {
    playerStartToken += 1;
    timers.clear();
    activeSpeech = null;
    startCurrentPlayer = previousStartCurrentPlayer;
    speak = previousSpeak;
    stopSpeech = previousStopSpeech;
    browserIsOnline = previousBrowserIsOnline;
    window.setTimeout = previousSetTimeout;
    window.clearTimeout = previousClearTimeout;
    state = previousState;
    currentVideoId = previousCurrentVideoId;
    playerStartToken = previousPlayerStartToken;
    pendingPlayerStartTimeoutId = previousPendingTimeoutId;
    playerPreparationPending = previousPreparationPending;
    playerOriginVideoId = previousPlayerOriginVideoId;
    playerOriginScroll = previousPlayerOriginScroll;
    els.playerFrameWrap.innerHTML = "";
    els.playerFrameWrap.setAttribute("aria-busy", "false");
    els.playerFrameWrap.removeAttribute("aria-describedby");
    els.playerTitle.textContent = "Player";
    showScreen(SCREEN.home);
  }
}

test("test fixture blocks external network access", () => {
  const policy = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || "";
  assert(policy.includes("connect-src 'none'"), "tests should block external connections");
  assert(policy.includes("frame-src 'none'"), "tests should block remote player navigation");
  assert(policy.includes("img-src data:"), "tests should allow only inline test images");
});

test("parseYouTubeUrl strips share and playlist params", () => {
  const result = parseYouTubeUrl("https://youtu.be/AbCdEfGhI_j?si=track&list=ignored");
  assert(result.ok, result.message);
  assert(result.id === "AbCdEfGhI_j", "video ID should be parsed");
  assert(result.canonicalUrl === "https://www.youtube.com/watch?v=AbCdEfGhI_j", "URL should be canonical");
});

test("parseYouTubeUrl accepts supported HTTP and HTTPS forms", () => {
  const urls = [
    "https://www.youtube.com/watch?v=AbCdEfGhI_j",
    "https://youtu.be/AbCdEfGhI_j",
    "http://www.youtube.com/watch?v=AbCdEfGhI_j",
    "http://youtu.be/AbCdEfGhI_j"
  ];

  urls.forEach((url) => {
    const result = parseYouTubeUrl(url);
    assert(result.ok, `${url} should be accepted`);
    assert(result.canonicalUrl === "https://www.youtube.com/watch?v=AbCdEfGhI_j", `${url} should canonicalize to HTTPS`);
  });
});

test("parseYouTubeUrl rejects non-web protocols", () => {
  const urls = [
    "ftp://www.youtube.com/watch?v=AbCdEfGhI_j",
    "file://www.youtube.com/watch?v=AbCdEfGhI_j"
  ];

  urls.forEach((url) => {
    const result = parseYouTubeUrl(url);
    assert(!result.ok, `${url} should be rejected`);
    assert(result.message.includes("HTTP or HTTPS"), `${url} should report the accepted protocols`);
  });
});

test("parseYouTubeUrl rejects unsupported YouTube surfaces", () => {
  const unsupportedUrls = [
    "https://www.youtube.com/shorts/AbCdEfGhI_j",
    "https://www.youtube.com/channel/example",
    "https://www.youtube.com/playlist?list=example",
    "https://www.youtube.com/live/AbCdEfGhI_j"
  ];
  unsupportedUrls.forEach((url) => {
    assert(!parseYouTubeUrl(url).ok, `${url} should be rejected`);
  });
});

test("buildEmbedUrl applies restricted player settings", () => {
  const url = new URL(buildEmbedUrl("AbCdEfGhI_j", true, false));
  assert(url.hostname === "www.youtube-nocookie.com", "embeds should use the privacy-enhanced host");
  assert(url.searchParams.get("controls") === "0", "controls should be hidden");
  assert(url.searchParams.get("disablekb") === "1", "keyboard controls should be disabled");
  assert(url.searchParams.get("autoplay") === "1", "autoplay should be requested");
  assert(url.searchParams.get("loop") === "1", "the approved video should loop");
  assert(url.searchParams.get("playlist") === "AbCdEfGhI_j", "looping should target only the current video");
});

test("parseRepeatToml rejects invalid favorite values", () => {
  const result = parseRepeatToml([
    "[settings]",
    'unlockCode = "2468"',
    "",
    "[[videos]]",
    'title = "Bad favorite"',
    'url = "https://www.youtube.com/watch?v=AbCdEfGhI_j"',
    'favorite = "yes"'
  ].join("\n"));
  assert(!result.ok, "invalid favorite should fail");
});

test("parseRepeatToml rejects files without a supported section", () => {
  const result = parseRepeatToml("# No configuration here\n\n");
  assert(!result.ok, "comment-only TOML should fail");
});

test("parseRepeatToml rejects whitespace-only video titles", () => {
  const result = parseRepeatToml([
    "[[videos]]",
    'title = "   "',
    'url = "https://www.youtube.com/watch?v=AbCdEfGhI_j"'
  ].join("\n"));
  assert(!result.ok, "whitespace-only titles should fail");
});

test("writeRepeatToml round trips settings and video metadata", () => {
  const text = writeRepeatToml(normalizeState({
    settings: {
      youtubeControls: true,
      theme: "light"
    },
    videos: [{
      id: "AbCdEfGhI_j",
      title: "Train \"Ride\" \\ Calm",
      tags: "trains, calm",
      youtubeUrl: "https://youtu.be/AbCdEfGhI_j",
      favorite: "true"
    }]
  }));
  const result = parseRepeatToml(text);
  assert(result.ok, result.message);
  assert(result.state.settings.youtubeControls === true, "YouTube controls should round trip");
  assert(result.state.settings.theme === "light", "theme should round trip");
  assert(result.state.videos.length === 1, "one video should round trip");
  assert(result.state.videos[0].title === "Train \"Ride\" \\ Calm", "escaped titles should round trip");
  assert(tagsToString(result.state.videos[0].tags) === "trains, calm", "tags should round trip");
  assert(result.state.videos[0].favorite === "true", "favorite state should round trip");
});

test("cancelled TOML import preserves current state", () => {
  const previousState = state;
  const previousConfirm = window.confirm;
  try {
    state = normalizeState({
      settings: {},
      videos: [{ id: "AbCdEfGhI_j", title: "Keep me" }]
    });
    const beforeImport = JSON.stringify(state);
    window.confirm = () => false;

    importToml("[settings]\n");

    assert(JSON.stringify(state) === beforeImport, "cancelled import should not replace state");
    assert(els.tomlMessage.textContent === MESSAGES.importCancelled, "cancelled import should be reported");
  } finally {
    window.confirm = previousConfirm;
    state = previousState;
    els.tomlMessage.textContent = "";
  }
});

test("complete compatible TOML import replaces and persists runtime state", () => {
  withControlledPersistence(() => {
    const previousConfirm = window.confirm;
    const storage = makeTestStorage(JSON.stringify(normalizeState({
      settings: {},
      videos: [{ id: "CbCdEfGhI_j", title: "Replace me" }]
    })));
    try {
      state = loadState(storage);
      window.confirm = () => true;

      importToml([
        "[settings]",
        'unlockCode = "987654"',
        'audioFeedback = "false"',
        'youtubeControls = "true"',
        'speechRate = "1.1"',
        'theme = "light"',
        'videoGridOrder = "alpha"',
        "",
        "[[videos]]",
        'title = "Trains"',
        'tags = "trains, calm"',
        'url = "https://youtu.be/AbCdEfGhI_j?si=tracking"',
        'favorite = "true"',
        "",
        "[[videos]]",
        'title = "Music"',
        'tags = "music"',
        'url = "https://www.youtube.com/watch?v=BbCdEfGhI_j&list=ignored"',
        'favorite = "false"'
      ].join("\n"), storage);

      const storedState = JSON.parse(storage.getStoredValue());
      assert(state.settings.unlockCode === "987654", "import should replace the unlock code");
      assert(state.settings.audioFeedback === false, "import should type audio feedback");
      assert(state.settings.youtubeControls === true, "import should type YouTube controls");
      assert(state.settings.speechRate === 1.1, "import should type speech rate");
      assert(state.settings.theme === "light", "import should replace the theme");
      assert(state.settings.videoGridOrder === "alpha", "import should replace grid order");
      assert(state.videos.length === 2, "import should replace the video library");
      assert(state.videos[0].id === "AbCdEfGhI_j", "import should parse the first video ID");
      assert(state.videos[0].youtubeUrl === "https://www.youtube.com/watch?v=AbCdEfGhI_j", "import should store canonical URLs");
      assert(tagsToString(state.videos[0].tags) === "trains, calm", "import should normalize tags");
      assert(state.videos[0].favorite === "true", "import should preserve favorites");
      assert(JSON.stringify(storedState) === JSON.stringify(state), "import should persist the runtime replacement");
      assert(document.body.classList.contains("light"), "import should apply the replacement theme");
      assert(els.settingCode.value === "987654", "import should refresh Parent settings");
      assert(els.parentVideoList.children.length === 2, "import should refresh the Parent video list");
      assert(els.tomlMessage.textContent === MESSAGES.tomlImported, "successful import should be reported");
    } finally {
      window.confirm = previousConfirm;
      els.tomlMessage.textContent = "";
    }
  });
});

test("TOML import reports a session-only replacement when persistence fails", () => {
  withControlledPersistence(() => {
    const previousConfirm = window.confirm;
    const savedPayload = JSON.stringify(normalizeState({
      settings: {},
      videos: [{ id: "AbCdEfGhI_j", title: "Stored" }]
    }));
    const storage = makeTestStorage(savedPayload, { write: true });
    try {
      state = loadState(storage);
      window.confirm = () => true;

      importToml([
        "[[videos]]",
        'title = "Session only"',
        'url = "https://youtu.be/BbCdEfGhI_j"'
      ].join("\n"), storage);

      assert(state.videos[0].id === "BbCdEfGhI_j", "failed persistence should retain imported session state");
      assert(storage.getStoredValue() === savedPayload, "failed persistence should preserve stored data");
      assert(storageWarning === MESSAGES.storageUnavailable, "failed persistence should expose its warning");
      assert(els.tomlMessage.textContent === MESSAGES.importSessionOnly, "failed persistence should report session-only import");
    } finally {
      window.confirm = previousConfirm;
      els.tomlMessage.textContent = "";
    }
  });
});

test("TOML import applies defaults for omitted optional values", () => {
  const result = parseRepeatToml([
    "[settings]",
    'unlockCode = "9876"',
    "",
    "[[videos]]",
    'title = "Trains"',
    'url = "https://youtu.be/AbCdEfGhI_j"'
  ].join("\n"));

  assert(result.ok, result.message);
  assert(result.state.settings.audioFeedback === DEFAULT_STATE.settings.audioFeedback, "audio feedback should use its default");
  assert(result.state.settings.youtubeControls === DEFAULT_STATE.settings.youtubeControls, "YouTube controls should use their default");
  assert(result.state.settings.speechRate === DEFAULT_STATE.settings.speechRate, "speech rate should use its default");
  assert(result.state.settings.theme === DEFAULT_STATE.settings.theme, "theme should use its default");
  assert(result.state.settings.videoGridOrder === DEFAULT_STATE.settings.videoGridOrder, "grid order should use its default");
  assert(result.state.videos[0].favorite === "false", "favorite should default to false");
  assert(result.state.videos[0].tags.length === 0, "tags should default to empty");
});

test("parseRepeatToml rejects duplicate keys and duplicate video IDs", () => {
  const duplicateSetting = parseRepeatToml([
    "[settings]",
    'theme = "dark"',
    'theme = "light"'
  ].join("\n"));
  const duplicateVideoValue = parseRepeatToml([
    "[[videos]]",
    'title = "Trains"',
    'title = "More trains"',
    'url = "https://youtu.be/AbCdEfGhI_j"'
  ].join("\n"));
  const duplicateVideoId = parseRepeatToml([
    "[[videos]]",
    'title = "Trains"',
    'url = "https://youtu.be/AbCdEfGhI_j"',
    "",
    "[[videos]]",
    'title = "The same trains"',
    'url = "https://www.youtube.com/watch?v=AbCdEfGhI_j"'
  ].join("\n"));

  assert(!duplicateSetting.ok && duplicateSetting.message.includes("Duplicate setting"), "duplicate settings should fail");
  assert(!duplicateVideoValue.ok && duplicateVideoValue.message.includes("Duplicate video value"), "duplicate video keys should fail");
  assert(!duplicateVideoId.ok && duplicateVideoId.message.includes("duplicate"), "duplicate video IDs should fail");
});

test("parseRepeatToml rejects malformed and unsupported YouTube URLs", () => {
  const urls = [
    "not a URL",
    "https://www.youtube.com/shorts/AbCdEfGhI_j"
  ];

  urls.forEach((url) => {
    const result = parseRepeatToml([
      "[[videos]]",
      'title = "Bad URL"',
      `url = "${url}"`
    ].join("\n"));
    assert(!result.ok, `${url} should fail TOML validation`);
  });
});

test("parseRepeatToml rejects non-HTTP YouTube URLs", () => {
  const result = parseRepeatToml([
    "[[videos]]",
    'title = "FTP video"',
    'url = "ftp://www.youtube.com/watch?v=AbCdEfGhI_j"'
  ].join("\n"));

  assert(!result.ok, "TOML should reject non-HTTP YouTube URLs");
  assert(result.message.includes("HTTP or HTTPS"), "TOML should reuse the YouTube protocol error");
});

test("parseRepeatToml rejects invalid setting values and non-string assignments", () => {
  const invalidValue = parseRepeatToml([
    "[settings]",
    'audioFeedback = "sometimes"'
  ].join("\n"));
  const invalidType = parseRepeatToml([
    "[settings]",
    "audioFeedback = true"
  ].join("\n"));

  assert(!invalidValue.ok && invalidValue.message.includes("audioFeedback"), "invalid setting values should fail");
  assert(!invalidType.ok && invalidType.message.includes("quoted string"), "non-string setting assignments should fail");
});

test("parseRepeatToml rejects overlong titles and tags", () => {
  const overlongTitle = parseRepeatToml([
    "[[videos]]",
    `title = "${"T".repeat(MAX_TITLE_LENGTH + 1)}"`,
    'url = "https://youtu.be/AbCdEfGhI_j"'
  ].join("\n"));
  const overlongTags = parseRepeatToml([
    "[[videos]]",
    'title = "Trains"',
    `tags = "${"t".repeat(MAX_TAGS_LENGTH + 1)}"`,
    'url = "https://youtu.be/AbCdEfGhI_j"'
  ].join("\n"));

  assert(!overlongTitle.ok && overlongTitle.message.includes("title longer"), "overlong titles should fail");
  assert(!overlongTags.ok && overlongTags.message.includes("characters or fewer"), "overlong tags should fail");
});

test("parseRepeatToml rejects malformed video records", () => {
  const missingTitle = parseRepeatToml([
    "[[videos]]",
    'url = "https://youtu.be/AbCdEfGhI_j"'
  ].join("\n"));
  const missingUrl = parseRepeatToml([
    "[[videos]]",
    'title = "Trains"'
  ].join("\n"));
  const unknownValue = parseRepeatToml([
    "[[videos]]",
    'title = "Trains"',
    'url = "https://youtu.be/AbCdEfGhI_j"',
    'channel = "Not supported"'
  ].join("\n"));

  assert(!missingTitle.ok && missingTitle.message.includes("needs title and url"), "missing titles should fail");
  assert(!missingUrl.ok && missingUrl.message.includes("needs title and url"), "missing URLs should fail");
  assert(!unknownValue.ok && unknownValue.message.includes("Unknown video value"), "unknown video values should fail");
});

test("parseRepeatToml retains supported legacy-key compatibility", () => {
  const result = parseRepeatToml([
    "[settings]",
    'continuousLoop = "true"',
    "",
    "[[videos]]",
    'title = "Trains"',
    'url = "https://youtu.be/AbCdEfGhI_j"',
    'icon = "train"'
  ].join("\n"));

  assert(result.ok, result.message);
  assert(result.state.videos.length === 1, "legacy values should not remove the video");
  assert(!Object.prototype.hasOwnProperty.call(result.state.settings, "continuousLoop"), "legacy loop should be ignored");
  assert(!Object.prototype.hasOwnProperty.call(result.state.videos[0], "icon"), "legacy icons should be ignored");
});

test("invalid TOML import reports the error and preserves current state", () => {
  const previousState = state;
  try {
    state = normalizeState({
      settings: {},
      videos: [{ id: "AbCdEfGhI_j", title: "Keep me" }]
    });
    const beforeImport = JSON.stringify(state);

    importToml([
      "[[videos]]",
      'title = "Missing URL"'
    ].join("\n"));

    assert(JSON.stringify(state) === beforeImport, "invalid import should not replace state");
    assert(els.tomlMessage.textContent.includes("needs title and url"), "invalid import should report its error");
  } finally {
    state = previousState;
    els.tomlMessage.textContent = "";
  }
});

test("normalizeState drops malformed stored video IDs", () => {
  const normalized = normalizeState({
    settings: {},
    videos: [
      { id: "bad", title: "Bad" },
      { id: "AbCdEfGhI_j", title: "Good" }
    ]
  });
  assert(normalized.videos.length === 1, "only valid video should remain");
});

test("normalizeState removes duplicate stored video IDs", () => {
  const normalized = normalizeState({
    settings: {},
    videos: [
      { id: "AbCdEfGhI_j", title: "First" },
      { id: "AbCdEfGhI_j", title: "Duplicate" },
      { id: "BbCdEfGhI_j", title: "Second" }
    ]
  });
  assert(normalized.videos.length === 2, "duplicate IDs should be removed");
  assert(normalized.videos[0].title === "First", "the first saved video should be preserved");
  assert(normalized.videos[1].title === "Second", "saved order should be preserved");
});

test("normalizeState converts legacy setting strings to runtime types", () => {
  const normalized = normalizeState({
    settings: {
      audioFeedback: "false",
      youtubeControls: "true",
      speechRate: "1.1"
    },
    videos: []
  });
  assert(normalized.settings.audioFeedback === false, "audio feedback should be boolean");
  assert(normalized.settings.youtubeControls === true, "YouTube controls should be boolean");
  assert(normalized.settings.speechRate === 1.1, "speech rate should be numeric");
});

test("validateSettings accepts typed runtime settings", () => {
  const error = validateSettings({
    unlockCode: "2468",
    audioFeedback: false,
    youtubeControls: true,
    speechRate: 1,
    theme: "dark",
    videoGridOrder: "manual"
  });
  assert(error === "", `typed settings should be valid: ${error}`);
});

test("parseRepeatToml returns typed runtime settings", () => {
  const result = parseRepeatToml([
    "[settings]",
    'unlockCode = "2468"',
    'audioFeedback = "false"',
    'youtubeControls = "true"',
    'speechRate = "1.1"',
    'theme = "light"',
    'videoGridOrder = "alpha"'
  ].join("\n"));
  assert(result.ok, result.message);
  assert(result.state.settings.audioFeedback === false, "audio feedback should import as boolean");
  assert(result.state.settings.youtubeControls === true, "YouTube controls should import as boolean");
  assert(result.state.settings.speechRate === 1.1, "speech rate should import as number");
});

test("normalizeState migrates unversioned saved state", () => {
  const normalized = normalizeState({
    settings: {},
    videos: []
  });
  assert(normalized.schemaVersion === CURRENT_SCHEMA_VERSION, "schema version should be current");
});

test("loadState reads compatible state from supplied storage", () => {
  withControlledPersistence(() => {
    const payload = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      settings: { theme: "light" },
      videos: [{ id: "AbCdEfGhI_j", title: "Stored video" }]
    });
    const storage = makeTestStorage(payload);

    const loaded = loadState(storage);

    assert(loaded.settings.theme === "light", "compatible settings should load");
    assert(loaded.videos.length === 1, "compatible videos should load");
    assert(loaded.videos[0].title === "Stored video", "stored metadata should load");
    assert(storageWarning === "", "compatible storage should not warn");
    assert(!storageWriteBlocked, "compatible storage should remain writable");
    assert(storage.getStoredValue() === payload, "loading should not rewrite storage");
  });
});

test("loadState handles throwing storage reads", () => {
  withControlledPersistence(() => {
    const storage = makeTestStorage(null, { read: true });

    const loaded = loadState(storage);

    assert(loaded.videos.length === 0, "failed reads should return an empty library");
    assert(loaded.settings.unlockCode === DEFAULT_STATE.settings.unlockCode, "failed reads should use safe defaults");
    assert(storageWarning === MESSAGES.storageUnavailable, "failed reads should expose the storage warning");
    assert(!storageWriteBlocked, "failed reads should not create a schema write block");
  });
});

test("loadState handles malformed stored JSON without replacing it", () => {
  withControlledPersistence(() => {
    const malformedPayload = "{not valid json";
    const storage = makeTestStorage(malformedPayload);

    const loaded = loadState(storage);

    assert(loaded.videos.length === 0, "malformed JSON should return an empty library");
    assert(storageWarning === MESSAGES.storageUnreadable, "malformed JSON should expose the unreadable warning");
    assert(storage.getStoredValue() === malformedPayload, "malformed storage should remain untouched");
  });
});

test("newer stored schemas block writes and preserve their payload", () => {
  withControlledPersistence(() => {
    const futurePayload = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      settings: { theme: "light" },
      videos: [{ id: "AbCdEfGhI_j", title: "Future video" }]
    });
    const storage = makeTestStorage(futurePayload);
    state = loadState(storage);

    state.settings.theme = "dark";
    const sessionState = JSON.stringify(state);
    const persisted = persistState(storage);

    assert(!persisted, "newer stored state should block writes");
    assert(storageWriteBlocked, "newer stored state should retain the write block");
    assert(storageWarning === MESSAGES.storageNewer, "newer stored state should expose its warning");
    assert(storage.getStoredValue() === futurePayload, "newer stored payload should remain byte-for-byte unchanged");
    assert(JSON.stringify(state) === sessionState, "blocked writes should retain session changes");
  });
});

test("failed storage writes preserve session state and existing data", () => {
  withControlledPersistence(() => {
    const savedPayload = JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, videos: [] });
    const storage = makeTestStorage(savedPayload, { write: true });
    state = normalizeState({
      settings: { theme: "light" },
      videos: [{ id: "AbCdEfGhI_j", title: "Session video" }]
    });
    const sessionState = JSON.stringify(state);

    const persisted = persistState(storage);

    assert(!persisted, "throwing writes should report failure");
    assert(JSON.stringify(state) === sessionState, "throwing writes should retain session state");
    assert(storage.getStoredValue() === savedPayload, "throwing writes should preserve existing storage");
    assert(storageWarning === MESSAGES.storageUnavailable, "throwing writes should expose the storage warning");
  });
});

test("compatible TOML replacement clears a newer-schema write block", () => {
  withControlledPersistence(() => {
    const futurePayload = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      settings: { theme: "dark" },
      videos: []
    });
    const storage = makeTestStorage(futurePayload);
    state = loadState(storage);
    const result = parseRepeatToml([
      "[settings]",
      'unlockCode = "9876"',
      'theme = "light"'
    ].join("\n"));
    assert(result.ok, result.message);

    const persisted = replaceState(result.state, storage);
    const storedState = JSON.parse(storage.getStoredValue());

    assert(persisted, "compatible TOML state should persist");
    assert(!storageWriteBlocked, "compatible TOML state should clear the write block");
    assert(storageWarning === "", "compatible replacement should clear the warning");
    assert(storedState.schemaVersion === CURRENT_SCHEMA_VERSION, "replacement should store the current schema");
    assert(storedState.settings.unlockCode === "9876", "replacement should store imported settings");
    assert(storedState.settings.theme === "light", "replacement should replace the future state");
  });
});

test("numeric persisted unlock codes normalize to usable strings", () => {
  withControlledPersistence(() => {
    const storage = makeTestStorage(JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      settings: { unlockCode: 2468 },
      videos: []
    }));

    const loaded = loadState(storage);

    assert(loaded.settings.unlockCode === "2468", "numeric codes should become strings");
    assert(typeof loaded.settings.unlockCode === "string", "unlock codes should use the input value type");
  });
});

test("persisted video metadata normalizes safely within supported bounds", () => {
  withControlledPersistence(() => {
    const storage = makeTestStorage(JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      settings: {},
      videos: [
        {
          id: "AbCdEfGhI_j",
          title: "   ",
          tags: ["x".repeat(MAX_TAGS_LENGTH + 1), "calm"]
        },
        {
          id: "BbCdEfGhI_j",
          title: `  ${"T".repeat(MAX_TITLE_LENGTH + 20)}  `,
          tags: ["trains", "y".repeat(MAX_TAGS_LENGTH), "music"]
        }
      ]
    }));

    const loaded = loadState(storage);

    assert(loaded.videos.length === 2, "valid video IDs should remain playable");
    assert(loaded.videos[0].title === "Untitled", "blank stored titles should receive a safe label");
    assert(loaded.videos[0].tags.join(", ") === "calm", "oversized tags should not remove later valid tags");
    assert(loaded.videos[1].title.length === MAX_TITLE_LENGTH, "oversized stored titles should be truncated");
    assert(loaded.videos[1].title === "T".repeat(MAX_TITLE_LENGTH), "stored titles should be trimmed before truncation");
    assert(tagsToString(loaded.videos[1].tags).length <= MAX_TAGS_LENGTH, "stored tags should fit the supported bound");
    assert(tagsToString(loaded.videos[1].tags) === "trains, music", "whole tags that fit should be preserved");
  });
});

test("malformed persisted metadata remains TOML round-trip safe", () => {
  withControlledPersistence(() => {
    const storage = makeTestStorage(JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      settings: {},
      videos: [{
        id: "AbCdEfGhI_j",
        title: "  Train\r\n  Ride  ",
        tags: ["calm\rquiet", "music\n \nsoft"]
      }]
    }));

    const loaded = loadState(storage);
    const exported = writeRepeatToml(loaded);
    const parsed = parseRepeatToml(exported);

    assert(loaded.videos[0].title === "Train Ride", "persisted title line breaks should collapse");
    assert(tagsToString(loaded.videos[0].tags) === "calm quiet, music soft", "persisted tag line breaks should collapse");
    assert(parsed.ok, parsed.message);
    assert(parsed.state.videos[0].title === loaded.videos[0].title, "the normalized title should round trip");
    assert(tagsToString(parsed.state.videos[0].tags) === tagsToString(loaded.videos[0].tags), "normalized tags should round trip");
  });
});

test("video actions preserve unsaved Parent settings", () => {
  const previousState = state;
  const previousEditingVideoId = editingVideoId;
  try {
    state = normalizeState({
      settings: {},
      videos: [
        { id: "AbCdEfGhI_j", title: "One" },
        { id: "BbCdEfGhI_j", title: "Two" }
      ]
    });
    editingVideoId = null;
    renderParent();
    els.settingCode.value = "9876";

    moveVideo("AbCdEfGhI_j", 1);

    assert(els.settingCode.value === "9876", "video actions should not reset unsaved settings");
  } finally {
    state = previousState;
    editingVideoId = previousEditingVideoId;
    renderParent();
  }
});

test("Parent video actions include the video title in accessible names", () => {
  withParentVideoState([
    { id: "AbCdEfGhI_j", title: "Trains" },
    { id: "BbCdEfGhI_j", title: "Music" }
  ], () => {
    const edit = getParentActionForTest("AbCdEfGhI_j", "edit");
    const up = getParentActionForTest("AbCdEfGhI_j", "up");
    const down = getParentActionForTest("AbCdEfGhI_j", "down");
    const deleteButton = getParentActionForTest("AbCdEfGhI_j", "delete");

    assert(edit.textContent === "Edit", "Edit should keep its visible label");
    assert(up.textContent === "Up", "Up should keep its visible label");
    assert(down.textContent === "Down", "Down should keep its visible label");
    assert(deleteButton.textContent === "Delete", "Delete should keep its visible label");
    assert(edit.getAttribute("aria-label") === "Edit Trains", "Edit should name its video");
    assert(up.getAttribute("aria-label") === "Move Trains up", "Up should name its video");
    assert(down.getAttribute("aria-label") === "Move Trains down", "Down should name its video");
    assert(deleteButton.getAttribute("aria-label") === "Delete Trains", "Delete should name its video");
  });
});

test("Move actions restore focus and announce the result", () => {
  withParentVideoState([
    { id: "AbCdEfGhI_j", title: "One" },
    { id: "BbCdEfGhI_j", title: "Two" },
    { id: "CbCdEfGhI_j", title: "Three" },
    { id: "DbCdEfGhI_j", title: "Four" }
  ], () => {
    getParentActionForTest("CbCdEfGhI_j", "up").click();

    assert(document.activeElement === getParentActionForTest("CbCdEfGhI_j", "up"), "Move Up should regain focus");
    assert(els.savedVideosMessage.textContent === "Moved Three up.", "Move Up should announce its result");

    getParentActionForTest("CbCdEfGhI_j", "down").click();

    assert(document.activeElement === getParentActionForTest("CbCdEfGhI_j", "down"), "Move Down should regain focus");
    assert(els.savedVideosMessage.textContent === "Moved Three down.", "Move Down should announce its result");
  });
});

test("Save and Cancel restore focus to Edit for the same video", () => {
  withParentVideoState([
    { id: "AbCdEfGhI_j", title: "Trains", tags: "calm" }
  ], () => {
    getParentActionForTest("AbCdEfGhI_j", "edit").click();
    const editedItem = getParentVideoItem("AbCdEfGhI_j");
    const titleInput = editedItem.querySelector("input");
    titleInput.value = "Train rides";
    getParentActionForTest("AbCdEfGhI_j", "save").click();

    assert(findVideo("AbCdEfGhI_j").title === "Train rides", "Save should update the title");
    assert(document.activeElement === getParentActionForTest("AbCdEfGhI_j", "edit"), "Save should focus Edit");

    getParentActionForTest("AbCdEfGhI_j", "edit").click();
    getParentActionForTest("AbCdEfGhI_j", "cancel").click();

    assert(document.activeElement === getParentActionForTest("AbCdEfGhI_j", "edit"), "Cancel should focus Edit");
  });
});

test("deleting a middle video focuses the next video's Edit control", () => {
  const previousConfirm = window.confirm;
  window.confirm = () => true;
  try {
    withParentVideoState([
      { id: "AbCdEfGhI_j", title: "One" },
      { id: "BbCdEfGhI_j", title: "Two" },
      { id: "CbCdEfGhI_j", title: "Three" }
    ], () => {
      getParentActionForTest("BbCdEfGhI_j", "delete").click();

      assert(document.activeElement === getParentActionForTest("CbCdEfGhI_j", "edit"), "middle deletion should focus the next video");
    });
  } finally {
    window.confirm = previousConfirm;
  }
});

test("deleting the last video focuses the previous video's Edit control", () => {
  const previousConfirm = window.confirm;
  window.confirm = () => true;
  try {
    withParentVideoState([
      { id: "AbCdEfGhI_j", title: "One" },
      { id: "BbCdEfGhI_j", title: "Two" }
    ], () => {
      getParentActionForTest("BbCdEfGhI_j", "delete").click();

      assert(document.activeElement === getParentActionForTest("AbCdEfGhI_j", "edit"), "last deletion should focus the previous video");
    });
  } finally {
    window.confirm = previousConfirm;
  }
});

test("deleting the final video focuses the Saved videos heading", () => {
  const previousConfirm = window.confirm;
  window.confirm = () => true;
  try {
    withParentVideoState([
      { id: "AbCdEfGhI_j", title: "One" }
    ], () => {
      getParentActionForTest("AbCdEfGhI_j", "delete").click();

      assert(document.activeElement === els.savedVideosTitle, "final deletion should focus the list heading");
    });
  } finally {
    window.confirm = previousConfirm;
  }
});

test("cancelled deletion preserves the video library", () => {
  const previousConfirm = window.confirm;
  window.confirm = () => false;
  try {
    withParentVideoState([
      { id: "AbCdEfGhI_j", title: "Keep me" },
      { id: "BbCdEfGhI_j", title: "Also keep me" }
    ], () => {
      getParentActionForTest("AbCdEfGhI_j", "delete").click();

      assert(getVideoCount() === 2, "cancelled deletion should preserve every video");
      assert(videoExists("AbCdEfGhI_j"), "cancelled deletion should preserve the selected video");
      assert(els.savedVideosMessage.textContent === MESSAGES.deleteVideoCancelled, "cancelled deletion should be reported");
    });
  } finally {
    window.confirm = previousConfirm;
  }
});

test("Clear all requires the exact confirmation and reports the result", () => {
  const previousPrompt = window.prompt;
  let promptResult = "clear";
  window.prompt = () => promptResult;
  try {
    withParentVideoState([
      { id: "AbCdEfGhI_j", title: "One" },
      { id: "BbCdEfGhI_j", title: "Two" }
    ], () => {
      clearAllVideos();

      assert(getVideoCount() === 2, "an inexact confirmation should preserve the library");
      assert(els.savedVideosMessage.textContent === MESSAGES.clearAllCancelled, "an inexact confirmation should be reported");

      promptResult = "CLEAR";
      clearAllVideos();

      assert(getVideoCount() === 0, "the exact confirmation should clear the library");
      assert(els.parentVideoList.children.length === 0, "the Parent list should update after clearing");
      assert(!els.emptyParentMessage.hidden, "the empty Parent state should appear after clearing");
      assert(els.savedVideosMessage.textContent === MESSAGES.allVideosCleared, "successful clearing should be reported");
    });
  } finally {
    window.prompt = previousPrompt;
  }
});

test("Add Video custom validation focuses and describes the invalid field", () => {
  withParentVideoState([], () => {
    els.videoTitle.value = "   ";
    els.videoTags.value = "calm";
    els.videoUrl.value = "https://youtu.be/AbCdEfGhI_j";

    addVideoFromForm({ preventDefault() {} });

    assert(document.activeElement === els.videoTitle, "invalid Add Video title should receive focus");
    assert(els.videoTitle.getAttribute("aria-invalid") === "true", "invalid Add Video title should be marked");
    assert(els.videoTitle.getAttribute("aria-describedby") === "addVideoMessage", "Add Video error should describe the title");
    assert(els.addVideoMessage.textContent === MESSAGES.addTitle, "Add Video error should be visible");

    els.videoTitle.value = "Trains";
    els.videoTitle.dispatchEvent(new Event("input", { bubbles: true }));

    assert(!els.videoTitle.hasAttribute("aria-invalid"), "editing should clear Add Video invalid state");
    assert(!els.videoTitle.hasAttribute("aria-describedby"), "editing should clear the Add Video error association");
    assert(els.addVideoMessage.textContent === "", "editing should clear the stale Add Video error");

    addVideoFromForm({ preventDefault() {} });

    assert(videoExists("AbCdEfGhI_j"), "corrected Add Video data should save");
    assert(els.addVideoMessage.textContent === MESSAGES.videoAdded, "successful Add Video submission should report success");
  });
});

test("Settings custom validation focuses and describes the invalid field", () => {
  withParentVideoState([], () => {
    els.settingCode.value = "12";

    saveSettingsFromForm();

    assert(document.activeElement === els.settingCode, "invalid unlock code should receive focus");
    assert(els.settingCode.getAttribute("aria-invalid") === "true", "invalid unlock code should be marked");
    assert(els.settingCode.getAttribute("aria-describedby") === "settingsMessage", "Settings error should describe the unlock code");
    assert(els.settingsMessage.textContent.includes("4 to 12 digits"), "Settings error should be visible");

    els.settingCode.value = "9876";
    els.settingCode.dispatchEvent(new Event("input", { bubbles: true }));

    assert(!els.settingCode.hasAttribute("aria-invalid"), "editing should clear Settings invalid state");
    assert(!els.settingCode.hasAttribute("aria-describedby"), "editing should clear the Settings error association");
    assert(els.settingsMessage.textContent === "", "editing should clear the stale Settings error");

    saveSettingsFromForm();

    assert(state.settings.unlockCode === "9876", "corrected Settings data should save");
    assert(els.settingsMessage.textContent === MESSAGES.settingsSaved, "successful Settings submission should report success");
  });
});

test("validation reveals a field below the visible viewport", () => {
  const field = document.createElement("input");
  const previousScroll = window.scrollY;
  field.style.position = "absolute";
  field.style.top = `${window.innerHeight + 100}px`;
  field.style.left = "24px";
  document.body.append(field);
  try {
    window.scrollTo(0, 0);
    assert(field.getBoundingClientRect().top > window.innerHeight, "the invalid field should start offscreen");
    showFieldValidationError(field, els.settingsMessage, "Check this field.");
    const rect = field.getBoundingClientRect();
    assert(document.activeElement === field, "validation should focus the field");
    assert(rect.top >= 0 && rect.bottom <= window.innerHeight, "validation should reveal the whole field");
  } finally {
    field.remove();
    setMessage(els.settingsMessage, "");
    window.scrollTo(0, previousScroll);
  }
});

test("Home to Kid Mode focuses the Kid heading", () => {
  const previousRequestKidFullscreen = requestKidFullscreen;
  const previousSpeak = speak;
  requestKidFullscreen = () => {};
  speak = () => {};
  try {
    showScreen(SCREEN.home);
    enterKidMode();

    assert(screens[SCREEN.kid].classList.contains("active"), "Kid Mode should become active");
    assert(document.activeElement === els.kidTitle, "Kid Mode should focus its heading");
  } finally {
    requestKidFullscreen = previousRequestKidFullscreen;
    speak = previousSpeak;
    showScreen(SCREEN.home);
  }
});

test("successful Parent unlock focuses the Parent heading", () => {
  const previousState = state;
  state = normalizeState({ settings: { unlockCode: "2468" }, videos: [] });
  try {
    showScreen(SCREEN.unlock);
    els.unlockCode.value = "2468";
    handleParentUnlock({ preventDefault() {} });

    assert(screens[SCREEN.parent].classList.contains("active"), "Parent Mode should become active");
    assert(document.activeElement === els.parentTitle, "Parent Mode should focus its heading");
  } finally {
    state = previousState;
    showScreen(SCREEN.home);
  }
});

test("Kid favorites render separately and hide when empty", () => {
  const previousState = state;
  try {
    state = normalizeState({
      settings: {},
      videos: [
        { id: "AbCdEfGhI_j", title: "Favorite trains", favorite: "true" },
        { id: "BbCdEfGhI_j", title: "Music" }
      ]
    });
    renderKid();

    const favoriteTile = els.favoritesRow.querySelector(".video-tile");
    const approvedTile = els.kidVideoGrid.querySelector(".video-tile");
    assert(!els.favoritesSection.hidden, "Favorites should be visible when a favorite exists");
    assert(els.favoritesRow.children.length === 1, "the favorite should appear once in the Favorites row");
    assert(favoriteTile.dataset.videoId === "AbCdEfGhI_j", "the favorite should appear in the Favorites row");
    assert(favoriteTile.getAttribute("aria-label") === "Favorite trains, favorite", "the favorite tile should expose its state");
    assert(favoriteTile.querySelector(".favorite-badge"), "the favorite tile should include its visible badge");
    assert(els.kidVideoGrid.children.length === 1, "the main grid should exclude favorites");
    assert(approvedTile.dataset.videoId === "BbCdEfGhI_j", "the main grid should retain non-favorites");

    state.videos[0].favorite = "false";
    renderKid();

    assert(els.favoritesSection.hidden, "Favorites should hide when no favorites remain");
    assert(els.favoritesRow.children.length === 0, "the hidden Favorites row should be empty");
    assert(els.kidVideoGrid.children.length === 2, "former favorites should return to the main grid");
  } finally {
    state = previousState;
    renderKid();
  }
});

test("Kid video content precedes Parent entry in sequential DOM order", () => {
  const previousState = state;
  try {
    state = normalizeState({
      settings: {},
      videos: [
        { id: "AbCdEfGhI_j", title: "Favorite", favorite: "true" },
        { id: "BbCdEfGhI_j", title: "Approved" }
      ]
    });
    renderKid();

    const tiles = screens[SCREEN.kid].querySelectorAll(".video-tile");
    assert(tiles.length === 2, "Kid Mode should render both approved videos");
    tiles.forEach((tile) => {
      const position = tile.compareDocumentPosition(els.kidParentButton);
      assert(position & Node.DOCUMENT_POSITION_FOLLOWING, "Parent entry should follow every video tile");
    });
    assert(els.kidParentButton.tabIndex === 0, "Parent entry should remain keyboard accessible");
  } finally {
    state = previousState;
    renderKid();
  }
});

function withScreenHistoryForTest(run) {
  const previous = {
    session: navigationSession, trail: navigationTrail, index: navigationIndex,
    returnIndex: navigationReturnIndex, restoring: restoringNavigation,
    push: history.pushState, replace: history.replaceState, go: history.go,
    scrollRestoration: history.scrollRestoration
  };
  const entries = [];
  let position = 0;
  let pendingPosition = null;
  history.replaceState = (entry) => { entries[position] = entry; };
  history.pushState = (entry) => {
    entries.splice(position + 1);
    entries.push(entry);
    position += 1;
  };
  history.go = (distance) => { pendingPosition = position + distance; };
  const flush = () => {
    assert(pendingPosition !== null, "a history traversal should be pending");
    position = pendingPosition;
    pendingPosition = null;
    restoreScreenHistory({ state: entries[position] });
  };
  navigationSession = "";
  showScreen(SCREEN.home);
  initializeScreenHistory();
  try {
    run({
      flush,
      back() { history.go(-1); flush(); },
      forward() { history.go(1); flush(); },
      count() { return entries.length; }
    });
  } finally {
    navigationSession = previous.session;
    navigationTrail = previous.trail;
    navigationIndex = previous.index;
    navigationReturnIndex = previous.returnIndex;
    restoringNavigation = previous.restoring;
    history.pushState = previous.push;
    history.replaceState = previous.replace;
    history.go = previous.go;
    history.scrollRestoration = previous.scrollRestoration;
  }
}

test("Back cancels Player and Forward requires an explicit retry", () => {
  withControlledPlayerPlayback((controls) => {
    withScreenHistoryForTest((navigation) => {
      showScreen(SCREEN.kid);
      openPlayer("AbCdEfGhI_j");
      navigation.back();
      controls.completeSpeech(0);
      controls.fireAllTimers();
      assert(screens[SCREEN.kid].classList.contains("active"), "Back should return to Kid Mode");
      assert(document.activeElement.dataset.videoId === "AbCdEfGhI_j", "Back should focus the originating tile");
      assert(!els.playerFrameWrap.querySelector("iframe"), "Back should prevent stale playback");
      navigation.forward();
      assert(screens[SCREEN.player].classList.contains("active"), "Forward should restore the selection");
      assert(currentVideoId === "AbCdEfGhI_j", "Forward should retain the selected video");
      assert(!els.playerFrameWrap.querySelector("iframe"), "Forward must not autoplay");
      assert(els.playerFrameWrap.textContent.includes("Again"), "Forward should explain how to resume");
      navigation.back();
      navigation.back();
      assert(screens[SCREEN.home].classList.contains("active"), "Back should reach the opening screen");
    });
  });
});

test("explicit Player Home consumes history even when another tile is tapped immediately", () => {
  withControlledPlayerPlayback(() => {
    withScreenHistoryForTest((navigation) => {
      showScreen(SCREEN.kid);
      openPlayer("AbCdEfGhI_j");
      returnToKidMode();
      openPlayer("BbCdEfGhI_j");
      navigation.flush();
      assert(currentVideoId === "BbCdEfGhI_j", "a late return must not clear the new selection");
      assert(navigation.count() === 3, "repeated playback should reuse the forward branch");
      navigation.back();
      assert(screens[SCREEN.kid].classList.contains("active"), "Back should return to Kid Mode once");
      navigation.back();
      assert(screens[SCREEN.home].classList.contains("active"), "there should be no duplicate Kid stops");
    });
  });
});

test("history retains Similar selection and skips removed videos", () => {
  withControlledPlayerPlayback(() => {
    withScreenHistoryForTest((navigation) => {
      showScreen(SCREEN.kid);
      openPlayer("AbCdEfGhI_j");
      playSimilarVideo();
      navigation.back();
      navigation.forward();
      assert(currentVideoId === "BbCdEfGhI_j", "Forward should restore the last Similar selection");
      navigation.back();
      state.videos = state.videos.filter((video) => video.id !== "BbCdEfGhI_j");
      navigation.forward();
      navigation.flush();
      assert(screens[SCREEN.kid].classList.contains("active"), "a removed video should return to Kid Mode");
      openPlayer("AbCdEfGhI_j");
      navigation.back();
      navigation.back();
      assert(screens[SCREEN.home].classList.contains("active"), "removed history must not leave duplicate Kid stops");
    });
  });
});

test("history never restores Parent authorization", () => {
  withScreenHistoryForTest((navigation) => {
    openParentUnlock(SCREEN.home);
    els.unlockCode.value = state.settings.unlockCode;
    handleParentUnlock({ preventDefault() {} });
    assert(screens[SCREEN.parent].classList.contains("active"), "valid code should unlock Parent Mode");
    assert(navigation.count() === 2, "unlock success should replace the prompt destination");
    navigation.back();
    navigation.forward();
    assert(screens[SCREEN.unlock].classList.contains("active"), "Forward should require the code again");
    assert(els.unlockCode.value === "", "history must clear the entered code");
    closeParentUnlock();
    navigation.flush();
    assert(screens[SCREEN.home].classList.contains("active"), "Cancel should return to the opening screen");
  });
});

test("player waits for startup speech and replaces Preparing with one iframe", () => {
  withControlledPlayerPlayback((controls) => {
    openPlayer("AbCdEfGhI_j");

    const thumbnail = els.playerFrameWrap.querySelector(".player-preparing-thumbnail");
    assert(controls.getPlayerStartCount() === 0, "playback should wait for title speech");
    assert(els.playerFrameWrap.getAttribute("aria-busy") === "true", "player should be busy while preparing");
    assert(els.playerTitle.textContent === "Trains", "the current video title should label the player");
    assert(document.activeElement === els.playerTitle, "opening a video should focus the Player title");
    assert(thumbnail && thumbnail.src.includes("AbCdEfGhI_j"), "the selected thumbnail should remain visible");
    assert(els.playerFrameWrap.textContent === "Preparing", "Preparing should be visible");
    assert(!els.playerFrameWrap.querySelector("iframe"), "no iframe should exist before speech completes");

    controls.completeSpeech(0);
    controls.fireAllTimers();
    controls.completeSpeech(0);

    assert(controls.getPlayerStartCount() === 1, "playback should start exactly once");
    assert(els.playerFrameWrap.getAttribute("aria-busy") === "false", "player should stop being busy when playback starts");
    assert(!els.playerFrameWrap.querySelector(".player-preparing-thumbnail"), "the thumbnail should leave when playback starts");
    assert(!els.playerFrameWrap.querySelector(".player-preparing-status"), "Preparing should leave when playback starts");
    assert(els.playerFrameWrap.querySelectorAll("iframe").length === 1, "one player iframe should be present");
  });
});

test("player timeout fallback starts playback exactly once", () => {
  withControlledPlayerPlayback((controls) => {
    openPlayer("AbCdEfGhI_j");

    controls.fireNextTimer();
    controls.completeSpeech(0);

    assert(controls.getPlayerStartCount() === 1, "timeout and late speech completion should start once");
    assert(els.playerFrameWrap.querySelectorAll("iframe").length === 1, "timeout should create one iframe");
    assert(els.playerFrameWrap.getAttribute("aria-busy") === "false", "timeout should finish preparation");
  });
});

test("Home invalidates pending playback and removes the player", () => {
  withControlledPlayerPlayback((controls) => {
    openPlayer("AbCdEfGhI_j");

    returnToKidMode();
    controls.fireAllTimers();
    controls.completeSpeech(0);

    assert(controls.getPlayerStartCount() === 0, "Home should prevent delayed playback");
    assert(screens[SCREEN.kid].classList.contains("active"), "Home should return to Kid Mode");
    assert(currentVideoId === null, "Home should clear the current video");
    assert(els.playerFrameWrap.children.length === 0, "Home should leave no iframe or preparation UI");
    assert(els.playerFrameWrap.getAttribute("aria-busy") === "false", "Home should clear the busy state");
    assert(document.activeElement.dataset.videoId === "AbCdEfGhI_j", "Home should focus the originating tile");
  });
});

test("Player Home falls back to the Kid heading when its origin is gone", () => {
  withControlledPlayerPlayback(() => {
    openPlayer("AbCdEfGhI_j");
    state.videos = state.videos.filter((video) => video.id !== "AbCdEfGhI_j");

    returnToKidMode();

    assert(document.activeElement === els.kidTitle, "a missing origin should focus the Kid heading");
  });
});

test("YouTube iframe tab behavior follows the controls setting", () => {
  withControlledPlayerPlayback((controls) => {
    state.settings.youtubeControls = false;
    openPlayer("AbCdEfGhI_j");
    controls.completeSpeech(0);

    const hiddenControlsFrame = els.playerFrameWrap.querySelector("iframe");
    assert(hiddenControlsFrame.tabIndex === -1, "hidden controls should remove the iframe from Tab order");

    returnToKidMode();
    state.settings.youtubeControls = true;
    openPlayer("AbCdEfGhI_j");
    controls.completeSpeech(1);

    const visibleControlsFrame = els.playerFrameWrap.querySelector("iframe");
    assert(!visibleControlsFrame.hasAttribute("tabindex"), "visible controls should keep native iframe Tab behavior");
  });
});

test("rapid Again and Similar actions start only the newest video", () => {
  withControlledPlayerPlayback((controls) => {
    openPlayer("AbCdEfGhI_j");
    playCurrentAgain();
    playSimilarVideo();

    assert(controls.getPlayerStartCount() === 0, "superseded speech should not start playback");
    assert(currentVideoId === "BbCdEfGhI_j", "Similar should select the newest video");
    assert(els.playerTitle.textContent === "More trains", "the newest title should label the player");
    assert(els.playerFrameWrap.querySelector(".player-preparing-thumbnail").src.includes("BbCdEfGhI_j"), "the newest thumbnail should be visible");

    controls.completeSpeech(0);
    controls.completeSpeech(1);
    controls.completeSpeech(2);
    controls.fireAllTimers();

    const iframe = els.playerFrameWrap.querySelector("iframe");
    assert(controls.getPlayerStartCount() === 1, "only the newest request should start playback");
    assert(iframe && iframe.title === "More trains", "the newest video should own the iframe");
    assert(iframe.src.includes("BbCdEfGhI_j"), "the iframe should load the newest video");
  });
});

test("Favorite feedback supersedes pending title speech", () => {
  withControlledPlayerPlayback((controls) => {
    openPlayer("AbCdEfGhI_j");
    toggleCurrentFavorite();

    assert(controls.speechRequests.length === 2, "Favorite should replace title speech with feedback");
    assert(controls.speechRequests[1].text === "favorites", "the latest speech should match Favorite feedback");
    assert(controls.getPlayerStartCount() === 0, "cancelled title speech should not start playback");
    assert(els.playerFrameWrap.getAttribute("aria-busy") === "true", "player should remain busy during feedback");
    assert(els.playerFrameWrap.querySelector(".player-preparing-thumbnail"), "the thumbnail should remain during feedback");
    assert(els.favoriteButton.getAttribute("aria-pressed") === "true", "Favorite state should update immediately");

    controls.completeSpeech(0);
    assert(controls.getPlayerStartCount() === 0, "superseded title completion should remain inert");
    controls.completeSpeech(1);
    controls.fireAllTimers();

    assert(controls.getPlayerStartCount() === 1, "playback should wait for the latest feedback");
    assert(els.playerFrameWrap.querySelectorAll("iframe").length === 1, "latest feedback should create one iframe");
  });
});

test("offline startup shows an app-owned state without an iframe", () => {
  withControlledPlayerPlayback((controls) => {
    controls.setBrowserOnline(false);
    openPlayer("AbCdEfGhI_j");

    assert(els.playerFrameWrap.getAttribute("aria-busy") === "true", "startup should begin in Preparing");
    controls.completeSpeech(0);

    const offlineMessage = els.playerFrameWrap.querySelector(".player-offline-message");
    const thumbnail = els.playerFrameWrap.querySelector(".player-offline-thumbnail");
    assert(controls.getPlayerStartCount() === 0, "offline startup should not create a player");
    assert(!els.playerFrameWrap.querySelector("iframe"), "offline startup should not create an iframe");
    assert(offlineMessage && offlineMessage.textContent.includes("No connection"), "offline state should explain the problem");
    assert(offlineMessage.getAttribute("role") === "status", "offline state should be announced as status");
    assert(thumbnail && thumbnail.src.includes("AbCdEfGhI_j"), "offline state should retain the selected thumbnail");
    assert(els.playerTitle.textContent === "Trains", "offline state should retain the video title");
    assert(els.playerFrameWrap.getAttribute("aria-busy") === "false", "offline state should not remain busy");
    assert(els.playerFrameWrap.getAttribute("aria-describedby") === "playerOfflineMessage", "offline message should describe the player");
    assert(els.favoriteButton.disabled, "Favorites should be unavailable offline");
    assert(els.similarButton.disabled, "Similar should be unavailable offline");
    assert(!els.againButton.disabled, "Again should remain available offline");
  });
});

test("Again while offline keeps the existing calm offline state", () => {
  withControlledPlayerPlayback((controls) => {
    controls.setBrowserOnline(false);
    openPlayer("AbCdEfGhI_j");
    controls.completeSpeech(0);
    const offlineMessage = els.playerFrameWrap.querySelector(".player-offline-message");

    playCurrentAgain();

    assert(controls.speechRequests.length === 1, "offline retry should not add repeated speech");
    assert(els.playerFrameWrap.querySelector(".player-offline-message") === offlineMessage, "offline retry should preserve the announced state");
    assert(!els.playerFrameWrap.querySelector("iframe"), "offline retry should not create an iframe");
    assert(els.playerFrameWrap.getAttribute("aria-busy") === "false", "offline retry should remain settled");
  });
});

test("Again retries normal preparation after connectivity returns", () => {
  withControlledPlayerPlayback((controls) => {
    controls.setBrowserOnline(false);
    openPlayer("AbCdEfGhI_j");
    controls.completeSpeech(0);

    controls.setBrowserOnline(true);
    playCurrentAgain();

    assert(controls.speechRequests[1].text === "again", "online retry should use normal Again speech");
    assert(els.playerFrameWrap.getAttribute("aria-busy") === "true", "online retry should return to Preparing");
    assert(els.playerFrameWrap.querySelector(".player-preparing-status"), "online retry should show Preparing");
    assert(!els.playerFrameWrap.querySelector(".player-offline-message"), "online retry should leave the offline state");
    assert(!els.playerFrameWrap.hasAttribute("aria-describedby"), "online retry should remove offline semantics");
    assert(!els.favoriteButton.disabled, "Favorites should return during an online retry");
    assert(!els.similarButton.disabled, "Similar should return during an online retry");

    controls.completeSpeech(1);

    assert(controls.getPlayerStartCount() === 1, "online retry should create one player");
    assert(els.playerFrameWrap.querySelectorAll("iframe").length === 1, "online retry should create one iframe");
    assert(els.playerFrameWrap.getAttribute("aria-busy") === "false", "playback should finish preparation");
  });
});

test("Home leaves the offline player cleanly", () => {
  withControlledPlayerPlayback((controls) => {
    controls.setBrowserOnline(false);
    openPlayer("AbCdEfGhI_j");
    controls.completeSpeech(0);

    returnToKidMode();
    controls.fireAllTimers();

    assert(screens[SCREEN.kid].classList.contains("active"), "Home should return to Kid Mode");
    assert(currentVideoId === null, "Home should clear the offline video");
    assert(els.playerFrameWrap.children.length === 0, "Home should remove the offline state and any iframe");
    assert(els.playerFrameWrap.getAttribute("aria-busy") === "false", "Home should leave the player settled");
    assert(!els.playerFrameWrap.hasAttribute("aria-describedby"), "Home should remove offline semantics");
  });
});

test("findSimilarVideo picks next shared-tag video", () => {
  const previousState = state;
  try {
    state = normalizeState({
      settings: {},
      videos: [
        { id: "AbCdEfGhI_j", title: "One", tags: "trains" },
        { id: "BbCdEfGhI_j", title: "Two", tags: "music" },
        { id: "CbCdEfGhI_j", title: "Three", tags: "trains, calm" }
      ]
    });
    assert(findSimilarVideo("AbCdEfGhI_j").id === "CbCdEfGhI_j", "shared tag video should be selected");
  } finally {
    state = previousState;
  }
});

test("findSimilarVideo skips favorites", () => {
  const previousState = state;
  try {
    state = normalizeState({
      settings: {},
      videos: [
        { id: "AbCdEfGhI_j", title: "One", tags: "trains" },
        { id: "BbCdEfGhI_j", title: "Two", tags: "trains", favorite: "true" },
        { id: "CbCdEfGhI_j", title: "Three", tags: "trains" }
      ]
    });
    assert(findSimilarVideo("AbCdEfGhI_j").id === "CbCdEfGhI_j", "favorite match should be skipped");
  } finally {
    state = previousState;
  }
});

test("alphabetical Kid grid order does not change saved order", () => {
  const previousState = state;
  try {
    state = normalizeState({
      settings: { videoGridOrder: "alpha" },
      videos: [
        { id: "AbCdEfGhI_j", title: "Zebra" },
        { id: "BbCdEfGhI_j", title: "Apple" }
      ]
    });

    const sortedVideos = getKidGridVideos();

    assert(sortedVideos[0].title === "Apple", "Kid grid should be alphabetical");
    assert(getVideos()[0].title === "Zebra", "saved manual order should remain unchanged");
  } finally {
    state = previousState;
  }
});

// Keep this last: init() installs persistent listeners on the shared fixture.
test("init wires the major Kid, Player, and Parent flows", () => {
  const previousState = state;
  const previousCurrentVideoId = currentVideoId;
  const previousUnlockReturnScreen = unlockReturnScreen;
  const previousEditingVideoId = editingVideoId;
  const previousPlayerStartToken = playerStartToken;
  const previousPendingTimeoutId = pendingPlayerStartTimeoutId;
  const previousPreparationPending = playerPreparationPending;
  const previousPlayerOriginVideoId = playerOriginVideoId;
  const previousPlayerOriginScroll = playerOriginScroll;
  const previousBrowserIsOnline = browserIsOnline;
  const hadOwnRequestFullscreen = Object.prototype.hasOwnProperty.call(
    els.app,
    "requestFullscreen"
  );
  const previousRequestFullscreen = els.app.requestFullscreen;

  try {
    state = normalizeState({
      settings: { audioFeedback: false, unlockCode: "2468" },
      videos: [{ id: "AbCdEfGhI_j", title: "Trains" }]
    });
    currentVideoId = null;
    editingVideoId = null;
    browserIsOnline = () => true;
    els.app.requestFullscreen = () => Promise.resolve();

    init();

    assert(screens[SCREEN.home].classList.contains("active"), "init should show Home");

    els.kidModeButton.click();

    assert(screens[SCREEN.kid].classList.contains("active"), "Kid Mode click should show Kid Mode");
    assert(document.activeElement === els.kidTitle, "Kid Mode click should focus its heading");

    const tile = els.kidVideoGrid.querySelector("[data-video-id=AbCdEfGhI_j]");
    assert(tile, "Kid Mode should render the approved video tile");
    tile.click();

    assert(screens[SCREEN.player].classList.contains("active"), "tile click should show Player");
    assert(currentVideoId === "AbCdEfGhI_j", "tile click should select its video");
    assert(document.activeElement === els.playerTitle, "tile click should focus the Player title");
    assert(els.playerFrameWrap.querySelector("iframe"), "tile click should create the player iframe");

    els.playerHomeButton.click();

    assert(screens[SCREEN.kid].classList.contains("active"), "Player Home should return to Kid Mode");
    assert(currentVideoId === null, "Player Home should clear the current video");
    assert(!els.playerFrameWrap.querySelector("iframe"), "Player Home should remove the iframe");
    assert(document.activeElement.dataset.videoId === "AbCdEfGhI_j", "Player Home should restore tile focus");

    els.kidParentButton.click();
    assert(screens[SCREEN.unlock].classList.contains("active"), "Parent entry should show unlock");
    assert(document.activeElement === els.unlockCode, "Parent entry should focus the code field");

    const unlockSubmitButton = els.unlockForm.querySelector("button[type=submit]");
    els.unlockCode.value = "0000";
    unlockSubmitButton.focus();
    unlockSubmitButton.click();

    assert(screens[SCREEN.unlock].classList.contains("active"), "wrong code should remain on unlock");
    assert(!screens[SCREEN.parent].classList.contains("active"), "wrong code should not open Parent Mode");
    assert(els.unlockMessage.textContent === MESSAGES.unlockFailed, "wrong code should report rejection");
    assert(document.activeElement === els.unlockCode, "wrong code should restore code-field focus");

    els.unlockCode.value = "2468";
    unlockSubmitButton.focus();
    unlockSubmitButton.click();

    assert(screens[SCREEN.parent].classList.contains("active"), "correct code should show Parent Mode");
    assert(document.activeElement === els.parentTitle, "correct code should focus the Parent heading");
  } finally {
    invalidatePendingPlayerStart();
    els.playerFrameWrap.innerHTML = "";
    els.playerFrameWrap.setAttribute("aria-busy", "false");
    els.unlockCode.value = "";
    els.unlockMessage.textContent = "";
    browserIsOnline = previousBrowserIsOnline;
    if (hadOwnRequestFullscreen) {
      els.app.requestFullscreen = previousRequestFullscreen;
    } else {
      delete els.app.requestFullscreen;
    }
    state = previousState;
    currentVideoId = previousCurrentVideoId;
    unlockReturnScreen = previousUnlockReturnScreen;
    editingVideoId = previousEditingVideoId;
    playerStartToken = previousPlayerStartToken;
    pendingPlayerStartTimeoutId = previousPendingTimeoutId;
    playerPreparationPending = previousPreparationPending;
    playerOriginVideoId = previousPlayerOriginVideoId;
    playerOriginScroll = previousPlayerOriginScroll;
    showScreen(SCREEN.home);
  }
});

function runTests() {
  const output = [];
  let failures = 0;

  tests.forEach(({ name, fn }) => {
    try {
      fn();
      output.push(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      output.push(`FAIL ${name}: ${error.message}`);
    }
  });

  results.textContent = output.join("\n");
  if (failures > 0) {
    document.body.style.background = "#ffe9e9";
    throw new Error(`${failures} test(s) failed`);
  }
  document.body.style.background = "#ecfff0";
}

bindParentValidationEvents();
runTests();

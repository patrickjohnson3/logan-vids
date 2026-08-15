"use strict";

const tests = [];
const results = document.getElementById("results");

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function withControlledPlayerPlayback(run) {
  const previousState = state;
  const previousCurrentVideoId = currentVideoId;
  const previousPlayerStartToken = playerStartToken;
  const previousPendingTimeoutId = pendingPlayerStartTimeoutId;
  const previousPreparationPending = playerPreparationPending;
  const previousStartCurrentPlayer = startCurrentPlayer;
  const previousSpeak = speak;
  const previousStopSpeech = stopSpeech;
  const previousBrowserIsOnline = browserIsOnline;
  const previousSetTimeout = window.setTimeout;
  const previousClearTimeout = window.clearTimeout;
  const previousScreen = getActiveScreenName();
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
    els.playerFrameWrap.innerHTML = "";
    els.playerFrameWrap.setAttribute("aria-busy", "false");
    els.playerFrameWrap.removeAttribute("aria-describedby");
    els.playerTitle.textContent = "Player";
    showScreen(previousScreen);
  }
}

test("parseYouTubeUrl strips share and playlist params", () => {
  const result = parseYouTubeUrl("https://youtu.be/AbCdEfGhI_j?si=track&list=ignored");
  assert(result.ok, result.message);
  assert(result.id === "AbCdEfGhI_j", "video ID should be parsed");
  assert(result.canonicalUrl === "https://www.youtube.com/watch?v=AbCdEfGhI_j", "URL should be canonical");
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

test("newer stored schemas block persistence", () => {
  const previousStorageWriteBlocked = storageWriteBlocked;
  const previousStorageWarning = storageWarning;
  try {
    storageWriteBlocked = hasFutureSchemaVersion({
      schemaVersion: CURRENT_SCHEMA_VERSION + 1
    });
    storageWarning = "";

    assert(!persistState(), "newer saved state should not be overwritten");
    assert(storageWarning === MESSAGES.storageNewer, "a recovery warning should be available");
  } finally {
    storageWriteBlocked = previousStorageWriteBlocked;
    storageWarning = previousStorageWarning;
  }
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

    moveVideo(0, 1);

    assert(els.settingCode.value === "9876", "video actions should not reset unsaved settings");
  } finally {
    state = previousState;
    editingVideoId = previousEditingVideoId;
    renderParent();
  }
});

test("player waits for startup speech and replaces Preparing with one iframe", () => {
  withControlledPlayerPlayback((controls) => {
    openPlayer("AbCdEfGhI_j");

    const thumbnail = els.playerFrameWrap.querySelector(".player-preparing-thumbnail");
    assert(controls.getPlayerStartCount() === 0, "playback should wait for title speech");
    assert(els.playerFrameWrap.getAttribute("aria-busy") === "true", "player should be busy while preparing");
    assert(els.playerTitle.textContent === "Trains", "the current video title should label the player");
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

runTests();

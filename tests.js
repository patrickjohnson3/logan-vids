"use strict";

const tests = [];
const results = document.getElementById("results");

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

test("parseYouTubeUrl strips share and playlist params", () => {
  const result = parseYouTubeUrl("https://youtu.be/AbCdEfGhI_j?si=track&list=ignored");
  assert(result.ok, result.message);
  assert(result.id === "AbCdEfGhI_j", "video ID should be parsed");
  assert(result.canonicalUrl === "https://www.youtube.com/watch?v=AbCdEfGhI_j", "URL should be canonical");
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

test("writeRepeatToml round trips tags", () => {
  const text = writeRepeatToml(normalizeState({
    settings: {},
    videos: [{
      id: "AbCdEfGhI_j",
      title: "Trains",
      tags: "trains, calm",
      youtubeUrl: "https://youtu.be/AbCdEfGhI_j",
      favorite: "true"
    }]
  }));
  assert(text.includes('tags = "trains, calm"'), "tags should export");
  assert(text.includes('favorite = "true"'), "favorite should export");
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

test("Again stops the current player before speech", () => {
  const previousCurrentVideoId = currentVideoId;
  const previousStartPlayerAfterSpeech = startPlayerAfterSpeech;
  let observedEmptyPlayer = false;
  try {
    currentVideoId = "AbCdEfGhI_j";
    els.playerFrameWrap.append(document.createElement("iframe"));
    startPlayerAfterSpeech = (text, videoId) => {
      observedEmptyPlayer = els.playerFrameWrap.children.length === 0;
      assert(text === "again", "Again should speak its label");
      assert(videoId === currentVideoId, "Again should restart the current video");
    };

    playCurrentAgain();

    assert(observedEmptyPlayer, "Again should stop video audio before speech");
  } finally {
    startPlayerAfterSpeech = previousStartPlayerAfterSpeech;
    currentVideoId = previousCurrentVideoId;
    els.playerFrameWrap.innerHTML = "";
  }
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

"use strict";

// Player lifecycle.

let playerStartToken = 0;
let pendingPlayerStartTimeoutId = null;
let playerPreparationPending = false;

function openPlayer(id) {
  const video = findVideo(id);
  if (!video) return;

  currentVideoId = video.id;
  renderPlayerControls(video);
  renderPlayerPreparing(video);
  showScreen(SCREEN.player);

  // Wait for the tile label before starting the video, so the two audio cues do not compete.
  startPlayerAfterSpeech(video.title, video.id);
}

function startCurrentPlayer(autoplay) {
  const video = findVideo(currentVideoId);
  if (!video) {
    leavePlayer();
    return;
  }

  if (!browserIsOnline()) {
    renderPlayerOffline(video);
    return;
  }

  els.playerFrameWrap.innerHTML = "";
  els.playerFrameWrap.setAttribute("aria-busy", "false");
  els.playerFrameWrap.removeAttribute("aria-describedby");
  els.playerTitle.textContent = video.title;
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
    state.settings.youtubeControls
  );
  els.playerFrameWrap.append(iframe);
}

function renderPlayer() {
  const video = findVideo(currentVideoId);
  renderPlayerControls(video);
  if (video) els.playerTitle.textContent = video.title;
}

function toggleCurrentFavorite() {
  const video = findVideo(currentVideoId);
  if (!video) return;
  const isFavorite = isFavoriteVideo(video);
  setVideoFavorite(currentVideoId, !isFavorite);
  renderPlayerControls(findVideo(currentVideoId));
  const feedback = isFavorite ? "remove" : "favorites";
  if (playerPreparationPending) {
    startPlayerAfterSpeech(feedback, video.id);
  } else {
    speak(feedback);
  }
}

function renderPlayerControls(video) {
  const isFavorite = isFavoriteVideo(video);
  const label = isFavorite ? "Remove" : "Favorites";
  const similarVideo = video ? findSimilarVideo(video.id) : null;
  els.favoriteButton.disabled = !video;
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
  renderPlayerControls(nextVideo);
  renderPlayerPreparing(nextVideo);
  startPlayerAfterSpeech(nextVideo.title, nextVideo.id);
}

function playCurrentAgain() {
  const video = findVideo(currentVideoId);
  if (!video) return;

  if (!browserIsOnline()) {
    invalidatePendingPlayerStart();
    stopSpeech();
    renderPlayerOffline(video);
    return;
  }

  renderPlayerControls(video);
  renderPlayerPreparing(video);
  startPlayerAfterSpeech("again", currentVideoId);
}

function startPlayerAfterSpeech(text, videoId) {
  invalidatePendingPlayerStart();
  const playbackToken = playerStartToken;
  playerPreparationPending = true;
  els.playerFrameWrap.setAttribute("aria-busy", "true");

  const startPlayer = once(() => {
    if (
      playbackToken === playerStartToken &&
      currentVideoId === videoId &&
      screens[SCREEN.player].classList.contains("active")
    ) {
      playerPreparationPending = false;
      pendingPlayerStartTimeoutId = null;
      startCurrentPlayer(true);
    }
  });

  // Some mobile speech engines never emit end/error; do not strand the child in preparation.
  const timeoutId = window.setTimeout(startPlayer, estimateSpeechTimeout(text));
  pendingPlayerStartTimeoutId = timeoutId;
  speak(text, () => {
    window.clearTimeout(timeoutId);
    startPlayer();
  });
}

function renderPlayerPreparing(video) {
  els.playerTitle.textContent = video.title;
  els.playerFrameWrap.innerHTML = "";
  els.playerFrameWrap.setAttribute("aria-busy", "true");
  els.playerFrameWrap.removeAttribute("aria-describedby");

  const thumbnail = document.createElement("img");
  thumbnail.className = "player-state-thumbnail player-preparing-thumbnail";
  thumbnail.src = buildThumbnailUrl(video.id);
  thumbnail.alt = "";
  thumbnail.referrerPolicy = "no-referrer";

  const status = document.createElement("p");
  status.className = "player-preparing-status";
  status.setAttribute("role", "status");
  status.textContent = "Preparing";

  els.playerFrameWrap.append(thumbnail, status);
}

function renderPlayerOffline(video) {
  playerPreparationPending = false;
  els.playerTitle.textContent = video.title;
  els.playerFrameWrap.setAttribute("aria-busy", "false");
  els.playerFrameWrap.setAttribute("aria-describedby", "playerOfflineMessage");
  els.favoriteButton.disabled = true;
  els.similarButton.disabled = true;
  els.againButton.disabled = false;

  // Keep the existing state in place so repeated offline retries are not re-announced.
  if (els.playerFrameWrap.querySelector(".player-offline-message")) return;

  els.playerFrameWrap.innerHTML = "";
  const thumbnail = document.createElement("img");
  thumbnail.className = "player-state-thumbnail player-offline-thumbnail";
  thumbnail.src = buildThumbnailUrl(video.id);
  thumbnail.alt = "";
  thumbnail.referrerPolicy = "no-referrer";

  const message = document.createElement("p");
  message.id = "playerOfflineMessage";
  message.className = "player-offline-message";
  message.setAttribute("role", "status");
  message.textContent = "No connection. This video cannot play right now.";

  els.playerFrameWrap.append(thumbnail, message);
}

function browserIsOnline() {
  return navigator.onLine !== false;
}

function invalidatePendingPlayerStart() {
  playerStartToken += 1;
  if (pendingPlayerStartTimeoutId !== null) {
    window.clearTimeout(pendingPlayerStartTimeoutId);
    pendingPlayerStartTimeoutId = null;
  }
  playerPreparationPending = false;
}

function leavePlayer() {
  invalidatePendingPlayerStart();
  stopSpeech();
  els.playerFrameWrap.innerHTML = "";
  els.playerFrameWrap.setAttribute("aria-busy", "false");
  els.playerFrameWrap.removeAttribute("aria-describedby");
  els.playerTitle.textContent = "Player";
  currentVideoId = null;
  showScreen(SCREEN.kid);
}

function returnToKidMode() {
  leavePlayer();
}

"use strict";

// Player lifecycle.

function openPlayer(id) {
  const video = findVideo(id);
  if (!video) return;

  currentVideoId = video.id;
  showScreen(SCREEN.player);
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

function renderPlayer() {
  renderPlayerControls(findVideo(currentVideoId));
}

function toggleCurrentFavorite() {
  const video = findVideo(currentVideoId);
  if (!video) return;
  const isFavorite = isFavoriteVideo(video);
  setVideoFavorite(currentVideoId, !isFavorite);
  renderPlayerControls(findVideo(currentVideoId));
  speak(isFavorite ? "remove" : "favorites");
}

function renderPlayerControls(video) {
  const isFavorite = isFavoriteVideo(video);
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
      screens[SCREEN.player].classList.contains("active")
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

function leavePlayer() {
  els.playerFrameWrap.innerHTML = "";
  currentVideoId = null;
  showScreen(SCREEN.kid);
}

function returnToKidMode() {
  leavePlayer();
}

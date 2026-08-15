"use strict";

// Kid mode rendering.

function renderKid() {
  els.favoritesRow.innerHTML = "";
  els.kidVideoGrid.innerHTML = "";

  const favorites = getFavorites();
  const approvedVideos = getKidGridVideos();
  els.favoritesSection.hidden = favorites.length === 0;
  els.emptyKidMessage.hidden = getVideoCount() > 0;

  favorites.forEach((video) => els.favoritesRow.append(makeVideoTile(video)));
  approvedVideos.forEach((video) => els.kidVideoGrid.append(makeVideoTile(video)));
}

function getKidGridVideos() {
  const videos = getNonFavoriteVideos();
  if (state.settings.videoGridOrder !== "alpha") return videos;

  return videos.slice().sort((first, second) =>
    first.title.localeCompare(second.title, undefined, { sensitivity: "base" })
  );
}

function makeVideoTile(video) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "video-tile";
  button.dataset.videoId = video.id;
  button.setAttribute(
    "aria-label",
    isFavoriteVideo(video) ? `${video.title}, favorite` : video.title
  );

  const thumbnail = document.createElement("img");
  thumbnail.className = "video-thumbnail";
  thumbnail.src = buildThumbnailUrl(video.id);
  thumbnail.alt = "";
  thumbnail.referrerPolicy = "no-referrer";
  thumbnail.addEventListener("error", () => thumbnail.classList.add("unavailable"));

  const title = document.createElement("span");
  title.className = "tile-title";
  title.textContent = video.title;

  button.append(thumbnail, title);
  if (isFavoriteVideo(video)) {
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

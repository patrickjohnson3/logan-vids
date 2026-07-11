"use strict";

// Kid mode rendering.

function renderKid() {
  els.favoritesRow.innerHTML = "";
  els.kidVideoGrid.innerHTML = "";

  const favorites = state.videos.filter((video) => video.favorite === "true");
  const approvedVideos = getKidGridVideos();
  els.favoritesSection.hidden = favorites.length === 0;
  els.emptyKidMessage.hidden = state.videos.length > 0;

  favorites.forEach((video) => els.favoritesRow.append(makeVideoTile(video)));
  approvedVideos.forEach((video) => els.kidVideoGrid.append(makeVideoTile(video)));
}

function getKidGridVideos() {
  const videos = state.videos.filter((video) => video.favorite !== "true");
  if (state.settings.videoGridOrder !== "alpha") return videos;

  return videos.slice().sort((first, second) =>
    first.title.localeCompare(second.title, undefined, { sensitivity: "base" })
  );
}

function makeSmallButton(label, onClick, disabled, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = disabled;
  if (className) button.classList.add(className);
  button.addEventListener("click", onClick);
  return button;
}

function makeVideoTile(video) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "video-tile";
  button.setAttribute(
    "aria-label",
    video.favorite === "true" ? `${video.title}, favorite` : video.title
  );

  const thumbnail = document.createElement("img");
  thumbnail.className = "video-thumbnail";
  thumbnail.src = `https://i.ytimg.com/vi/${encodeURIComponent(video.id)}/hqdefault.jpg`;
  thumbnail.alt = "";
  thumbnail.referrerPolicy = "no-referrer";
  thumbnail.addEventListener("error", () => thumbnail.classList.add("unavailable"));

  const title = document.createElement("span");
  title.className = "tile-title";
  title.textContent = video.title;

  button.append(thumbnail, title);
  if (video.favorite === "true") {
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

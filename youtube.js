"use strict";

// YouTube URL parsing and embed URL helpers.

function parseYouTubeUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, message: "Use a full YouTube watch or youtu.be video URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, message: "Use an HTTP or HTTPS YouTube URL." };
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname;

  if (path.startsWith("/shorts/")) {
    return { ok: false, message: "Shorts are not supported." };
  }

  if (path.startsWith("/channel/") || path.startsWith("/c/") || path.startsWith("/@") || path.startsWith("/user/")) {
    return { ok: false, message: "Channels are not supported." };
  }

  if (path.startsWith("/live/") || url.searchParams.get("live") === "1") {
    return { ok: false, message: "Livestream URLs are not supported." };
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (path !== "/watch") {
      return { ok: false, message: "Only individual YouTube watch URLs are supported." };
    }
    const id = url.searchParams.get("v");
    if (!id && url.searchParams.has("list")) {
      return { ok: false, message: "Playlist URLs are not supported." };
    }
    return validateVideoId(id);
  }

  if (host === "youtu.be") {
    const id = path.split("/").filter(Boolean)[0];
    return validateVideoId(id);
  }

  return { ok: false, message: "Use a YouTube watch URL or youtu.be URL." };
}

function validateVideoId(id) {
  if (!isValidVideoId(id)) {
    return { ok: false, message: "That YouTube video ID does not look valid." };
  }
  return { ok: true, id, canonicalUrl: buildCanonicalWatchUrl(id) };
}

function isValidVideoId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id);
}

function buildCanonicalWatchUrl(id) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}

function buildThumbnailUrl(id) {
  return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
}

function normalizeStoredYouTubeUrl(video) {
  const parsedUrl = parseYouTubeUrl(video.youtubeUrl || "");
  if (parsedUrl.ok && parsedUrl.id === video.id) return parsedUrl.canonicalUrl;
  return buildCanonicalWatchUrl(video.id);
}

function buildEmbedUrl(id, autoplay = false, controlsEnabled = true) {
  const params = new URLSearchParams({
    rel: "0",
    playsinline: "1",
    controls: controlsEnabled ? "1" : "0",
    loop: "1",
    playlist: id
  });

  if (!controlsEnabled) {
    params.set("disablekb", "1");
  }

  if (autoplay) {
    params.set("autoplay", "1");
  }

  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

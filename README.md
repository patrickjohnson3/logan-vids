# Repeat

Repeat is a calm, local-first media player for nonverbal and autistic children. It is designed as a predictable, parent-curated video library rather than a social platform, recommendation feed, or general YouTube browser.

The app is a static site: no framework, package manager, account, backend, cloud sync, analytics, or build step is required.

## Run locally

Open `index.html` directly in a browser, or serve the directory:

```bash
python3 -m http.server 8000
```

Then open <http://127.0.0.1:8000>.

For normal video playback and thumbnails, the device needs network access to YouTube.

## Parent workflow

1. From the opening screen, select **Parent mode**.
2. Enter the default unlock code: `2468`.
3. Add a title and an individual YouTube video URL.
4. Use **Up**, **Down**, and **Delete** to curate the stable Kid Mode grid.
5. Adjust the unlock code, speech feedback, speech rate, and theme in Settings.

Kid Mode has a small **Parent** button. It opens the code prompt; it does not exit Kid Mode directly. Cancelling that prompt returns to Kid Mode.

If the unlock code is forgotten, clearing this site's browser data resets the app to the default code, but also removes every saved video, favorite, and setting.

## Kid Mode

- Videos appear in a stable grid with YouTube thumbnails and text labels.
- Tapping a tile speaks its title, then starts the selected video.
- **Again** speaks “again”, then restarts the same video.
- **Keep** adds a video to favorites. The control becomes **Remove** when it is already favorited.
- Favorites remain at the top of Kid Mode in their saved order.
- Every approved video is configured to loop, avoiding YouTube end-screen recommendations.

## YouTube URLs

Only individual videos are accepted:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`

The app rejects channels, playlists, Shorts, and livestream URLs. It converts accepted URLs into `youtube-nocookie.com` embeds.

The player iframe is sandboxed and has no fullscreen, sharing, clipboard, Picture-in-Picture, popup, or top-level-navigation permission. This reduces exposure to YouTube, but it cannot turn a remote YouTube embed into a complete kiosk. Use Android app pinning or kiosk controls when stricter device-level containment is required.

## Data and TOML

Runtime state is stored only in browser `localStorage` under `repeat.runtimeState.v1`. TOML is the portable format for parent-managed backup and transfer.

In Parent Mode, use the TOML area to import, copy, or download `safe-loop-config.toml`. The parser deliberately supports only:

- `[settings]`
- `[[videos]]`
- quoted string values
- blank lines and full-line comments beginning with `#`

Example:

```toml
# Repeat configuration
[settings]
unlockCode = "2468"
audioFeedback = "true"
speechRate = "0.9"
theme = "dark"

[[videos]]
title = "Example video"
url = "https://www.youtube.com/watch?v=AbCdEfGhI_j"
favorite = "false"
```

Malformed TOML, unsupported keys, duplicate YouTube videos, and unsupported YouTube URLs are rejected with a parent-facing message. Exported TOML always reflects the currently saved local state.

## Project structure

- `index.html`: semantic app screens and controls
- `style.css`: mobile-first visual design and responsive layout
- `app.js`: screen behavior, local storage, TOML parsing/writing, speech feedback, URL validation, and player setup

## Quick checks

No dependencies are needed. To check JavaScript syntax:

```bash
node --check app.js
```

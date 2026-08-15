# Repeat

Repeat is a calm, local-first media player for nonverbal and autistic children. It is designed as a predictable, parent-curated video library rather than a social platform, recommendation feed, or general YouTube browser.

The app is a static site: no framework, package manager, account, backend, cloud sync, analytics, or build step is required.

## Live Demo

[patrickjohnson3.github.io/logan-vids/](https://patrickjohnson3.github.io/logan-vids/)

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
4. Use **Edit**, **Up**, **Down**, and **Delete** to curate the stable Kid Mode grid.
5. Adjust the unlock code, speech feedback, YouTube controls, speech rate, and theme in Settings.

Kid Mode has a small lock button for Parent Mode. It opens the code prompt; it does not exit Kid Mode directly. Cancelling that prompt returns to Kid Mode.

If the unlock code is forgotten, clearing this site's browser data resets the app to the default code, but also removes every saved video, favorite, and setting.

## Kid Mode

- Videos appear in a stable grid with YouTube thumbnails and text labels.
- Tapping a tile speaks its title, then starts the selected video.
- **Again** speaks “again”, then restarts the same video.
- **Favorites** adds a video to favorites. The control becomes **Remove** when it is already favorited.
- **Similar** selects the next saved video with at least one matching parent tag, then speaks its title before playback.
- Favorites remain at the top of Kid Mode in their saved order and do not repeat in the video grid.
- Every approved video is configured to loop, avoiding YouTube end-screen recommendations.
- If the browser reports no connection, the player keeps the selected thumbnail and leaves **Home** and **Again** available without opening YouTube.

## YouTube URLs

Input URLs must use HTTP or HTTPS. Only individual videos are accepted:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`

The app locally rejects channels, playlist-only URLs, Shorts, and recognized livestream URL forms such as `/live/` or `live=1`. It does not query remote metadata, so a livestream presented as a normal watch URL cannot be identified. Accepted videos are converted into `youtube-nocookie.com` embeds.
Accepted HTTP and HTTPS input URLs are saved as clean canonical HTTPS watch URLs, so tracking parameters such as `si=...` and appended playlist parameters are stripped.

The player iframe is sandboxed and has no fullscreen, sharing, clipboard, Picture-in-Picture, popup, or top-level-navigation permission. This reduces exposure to YouTube, but it cannot turn a remote YouTube embed into a complete kiosk. Use Android app pinning or kiosk controls when stricter device-level containment is required.

## Data and TOML

Runtime state is stored only in browser `localStorage` under `repeat.runtimeState.v1`. TOML is the portable format for parent-managed backup and transfer.

If saved browser data comes from a newer schema version, Repeat keeps the original `localStorage` entry unchanged and shows a Parent Mode warning. Importing a compatible TOML file explicitly replaces that state.

In Parent Mode, use the TOML area to upload a TOML file or download `safe-loop-config.toml`. The parser deliberately supports only:

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
youtubeControls = "false"
speechRate = "0.9"
theme = "dark"
videoGridOrder = "manual"

[[videos]]
title = "Example video"
tags = "trains, calm"
url = "https://www.youtube.com/watch?v=AbCdEfGhI_j"
favorite = "false"
```

For backward compatibility, a legacy `continuousLoop` setting and legacy video `icon` values are accepted but ignored. Malformed TOML, other unsupported keys, overlong tags, duplicate YouTube videos, and unsupported YouTube URLs are rejected with a parent-facing message.

Downloaded TOML reflects the current in-memory state. During normal operation this matches `localStorage`; when storage is unavailable or writes are blocked for a newer schema, the download can include session changes that have not replaced the saved browser data.

## Project structure

- `index.html`: semantic app screens and controls
- `style.css`: mobile-first visual design and responsive layout
- `app.js`: startup, DOM lookup, screen changes, and parent actions
- `state.js`: localStorage persistence, runtime state normalization, settings validation, tags, favorites, and video lookup helpers
- `toml.js`: TOML upload/download, parsing, and writing
- `youtube.js`: YouTube URL validation, canonical watch URLs, thumbnails, and embed URLs
- `speech.js`: speech synthesis and speech cancellation helpers
- `render-parent.js`: Parent Mode rendering
- `render-kid.js`: Kid Mode rendering
- `player.js`: player lifecycle and player controls
- `tests.html` and `tests.js`: no-framework browser helper tests
- `TODO.md`: focused cleanup and target-device verification backlog

## Script conventions

Repeat uses classic `<script>` files instead of ES modules so it can run directly from `file://` as well as from a static server. Because classic scripts share one page scope, new helpers must use file-specific names or live inside an existing file boundary. Do not add duplicate top-level function or constant names across scripts.

## Formatting and linting

This project intentionally has no npm dependency, formatter, linter, or build step. Follow the existing style when editing:

- 2-space indentation
- semicolons
- double quotes in JavaScript
- readable plain functions
- no framework-style architecture
- ASCII text unless the UI intentionally needs a symbol or emoji

Prettier is reasonable as an editor-only tool if it is not added as a project dependency and does not create broad formatting-only churn. ESLint is not recommended yet because it would introduce npm configuration and maintenance overhead into a dependency-free app. Reconsider ESLint only if the project accepts dev dependencies or starts accumulating enough JavaScript risk to justify a local lint command.

## Quick checks

No dependencies are needed. To check JavaScript syntax:

```bash
node --check app.js
node --check state.js
node --check toml.js
node --check youtube.js
node --check speech.js
node --check render-parent.js
node --check render-kid.js
node --check player.js
node --check tests.js
```

To run the no-framework browser helper tests, open `tests.html` directly in a browser or from the local static server. A passing run shows a green page with only `PASS` lines.

## Manual browser checks

Automated browser tests do not prove audible autoplay, speech completion, YouTube iframe behavior, fullscreen, or responsive layout. Before sharing a build, verify these flows in Android Chrome on the target device and record significant device-specific results in `TODO.md`:

1. Open `tests.html` and confirm all helper tests pass.
2. Enter Kid Mode and confirm fullscreen starts; open Parent Mode and confirm fullscreen exits.
3. Add valid watch URLs with tags, then confirm thumbnails, speech prompts, autoplay, Again, Similar, and Home controls work.
4. Toggle Favorites/Remove and confirm the favorite row updates after returning to Kid Mode.
5. Switch Video grid order between Manual and A to Z, then confirm Kid Mode reflects the selected order.
6. Import a valid TOML file, cancel the replacement warning once, then confirm a second import replaces settings, videos, favorites, and tags.
7. Import TOML with a duplicate key, invalid setting, invalid URL, invalid favorite value, overlong title, and overlong tags; each must show an error without changing saved data.
8. Download and upload `safe-loop-config.toml`, then confirm the configuration round-trips correctly.

# Repeat Contributor Guidance

This file applies to the entire repository. The project is flat and its test page
loads the same source files as the application, so no nested `AGENTS.md` is needed.

## Product Priorities

- Repeat is a calm, parent-curated media player for a nonverbal autistic child.
  Preserve familiar workflows, forgiving interaction, large targets, stable
  placement, and low sensory load ahead of architectural novelty.
- Treat the app as a kiosk-like appliance, not a general YouTube client. Do not add
  feeds, remote recommendations, channels, playlists, Shorts, livestreams, social
  features, ads of our own, accounts, analytics, notifications, or gamification.
- "Similar" may choose only another parent-approved local video by shared tags. It
  must not query a remote recommendation service and must continue to skip favorites.
- Keep the app usable as static files with no framework, npm dependency, build step,
  backend, account, cloud sync, or analytics service. Do not add a CDN dependency.
- The shared classic-script globals are a deliberate constraint, not a standing
  refactor target. Do not introduce modules, dependency injection, a build system, or
  new architectural layers solely to make the dependency graph look cleaner.
- Kid Mode behavior is the highest-risk product surface. Avoid hidden gestures,
  surprise navigation, flashing, autoplay chains, dynamic tile reordering, and
  controls that expose normal YouTube browsing.
- Prioritize validation on Logan's actual Android device over internal cleanup when a
  change touches autoplay, speech, fullscreen, orientation, storage, or the iframe.

## Repository Map and Ownership

- `index.html` owns screen markup, required element IDs, classic-script load order,
  the iframe/image Content Security Policy, and accessible labels.
- `style.css` owns the mobile-first theme, 72 px baseline touch targets, fullscreen
  behavior, and portrait/landscape layouts. Keep coarse-pointer landscape rules from
  changing desktop Chrome layouts.
- `youtube.js` is the only owner of accepted YouTube URL forms, canonical watch URLs,
  thumbnail URLs, and `youtube-nocookie.com` embed URLs.
- `state.js` owns defaults, schema migration, normalization, validation, video/tag/
  favorite lookup, and `localStorage` persistence.
- `toml.js` owns the deliberately limited TOML file parser/writer and upload/download
  flow. It may use state and YouTube normalization; do not introduce a general TOML
  dependency.
- `speech.js` owns speech synthesis, cancellation, and fallback timing.
- `render-parent.js` and `render-kid.js` build their respective dynamic DOM. Keep
  state mutation in the state/action helpers rather than in render functions.
- `player.js` owns iframe lifecycle, delayed autoplay, looping, and player controls.
- `app.js` loads last and owns startup, required DOM lookup, screen transitions,
  event wiring, and parent actions.
- `tests.html` is a DOM fixture and browser test runner; `tests.js` contains the
  no-framework helper/regression tests. `README.md` is the authoritative user and
  operator documentation.
- `validate-structure.js` checks required startup IDs in both HTML files and enforces
  their classic-script load order using Node built-ins only.
- `TODO.md` tracks concrete cleanup and target-device verification. Keep it scoped;
  architecture modernization is not an implicit TODO.

All application scripts loaded by the HTML pages are classic scripts so the app works
from `file://`. They share one global scope and depend on the order in `index.html`
and `tests.html`. Use unique, concern-specific top-level names. When adding or moving
a script, preserve dependency order in both HTML files. When adding a required element
ID, update `getElements()` and the matching `tests.html` fixture together.

## Runtime and Data Invariants

- Supported use is direct opening of `index.html` or a simple static server, with
  Android Chrome as the primary target. Parent Mode remains non-fullscreen; entering
  Kid Mode requests fullscreen. Fullscreen rejection must remain non-fatal.
- Browser state lives only at `localStorage["repeat.runtimeState.v1"]`. Do not rename
  that key or change the state shape without a migration that preserves existing
  libraries, settings, ordering, tags, and favorites.
- Runtime settings are typed booleans/numbers, while TOML values and the stored
  `favorite` field use strings. Normalize data at storage/import boundaries rather
  than spreading ad hoc coercion through UI code.
- Defaults are part of compatibility: unlock code `2468`, audio feedback on,
  YouTube controls off, speech rate `0.9`, dark theme, and manual grid order. A TOML
  file missing a setting receives the corresponding current default.
- TOML is the portable backup format. Keep support limited to `[settings]`,
  `[[videos]]`, quoted strings, blank lines, and full-line `#` comments unless the
  product requirements explicitly change. Validate the entire import before state
  replacement, warn that import replaces all existing state, and leave state intact
  on parse failure or cancelled confirmation.
- Mutations that should persist must go through `updateState()`, `replaceState()`, or
  a state helper and must not claim success when `localStorage` throws. Preserve the
  session-only fallback and parent-facing storage warning.
- Do not commit `safe-loop-config.toml`, real saved video libraries, or real unlock
  codes. These are user-owned local data, not repository fixtures or generated source.

When changing defaults, settings, video fields, or schema versions, update state
normalization/migration, TOML read and write behavior, Parent Mode controls, tests,
and the README example as applicable.

## Media and Security Boundaries

- Accept only individual `youtube.com/watch?v=...` and `youtu.be/...` URLs. Continue
  rejecting channels, playlist-only URLs, Shorts, and recognized livestream URL
  forms; strip tracking and appended playlist parameters by storing the canonical
  watch URL. Without remote metadata, a normal watch URL cannot be classified as live.
- Remote media is limited to thumbnails from `https://i.ytimg.com` and sandboxed
  players from `https://www.youtube-nocookie.com`. Keep the CSP aligned with those
  minimum origins and do not weaken `connect-src`, `object-src`, `base-uri`, or
  `form-action` to solve unrelated problems.
- Preserve the iframe sandbox and minimal `allow` value in `player.js`. Do not grant
  fullscreen, popups, top navigation, clipboard, sharing, or Picture-in-Picture
  without an explicit product decision and corresponding documentation.
- The numeric Parent Mode code is local interaction friction, not strong
  authentication. Do not send it over the network, log it, or present it as a
  security boundary.
- Build dynamic UI with DOM APIs and `textContent`. Do not insert parent-provided
  titles or tags through HTML parsing.

## Interaction Invariants

- Favorites stay persistently visible at the top of Kid Mode and do not also appear
  in the main grid. Hide the Favorites section when empty.
- Manual order follows saved order. Alphabetical order is opt-in and must sort a copy
  rather than mutate the parent's saved order.
- Tapping a tile or Similar speaks the selected title before autoplay. Again speaks
  "again" before restarting. Keep the timeout fallback because some mobile speech
  engines never fire completion events, and cancel pending speech/playback when
  leaving the player.
- Keep child-facing controls at stable positions with clear visible labels and
  feedback. Preserve at least 72 px general touch targets; the intentionally subdued
  Parent Mode entry and compact player Home control are exceptions.
- Loop only the current approved video. Returning Home must remove the iframe and
  return to Kid Mode without exposing YouTube navigation.

## Code Conventions

- Use 2-space indentation, semicolons, and double quotes in JavaScript. Keep
  `"use strict"` in classic script files.
- Prefer short plain functions and the existing concern-based files. Do not introduce
  classes, framework-style architecture, or a generalized abstraction without a
  concrete need in the current code.
- Keep source readable and unbundled. Add comments only around behavior whose reason
  is not obvious, especially accessibility, browser fallbacks, and containment.
- Use ASCII in source unless visible UI intentionally needs a symbol or emoji.
- Do not run broad formatter-only rewrites. There is intentionally no repository
  formatter, linter, type checker, package manager, or packaging command.

## Development and Validation

No setup or build is required. For HTTP testing, run:

```bash
python3 -m http.server 8000
```

Before considering a JavaScript change complete, run syntax checks for every script
changed. For repository-wide or cross-file changes, run the complete set:

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
node --check validate-structure.js
```

Run `node validate-structure.js` after changing required element IDs, `getElements()`,
or script tags in either HTML file.

Open `tests.html` directly or through the static server and require a green page with
only `PASS` lines. Add or update tests when changing pure URL, state, migration, tag,
similar-video, or TOML behavior. Keep `window.REPEAT_TEST_MODE` behavior free of real
`localStorage` writes.

Run the relevant flows in README's **Manual browser checks** after user-visible work.
In particular:

- test Kid Mode and player changes in Android Chrome portrait and landscape;
- test responsive landscape CSS in desktop Chrome as well as a coarse-pointer device;
- test speech/autoplay changes with feedback both enabled and disabled;
- test persistence/TOML changes with success, cancellation, malformed input, and
  unavailable-storage paths; and
- test any CSP, iframe, or URL change with a real approved video and thumbnail.

The automated browser tests do not establish autoplay permission, audible speech,
YouTube overlay/end-screen behavior, fullscreen reliability, or Android layout.
Treat the matching checks in `TODO.md` as evidence that must come from the target
device, not as facts implied by passing tests.

If a required browser/device check cannot be run, report that gap instead of treating
syntax checks as full validation.

## Change Hygiene

- Keep changes focused and preserve unrelated user work. Do not commit generated
  browser profiles, downloaded TOML, local server output, or editor state.
- Update `README.md` when user-visible behavior, supported URLs/platforms, persistence,
  TOML format, defaults, run commands, or the file layout changes.
- When asked to commit, follow the existing history: one focused change per commit
  with a short imperative subject. Do not create commits unless requested.

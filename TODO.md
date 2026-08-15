# Repeat TODO

This list is intentionally narrow. Complete items as small, independent changes and
preserve the existing static, dependency-free architecture.

## Target-Device Verification

These checks matter more than internal cleanup for Kid Mode reliability. Record the
device model, Android version, Chrome version, launch mode, date, and result when a
check is completed or when browser behavior changes.

- [ ] On a fresh Chrome profile with YouTube controls off, verify that a tile starts
  playback after speech with audio feedback both on and off.
- [ ] Verify normal speech completion and the timeout fallback with short and
  maximum-length titles. During speech, exercise Again and Home repeatedly and confirm
  that no stale iframe starts afterward.
- [ ] Verify Kid Mode fullscreen entry, the Parent Mode unlock while remaining
  fullscreen, Parent Mode fullscreen exit, and return paths after fullscreen
  permission is denied.
- [ ] Verify Kid Home and Player layouts in portrait and landscape without clipped or
  unreachable child controls. Repeat the landscape check in desktop Chrome to ensure
  coarse-pointer rules do not activate there.
- [ ] Observe real YouTube playback with controls both off and on, including metadata
  overlays, ads, the YouTube logo, looping, end-of-video behavior, and attempted links.
  Confirm that the child cannot navigate the top-level page into normal YouTube.
- [ ] Run from both `file://` and `python3 -m http.server 8000`, close and reopen the
  page, and verify storage persistence or the expected parent-facing storage warning.

## Focused Cleanup

- [ ] Decide whether accepted input URLs must explicitly use `http:` or `https:`, then
  enforce and test the decision. The current parser checks host and path and always
  stores a canonical HTTPS watch URL.
- [ ] Remove repeated TOML video normalization passes while preserving validation,
  canonical URLs, deduplication, ordering, and the existing round-trip tests.

Do not use these cleanup items as justification for ES modules, a framework, npm, a
build pipeline, dependency injection, wholesale global-state untangling, or splitting
`toml.js` without a concrete product requirement.

## Future PWA Verification

Repeat is not currently a PWA. If manifest, service worker, or standalone-mode work is
explicitly requested, verify installation, updates, offline shell behavior, storage
persistence, fullscreen transitions, orientation, autoplay, and speech on the target
device rather than assuming browser-tab behavior carries over.

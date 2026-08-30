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
- [ ] Run from both `file://` and
  `python3 -m http.server 8000 --bind 127.0.0.1`, close and reopen the page, and verify
  storage persistence or the expected parent-facing storage warning.

## Installed PWA Verification

Record these separately from browser-tab checks; localhost/headless validation does
not prove behavior on Logan's Android device.

- [ ] Install Repeat from Android Chrome, launch it from the home screen, and confirm
  it opens inside the expected standalone display without normal browser controls.
- [ ] Close and reopen the installed app and confirm the saved library, favorites,
  tags, ordering, unlock code, and settings persist.
- [ ] Deploy a shell update with a new cache version. Confirm the open app does not
  reload, then close every Repeat window and verify the next launch uses the update.
- [ ] Launch the installed app in airplane mode and confirm the application shell
  opens. Select a video and confirm the calm offline Player state appears without a
  YouTube iframe.
- [ ] Restore connectivity, press Again, and confirm normal title speech and video
  playback resume without reopening the app.
- [ ] In standalone mode, verify speech/autoplay timing, Kid Mode fullscreen and
  Parent Mode exit, Android Back, portrait/landscape rotation, and background/resume.
- [ ] Verify Kid and Parent flows with TalkBack and Switch Access, including focus
  recovery from Player and Parent unlock.
- [ ] Upload and download TOML from the installed app and confirm Android's file
  picker, downloaded filename, and round trip behave as documented.

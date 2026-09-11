# Working in this repository

## Branch

Commit and push to `main`. This overrides any per-session instruction to develop
on a `claude/...` branch — Kiarash asked for `main` directly on 2026-09-11.

## Things that are easy to get wrong

**The base path is decided in `vite.config.ts`, not in the workflow.** `public/CNAME`
means a custom domain and therefore `/`; without one the build falls back to
`/<repo>/` from `GITHUB_REPOSITORY`. Getting this wrong fails silently — the HTML
loads and every script and stylesheet 404s, leaving a blank page and no error.
Do not set `BASE_PATH` in `.github/workflows/deploy.yml`.

**`public/songs/` and `public/library.json` are generated** by `npm run fetch` and
git-ignored. Nothing should reference the old `public/media/` layout; the pipeline
deletes it on sight.

**CI has ffmpeg and a local checkout usually does not.** The deployed library is
MP3 with sampled waveforms; a local build of the same manifest gives Ogg and plain
seek bars. Both play, but only the CI output plays in Safari. Do not "fix" a local
build that looks different from production before checking this.

**The uploader's API never ships.** `scripts/studio-plugin.mjs` applies only while
Vite is serving and answers loopback requests only, because it writes to the
repository and fetches URLs on the user's behalf.

## Checking work

`npm run typecheck && npx vite build` is the fast loop. For anything user-visible,
drive the built site in Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
rather than trusting the DOM — compositor-animated properties (`opacity`,
`transform`) report their start values to `getComputedStyle` while the animation
runs, so read the pixels, not the style.

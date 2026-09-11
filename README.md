# Kiarash Player

A music player that runs entirely in the browser. You list track URLs in one JSON
file; a build step downloads them, reads their tags, and writes a static site that
ships the audio alongside the app. There is no server and no runtime API — the
deployed output is HTML, CSS, JS and audio files.

The interface is built around translucent panels over a slow-moving colour field.
The accent colour follows whatever is playing: embedded cover art is sampled in a
canvas and reduced to a hue, and tracks without art inherit the colour of the
playlist they came from.

## Adding music

Two ways in, both doing the same work. **Add music** in the player opens a form
that takes a URL, optional metadata, and the playlists the track belongs to; it
writes the manifest and runs the pipeline while you watch. It needs the local
server (`npm run dev` or `npm run preview`) because it writes into the repository
— on a published site the form fills in a manifest snippet for you to paste
instead. From a terminal:

```
npm run add -- https://example.com/song.mp3 \
  --title "Song" --artists "A Composer, A Performer" \
  --playlist "Late Night Piano" --playlist "Something New"
```

A `--playlist` that matches no existing playlist creates one with that title, and
one track can sit in as many playlists as you like — the file is stored once.
Either route is atomic: if the URL cannot be fetched, the manifest is put back
the way it was rather than left holding an entry that will never resolve.

Everything lives in `content/playlists.json`. A track is either a bare URL string
or an object that overrides what the file's tags say:

```json
{
  "site": { "title": "Kiarash Play", "tagline": "Sound, poured into glass." },
  "options": { "transcode": "auto", "waveform": true, "concurrency": 4 },
  "playlists": [
    {
      "id": "late-night-piano",
      "title": "Late Night Piano",
      "description": "Satie and Beethoven, for the hours after everyone has gone home.",
      "accent": "#7c6cff",
      "tracks": [
        "https://example.com/music/first.mp3",
        {
          "url": "https://example.com/music/second.flac",
          "title": "Gymnopedie No. 1",
          "artist": "Erik Satie, performed by Kevin MacLeod",
          "artists": ["Erik Satie", "Kevin MacLeod"],
          "album": "Trois Gymnopedies",
          "cover": "https://example.com/art/cover.jpg",
          "lyrics": "https://example.com/lyrics/second.lrc"
        }
      ]
    }
  ]
}
```

Then run `npm run fetch`. Per track the script downloads the file, caches it under
`.cache/` keyed by a hash of the URL, reads its ID3/Vorbis tags with
`music-metadata`, writes any embedded cover art out as an image, optionally
re-encodes and waveform-samples it with ffmpeg, and files the result under the
first artist credited on it:

```
public/songs/artists/erik-satie/gymnopedie-no-1.mp3
public/songs/artists/erik-satie/gymnopedie-no-1.jpg   (cover, when there is one)
```

It finishes by writing `public/library.json`, which is the only thing the app
reads at runtime.

Re-running is cheap: a URL already in `.cache/` is never fetched again. Change a
URL and only that track is downloaded. Remove a track and its published files are
pruned. Pass `--refresh` to force re-downloads, `--clean` to start over, and
`--strict` to fail the build on the first unreachable URL instead of skipping it.

### Playlist fields

| Field | Meaning |
| --- | --- |
| `id` | URL slug, used in `#/playlist/<id>`. Derived from the title if omitted. |
| `title`, `description` | Shown in the sidebar and the playlist header. |
| `accent` | Hex colour. Sets the playlist's hue, which generated covers and the interface accent follow. |
| `cover` | Image URL. Without one, covers are built from track artwork or generated as gradients. |
| `tracks` | Array of URL strings or track objects. |

### Track fields

`url` is required. `title`, `artist`, `album` and `year` override the file's tags.
`cover` points at an image to use instead of embedded art. `lyrics` points at an
`.lrc` file; timestamped lines are parsed at build time and shown in sync with
playback, and clicking a line seeks to it.

`artist` is the credit line printed under the title. `artists` is the list of
people who each get a page, and the first of them owns the folder the file sits
in. Without `artists`, the credit is split only on unambiguous separators (`;`,
`&`, `feat.`), never on a comma — "J. S. Bach, John Michel (cello)" is one line
about two different roles, and guessing wrong scatters a catalogue across bogus
artist pages. List the names when the split matters:

```json
{
  "url": "…",
  "artist": "Antonio Vivaldi, John Harrison (violin)",
  "artists": ["Antonio Vivaldi", "John Harrison"]
}
```

### Options

`transcode` defaults to `"auto"`, which re-encodes formats browsers disagree about
(Ogg, Opus, FLAC, WAV, WMA) to MP3 and leaves MP3/M4A/AAC alone. Set it to `"mp3"`
or `"m4a"` to re-encode everything, or `"off"` to publish sources untouched.
`waveform` samples each track into peak values so the seek bar draws a waveform
instead of a plain bar. Both need ffmpeg on `PATH`; without it the script prints a
warning and publishes the original files. `concurrency`, `retries` and `timeout`
control the downloader.

Only direct http(s) links to audio files work. There is no YouTube or streaming-service
extraction, and adding one would put the licensing burden on you.

## Running it

```
npm install
npm run dev      # fetch, then serve on http://localhost:5173
npm run build    # fetch, typecheck, build to dist/
npm run preview  # serve dist/
```

`npm run fetch` on its own refreshes the library without touching the app build.

## What the player does

Playback covers the usual ground: queue with drag-to-reorder, play-next and
add-to-queue, shuffle, three repeat modes, a sleep timer, and a volume slider that
remembers where you left it. Liked tracks, recently played, play counts, the queue
and your playback position are kept in `localStorage`, so reopening the tab picks
up where you stopped.

A page per artist collects everything they are credited on, whether or not they
are the one whose folder holds the file, along with the playlists those tracks
appear on. Every credit line in the app links to it.

Beyond that: search over tracks, artists, albums and playlist names (`/` or `⌘K`),
synced lyrics when a track has an `.lrc`, a live spectrum drawn behind the player
bar from a Web Audio analyser, a full-screen view, light and dark themes plus
`auto`, and OS media-key support through the Media Session API, which also puts
the title and artwork on the lock screen.

It installs as a PWA. A service worker caches the app shell, and each track is
stored in full the first time it plays — audio elements only ever issue Range
requests, so the page asks the worker for a complete copy and the worker serves
206 slices out of it when you are offline.

### Keyboard

`Space` play/pause · `←`/`→` seek 5s (hold `Shift` for 30s) · `↑`/`↓` volume ·
`Shift+N`/`Shift+P` next and previous · `M` mute · `S` shuffle · `R` repeat ·
`H` like · `Q` queue · `L` lyrics · `F` full screen · `/` or `⌘K` search · `?` help.

## Deploying

`.github/workflows/deploy.yml` installs ffmpeg, restores the media cache, fetches
every track with `--strict`, builds with `BASE_PATH` set to `/<repo>/`, and
publishes to GitHub Pages. Enable Pages for the repository with "GitHub Actions"
as the source and push to `main`.

The whole library ships as static files, so the site is as large as the audio in
it. GitHub Pages soft-limits a published site to about 1 GB and asks that sites
stay under 100 GB of bandwidth a month. For anything bigger, host `dist/` on
object storage instead — nothing in the app assumes Pages.

To deploy elsewhere, run `npm run build` and upload `dist/`. Set `BASE_PATH` if the
site is served from a subdirectory; media paths in `library.json` are relative, so
the same build works at any prefix.

## Layout

```
content/playlists.json   the manifest you edit
scripts/fetch-media.mjs  the command line over the pipeline
scripts/add-track.mjs    `npm run add`
scripts/studio-plugin.mjs  the uploader's API, mounted on the dev/preview server
scripts/lib/pipeline.mjs   download, tag, transcode, publish
scripts/lib/             config parsing, downloader, ffmpeg wrappers, manifest edits
src/player/              audio engine, queue reducer, keyboard shortcuts
src/components/          UI
src/styles/glass.css     tokens, glass primitives, animated backdrop
src/styles/app.css       layout and components
public/sw.js             offline caching
```

`public/songs/` and `public/library.json` are generated and git-ignored.

The uploader's API is mounted by a Vite plugin that only applies when Vite is
serving, and it answers loopback requests only — it writes to the repository and
fetches URLs on your behalf, so it has no business being reachable from the
network. `vite build` produces static files with no API at all.

## The tracks in this repository

`content/playlists.json` ships with eighteen recordings from Wikimedia Commons:
Kevin MacLeod's readings of Satie's Gymnopédies, John Harrison's February 2000
recording of Vivaldi's *Four Seasons* with the Wichita State University Chamber
Players under Robert Turizziani, John Michel's Bach cello suites, and two Beethoven
sonata movements. Most are CC BY or CC BY-SA rather than public domain, so
[`content/CREDITS.md`](content/CREDITS.md) lists every performer, licence and
source file; keep it with the site if you publish these tracks.

They are there so the player has something to play. Replace them with your own
URLs, and check the licence on anything you add — the build copies the audio into
the published site.

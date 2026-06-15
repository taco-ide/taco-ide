# TACO demo reel — editing guide

Recorded by `node demo/record-demo.mjs` against the seeded dev stack.

## What you have

- **Clips:** `demo/output/00-…webm` → `06-…webm` (7 files, in order)
- **Checkpoint screenshots:** `demo/shots/*.png` (one per scene — what each clip ends on)
- Format: **WebM (VP8), 1600×900, no audio**. Each clip is self-contained: a
  branded title card ("text") then the feature demo — so the edit is mostly
  "lay them end to end."

| # | Clip | ~Duration | Content |
|---|------|-----------|---------|
| 00 | `00-intro` | ~4s | TACO intro card |
| 01 | `01-login` | ~11s | "One workspace" card → sign in → dashboard |
| 02 | `02-dashboard` | ~9s | "At a glance" card → teacher dashboard |
| 03 | `03-submissions` | ~8s | "Every submission" card → 5-student table |
| 04 | `04-auto-review` | ~9s | "Reviewed by AI" card → structured review (John) |
| 05 | `05-replay` ⭐ | ~20s | "Replay" card → timeline, stars, **diff**, autoplay |
| 06 | `06-outro` | ~4s | Outro / CTA card |

Raw total ≈ **65–70s** → trims down to a tight **~45–55s** reel.

## Step 1 — convert WebM → MP4 (H.264)

Premiere / Final Cut dislike WebM; DaVinci Resolve (free) & CapCut are hit-or-miss.
Convert first. Install ffmpeg (`winget install Gyan.FFmpeg`), then in PowerShell from the repo root:

```powershell
Get-ChildItem demo/output/*.webm | ForEach-Object {
  ffmpeg -i $_.FullName -c:v libx264 -pix_fmt yuv420p -crf 18 -an `
    ("demo/output/{0}.mp4" -f $_.BaseName)
}
```

## Step 2 — assemble

Drop `00 → 06` on the timeline in numeric order. They already read as
"card → demo", so a straight sequence works. Optional: ~0.3s cross-dissolve
between clips (the cards already fade in/out, so hard cuts are fine too).

## Step 3 — trims & speed (recommended)

- Trim the first ~0.3s of each clip (browser warm-up frame).
- **01-login:** speed the typing 1.5–2× — it's intentionally slow for legibility.
- **05-replay (hero):** keep the moments where the **green diff** appears and a
  ⭐ step is selected; trim the autoplay dwell if it drags. This is the clip to
  give the most screen time.
- Each title card holds ~3.4s — tighten to ~2–2.5s if pacing feels slow.

## Step 4 — audio & captions

- Clips have **no audio**, so add a light background track freely (nothing to duck).
- Optional voiceover: read each card's headline as the scene starts.
- Headlines are **baked into the cards**. If you'd rather animate lower-thirds in
  your editor instead, ask me to re-record with the cards off.

## Step 5 — export

1080p H.264, ~8–12 Mbps. Note the clips are **900p** — for a crisp 1080p master,
re-record at 1920×1080 (change `SIZE` in `demo/record-demo.mjs`) rather than
upscaling.

## One-shot stitch without an editor (optional)

After converting to mp4:

```powershell
# build the concat list
Get-ChildItem demo/output/*.mp4 | Sort-Object Name |
  ForEach-Object { "file '$($_.FullName)'" } | Set-Content demo/output/list.txt
ffmpeg -f concat -safe 0 -i demo/output/list.txt -c copy demo/output/taco-demo.mp4
```

## Re-recording

`node demo/record-demo.mjs` (servers must be up: `npm run dev`). Tunables live at
the top of the script: `SIZE` (resolution), the per-scene `beat(...)` dwell
times, and the scene list in `main()`.

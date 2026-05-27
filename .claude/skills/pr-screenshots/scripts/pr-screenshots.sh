#!/usr/bin/env bash
#
# Upload the e2e screenshots produced by the Playwright suite to a secret
# gist and embed them at the TOP of a PR description, inside a collapsible
# <details> block whose <summary> is an <h2>.
#
# Re-runnable: the block is wrapped in HTML markers. A second run REPLACES the
# previous block AND deletes the previous gist (no orphaned gists / images) —
# the section is rebuilt from scratch with a fresh gist every time.
#
# Usage:
#   pr-screenshots.sh <pr-number> [owner/repo]
#
# Reads PNGs from test-results/screenshots/** (the layout produced by
# e2e/helpers/screenshots.ts -> makeShooter). Run `npm run test:e2e` first.
#
# Requires: gh (authenticated), git, python3.
#
# NOTE: pushing to a gist may be blocked by Claude Code's auto-mode safety
# classifier the first time — the user must approve / add a Bash permission
# rule for `git push` to gist.github.com. Secret gists are NOT truly private
# (anyone with the URL can view). Confirm with the user before running on a
# repo with sensitive UI.
set -euo pipefail

PR="${1:?usage: pr-screenshots.sh <pr-number> [owner/repo]}"
REPO="${2:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

SHOT_DIR="test-results/screenshots"
[[ -d "$SHOT_DIR" ]] || { echo "no screenshots at $SHOT_DIR — run 'npm run test:e2e' first" >&2; exit 1; }

# Collect PNGs in stable order (bash 3.2 compatible — no mapfile).
PNGS=()
while IFS= read -r f; do PNGS+=("$f"); done < <(find "$SHOT_DIR" -type f -name '*.png' | sort)
[[ ${#PNGS[@]} -gt 0 ]] || { echo "no PNGs under $SHOT_DIR" >&2; exit 1; }
echo "Found ${#PNGS[@]} screenshot(s)."

GH_USER="$(gh api user --jq .login)"

# --- 0. snapshot the current PR body; find any gist already embedded ---
ORIG="$(mktemp)"
gh pr view "$PR" -R "$REPO" --json body --jq .body > "$ORIG"
# Old gist IDs referenced by a previous run (gist raw URLs). Unique.
OLD_GIDS=()
while IFS= read -r gid; do [[ -n "$gid" ]] && OLD_GIDS+=("$gid"); done < <(
  grep -oE 'gist\.githubusercontent\.com/[^/]+/[0-9a-f]+/raw' "$ORIG" \
    | sed -E 's#.*/([0-9a-f]+)/raw#\1#' | sort -u
)

# --- 1. create a secret gist with a throwaway placeholder file ---
DESC="${REPO} PR #${PR} — e2e screenshot evidence"
PLACEHOLDER="$(mktemp -t prshots.XXXX).md"
printf 'PR #%s e2e screenshot evidence\n' "$PR" > "$PLACEHOLDER"
GIST_URL="$(gh gist create --desc "$DESC" "$PLACEHOLDER")"
GID="$(basename "$GIST_URL")"
RAW_BASE="https://gist.githubusercontent.com/${GH_USER}/${GID}/raw"
echo "Gist: $GIST_URL"

# --- 2. clone the gist (auth required for secret gists), add PNGs, push ---
TOK="$(gh auth token)"
WORK="$(mktemp -d)"
git clone -q "https://${GH_USER}:${TOK}@gist.github.com/${GID}.git" "$WORK"
rm -f "$WORK/$(basename "$PLACEHOLDER")"   # drop the placeholder in the same push

for src in "${PNGS[@]}"; do
  rel="${src#"$SHOT_DIR"/}"        # e.g. professor-flow/03-grade-saved.png
  key="${rel//\//__}"             # professor-flow__03-grade-saved.png (gist keys can't have /)
  cp "$src" "$WORK/$key"
done

(
  cd "$WORK"
  git add -A
  git -c user.email="$(git config user.email 2>/dev/null || echo bot@local)" \
      -c user.name="$(git config user.name 2>/dev/null || echo bot)" \
      commit -q -m "PR #$PR e2e screenshots"
  git push -q origin HEAD
)

# --- 3. build the markdown block, grouped by test directory ---
BLOCK="$(mktemp)"
{
  echo '<!-- e2e-screenshots:start -->'
  echo '<details>'
  echo '<summary><h2>📸 E2E Screenshots (proof of changes)</h2></summary>'
  echo
  echo 'Captured automatically by the Playwright suite (`npm run test:e2e`).'
  prev_group=""
  idx=0
  for src in "${PNGS[@]}"; do
    rel="${src#"$SHOT_DIR"/}"
    group="${rel%%/*}"
    base="$(basename "$rel" .png)"
    key="${rel//\//__}"
    ghuman="$(echo "$group" | tr '-' ' ')"
    chuman="$(echo "$base" | sed -E 's/^[0-9]+-//; s/-/ /g')"
    if [[ "$group" != "$prev_group" ]]; then
      echo
      echo "### ${ghuman}"
      prev_group="$group"
    fi
    idx=$((idx + 1))
    echo
    echo "**${idx}. ${chuman}**"
    echo
    echo "![${chuman}](${RAW_BASE}/${key})"
  done
  echo
  echo '</details>'
  echo '<!-- e2e-screenshots:end -->'
} > "$BLOCK"

# --- 4. prepend (or replace, if already present) the block in the PR body ---
NEWBODY="$(mktemp)"
python3 - "$ORIG" "$BLOCK" "$NEWBODY" <<'PY'
import sys
orig  = open(sys.argv[1]).read()
block = open(sys.argv[2]).read().rstrip() + "\n"
start, end = "<!-- e2e-screenshots:start -->", "<!-- e2e-screenshots:end -->"
if start in orig and end in orig:
    pre  = orig[:orig.index(start)]
    post = orig[orig.index(end) + len(end):]
    out  = pre + block.rstrip() + post
else:
    out = block + "\n---\n\n" + orig
open(sys.argv[3], "w").write(out)
PY
gh pr edit "$PR" -R "$REPO" --body-file "$NEWBODY"
echo "Updated PR #$PR with ${#PNGS[@]} screenshot(s)."

# --- 5. only AFTER the PR points at the new gist, delete the old one(s) ---
for old in "${OLD_GIDS[@]}"; do
  if [[ "$old" != "$GID" ]]; then
    if gh gist delete "$old" --yes 2>/dev/null; then
      echo "Deleted previous gist $old."
    else
      echo "WARN: could not delete previous gist $old (delete manually: gh gist delete $old)." >&2
    fi
  fi
done

echo "VERIFY the images render at: $(gh pr view "$PR" -R "$REPO" --json url --jq .url)"

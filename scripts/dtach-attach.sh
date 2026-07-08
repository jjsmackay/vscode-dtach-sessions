#!/usr/bin/env bash
# Pick a dtach Sessions socket from a numbered (or fzf) list and attach to it.
# Standalone: mirrors the extension's defaults (src/provider.ts config()) but
# reads no VS Code settings, so overrides go via flags or env vars.
#
# Usage: dtach-attach.sh [-d socketDir] [-p prefix] [-r redrawMethod] [-b dtachBin]
#
# Env var equivalents (flag wins if both given):
#   DTACH_SESSIONS_DIR, DTACH_SESSIONS_PREFIX, DTACH_SESSIONS_REDRAW, DTACH_SESSIONS_BIN

set -euo pipefail

socket_dir="${DTACH_SESSIONS_DIR:-$HOME/.dtach-sessions}"
prefix="${DTACH_SESSIONS_PREFIX:-}"
redraw="${DTACH_SESSIONS_REDRAW:-winch}"
dtach_bin="${DTACH_SESSIONS_BIN:-dtach}"

usage() {
  sed -n '2,11p' "$0" | sed 's/^# \?//'
}

while getopts ":d:p:r:b:h" opt; do
  case "$opt" in
    d) socket_dir=$OPTARG ;;
    p) prefix=$OPTARG ;;
    r) redraw=$OPTARG ;;
    b) dtach_bin=$OPTARG ;;
    h) usage; exit 0 ;;
    *) usage; exit 1 ;;
  esac
done

if ! command -v "$dtach_bin" >/dev/null 2>&1; then
  echo "dtach-attach: '$dtach_bin' not found on PATH (set -b or \$DTACH_SESSIONS_BIN)" >&2
  exit 1
fi

if [[ ! -d "$socket_dir" ]]; then
  echo "dtach-attach: no socket directory at $socket_dir" >&2
  exit 1
fi

# display_name(basename) -> strip prefix, .dtach, and a trailing _<6-hex-hash>.
display_name() {
  local base=${1#"$prefix"}
  base=${base%.dtach}
  if [[ $base =~ ^(.*)_[0-9a-f]{6}$ ]]; then
    base="${BASH_REMATCH[1]}"
  fi
  printf '%s' "$base"
}

# hash_of(basename) -> the trailing 6-hex-hash, if present.
hash_of() {
  local base=${1%.dtach}
  if [[ $base =~ _([0-9a-f]{6})$ ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
  fi
  return 0
}

# relative_age(mtime_epoch_seconds) -> compact "2h ago"-style string.
relative_age() {
  local secs=$(( $(date +%s) - $1 ))
  (( secs < 0 )) && secs=0
  if (( secs < 60 )); then printf '%ds ago' "$secs"; return; fi
  local mins=$(( secs / 60 ))
  if (( mins < 60 )); then printf '%dm ago' "$mins"; return; fi
  local hours=$(( mins / 60 ))
  if (( hours < 24 )); then printf '%dh ago' "$hours"; return; fi
  printf '%dd ago' $(( hours / 24 ))
}

# status_badge(hash) -> "working" / "tool: Bash" / "waiting" / "done", or "".
# Best-effort: no jq dependency, just enough parsing for the hook's flat JSON.
status_badge() {
  local hash=$1
  [[ -z "$hash" ]] && return 0
  local f="$socket_dir/status/$hash.json"
  [[ -f "$f" ]] || return 0
  local json state tool
  json=$(cat "$f" 2>/dev/null) || return 0
  state=$(sed -n 's/.*"state"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' <<<"$json")
  [[ -z "$state" || "$state" == "idle" ]] && return 0
  if [[ "$state" == "tool" ]]; then
    tool=$(sed -n 's/.*"tool"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' <<<"$json")
    printf 'tool: %s' "${tool:-tool}"
  else
    printf '%s' "$state"
  fi
  return 0
}

sockets=()
while IFS= read -r -d '' f; do
  [[ -S "$f" ]] && sockets+=("$f")
done < <(find "$socket_dir" -maxdepth 1 -name "${prefix}*.dtach" -print0 2>/dev/null)

if [[ ${#sockets[@]} -eq 0 ]]; then
  echo "dtach-attach: no sessions found in $socket_dir" >&2
  exit 1
fi

# Sort newest-first by mtime (matches the extension's default 'created' sort).
mapfile -t sockets < <(
  for s in "${sockets[@]}"; do
    printf '%s\t%s\n' "$(stat -c '%Y' "$s" 2>/dev/null || stat -f '%m' "$s")" "$s"
  done | sort -rn -k1,1 | cut -f2-
)

names=()
for s in "${sockets[@]}"; do
  base=$(basename "$s")
  name=$(display_name "$base")
  age=$(relative_age "$(stat -c '%Y' "$s" 2>/dev/null || stat -f '%m' "$s")")
  badge=$(status_badge "$(hash_of "$base")")
  if [[ -n "$badge" ]]; then
    names+=("$name  ($badge, $age)")
  else
    names+=("$name  ($age)")
  fi
done

choice_idx=-1
if command -v fzf >/dev/null 2>&1; then
  selected=$(printf '%s\n' "${names[@]}" | nl -ba -w2 -s': ' | fzf --with-nth=2.. --prompt='attach> ' --height=~60% --reverse) || exit 1
  choice_idx=$(( $(cut -d: -f1 <<<"$selected" | tr -d ' ') - 1 ))
else
  PS3="attach> "
  select _ in "${names[@]}"; do
    if [[ -n "${REPLY:-}" && "$REPLY" =~ ^[0-9]+$ && "$REPLY" -ge 1 && "$REPLY" -le ${#names[@]} ]]; then
      choice_idx=$(( REPLY - 1 ))
      break
    fi
    echo "Invalid choice." >&2
  done
fi

if [[ $choice_idx -lt 0 ]]; then
  echo "dtach-attach: no selection made" >&2
  exit 1
fi

socket=${sockets[$choice_idx]}
echo "dtach-attach: attaching to ${names[$choice_idx]}" >&2
exec "$dtach_bin" -a "$socket" -r "$redraw"

#!/usr/bin/env python3
"""dtach-sessions Claude status forwarder.

Registered as a Claude Code hook under each lifecycle event. Correlates the
firing hook to a dtach session by walking /proc ancestors to the dtach master
process (whose argv carries the *.dtach socket path), then writes the session's
current run-state to <socket-dir>/status/<hash>.json. It derives the status
directory from the socket it finds, so it needs no configuration and stays
correct even when dtachSessions.socketDir is customised.

A no-op when the hook is not running inside a dtach session (the hook is
host-global and fires for every Claude on the machine) or when /proc is
unavailable (non-Linux host). Never raises — a hook must not disrupt Claude.

Usage: claude-status-hook <EVENT_NAME>
"""
import json
import os
import re
import sys
import time

HASH_RE = re.compile(r"_([0-9a-f]{6})\.dtach$")

# Claude lifecycle event -> session run-state. SessionEnd is handled specially
# (it removes the status file). Unlisted events are ignored.
STATE = {
    "SessionStart": "idle",
    "UserPromptSubmit": "working",
    "PreToolUse": "tool",
    "PostToolUse": "working",
    "Notification": "waiting",
    "Stop": "idle",
}


def ppid_of(pid):
    with open("/proc/%d/status" % pid) as f:
        for line in f:
            if line.startswith("PPid:"):
                return int(line.split()[1])
    return 0


def find_socket():
    """Walk the process-ancestor chain for a dtach master; return its socket path."""
    pid = os.getpid()
    for _ in range(40):  # bound the walk; real chains are short
        if pid <= 1:
            break
        try:
            with open("/proc/%d/cmdline" % pid, "rb") as f:
                args = f.read().split(b"\x00")
        except OSError:
            return None
        for a in args:
            s = a.decode("utf-8", "replace")
            if s.endswith(".dtach"):
                return s
        try:
            pid = ppid_of(pid)
        except (OSError, ValueError):
            return None
    return None


def main():
    event = sys.argv[1] if len(sys.argv) > 1 else ""
    socket = find_socket()
    if not socket:
        return  # not inside a dtach session — no-op
    m = HASH_RE.search(os.path.basename(socket))
    if not m:
        return  # legacy hashless socket — no stable key
    status_dir = os.path.join(os.path.dirname(socket), "status")
    target = os.path.join(status_dir, m.group(1) + ".json")

    if event == "SessionEnd":
        try:
            os.remove(target)
        except OSError:
            pass
        return

    state = STATE.get(event)
    if state is None:
        return

    rec = {"state": state, "ts": int(time.time() * 1000)}
    if state == "tool":
        try:
            rec["tool"] = (json.load(sys.stdin) or {}).get("tool_name") or ""
        except (ValueError, OSError):
            rec["tool"] = ""

    try:
        os.makedirs(status_dir, exist_ok=True)
        tmp = "%s.tmp.%d" % (target, os.getpid())
        with open(tmp, "w") as f:
            f.write(json.dumps(rec))
        os.replace(tmp, target)  # atomic publish — readers never see a torn file
    except OSError:
        pass


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass  # a hook must never disrupt Claude
    sys.exit(0)

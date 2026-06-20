#!/bin/bash
# Run by dpkg/apt right after the new files have been laid down.
#
# A manual `dpkg -i` / `apt install` over a running app must kill the stale
# instance so it doesn't keep serving the previous in-memory asar. But the
# in-app updater installs the .deb itself and then relaunches via
# app.relaunch() — killing it here would abort that restart. So skip the kill
# when the in-app updater flagged this install (env var preserved through sudo,
# plus a marker file as a fallback for stricter sudoers).

if [ "$AI_TOOL_INAPP_UPDATE" = "1" ] || [ -f /tmp/.ai-tool-inapp-update ]; then
    # In-app update — the running app relaunches itself; leave it alone.
    exit 0
fi

pkill -f "/opt/AI Tool/ai-tool" 2>/dev/null || true

exit 0

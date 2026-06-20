#!/bin/bash
# Run by dpkg/apt right after the new files have been laid down.
# Kill any old Smart Marine AI process that is still holding the previous
# /opt/Smart Marine AI/smart-marine-ai inode in memory, so the next launch
# uses the upgraded binary and bundled skills/asar.

pkill -f "/opt/Smart Marine AI/smart-marine-ai" 2>/dev/null || true

exit 0

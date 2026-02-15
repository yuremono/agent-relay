#!/bin/bash

# inbox_write.sh - Append notification to inbox file with flock protection
# Usage: ./scripts/inbox_write.sh <inbox_file> <from> <type> <content_file> <message>
#
# Example:
#   ./scripts/inbox_write.sh relay/inbox/leader.yaml officer new_task relay/to/leader.yaml "New task assigned"

set -e

INBOX_FILE="${1:-relay/inbox/leader.yaml}"
FROM="${2:-unknown}"
TYPE="${3:-notification}"
CONTENT_FILE="${4:-}"
MESSAGE="${5:-Notification received}"

# Create directory if not exists
mkdir -p "$(dirname "$INBOX_FILE")"

# Get timestamp in ISO 8601 format
TIMESTAMP=$(date -u "+%Y-%m-%dT%H:%M:%SZ")

# Create YAML entry
if [ -n "$CONTENT_FILE" ]; then
    NEW_ENTRY="- timestamp: \"$TIMESTAMP\"
  from: \"$FROM\"
  type: \"$TYPE\"
  file: \"$CONTENT_FILE\"
  message: \"$MESSAGE\""
else
    NEW_ENTRY="- timestamp: \"$TIMESTAMP\"
  from: \"$FROM\"
  type: \"$TYPE\"
  message: \"$MESSAGE\""
fi

# Append with flock protection
(
    flock -x 200
    echo "$NEW_ENTRY" >> "$INBOX_FILE"
) 200>"$INBOX_FILE.lock"

# Log
mkdir -p logs
echo "[$(date '+%Y-%m-%d %H:%M:%S')] inbox_write: $INBOX_FILE <- $FROM ($TYPE)" >> logs/watcher.log

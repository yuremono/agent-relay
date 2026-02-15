#!/bin/bash

# from_write.sh - Append report to from/ file with sequence number and flock protection
# Usage: ./scripts/from_write.sh <from_file> <status> <message>
#
# Example:
#   ./scripts/from_write.sh relay/from/leader.yaml completed "Task done successfully"

set -e

FROM_FILE="${1:-relay/from/leader.yaml}"
STATUS="${2:-completed}"  # completed | blocked | in_progress
MESSAGE="${3:-No message}"

# Create directory if not exists
mkdir -p "$(dirname "$FROM_FILE")"

# Get timestamp in ISO 8601 format
TIMESTAMP=$(date -u "+%Y-%m-%dT%H:%M:%SZ")

# Initialize file if not exists
if [ ! -f "$FROM_FILE" ]; then
    echo "# Reports from $(basename "$FROM_FILE" .yaml)" > "$FROM_FILE"
    echo "messages:" >> "$FROM_FILE"
fi

# Get next sequence number
LAST_SEQ=$(grep -E "^  - seq:" "$FROM_FILE" 2>/dev/null | tail -1 | sed 's/.*seq: //' || echo "0")
if [ -z "$LAST_SEQ" ]; then
    LAST_SEQ=0
fi
NEXT_SEQ=$((LAST_SEQ + 1))

# Create YAML entry
NEW_ENTRY="- seq: $NEXT_SEQ
  timestamp: \"$TIMESTAMP\"
  status: \"$STATUS\"
  message: |
    $MESSAGE"

# Append with flock protection
(
    flock -x 200
    echo "  $NEW_ENTRY" >> "$FROM_FILE"
) 200>"$FROM_FILE.lock"

# Log
mkdir -p logs
echo "[$(date '+%Y-%m-%d %H:%M:%S')] from_write: $FROM_FILE seq=$NEXT_SEQ status=$STATUS" >> logs/watcher.log

echo "Report seq=$NEXT_SEQ written to $FROM_FILE"

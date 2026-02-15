#!/bin/bash

# to_write.sh - Append task/message to to/ file with sequence number and flock protection
# Usage: ./scripts/to_write.sh <to_file> <from> <message> [type]
#
# Example:
#   ./scripts/to_write.sh relay/to/member_1.yaml leader "Implement login form" task

set -e

TO_FILE="${1:-relay/to/leader.yaml}"
FROM="${2:-unknown}"
MESSAGE="${3:-No message}"
TYPE="${4:-task}"  # task | query | notice

# Create directory if not exists
mkdir -p "$(dirname "$TO_FILE")"

# Get timestamp in ISO 8601 format
TIMESTAMP=$(date -u "+%Y-%m-%dT%H:%M:%SZ")

# Initialize file if not exists
if [ ! -f "$TO_FILE" ]; then
    echo "# Messages for $(basename "$TO_FILE" .yaml)" > "$TO_FILE"
    echo "messages:" >> "$TO_FILE"
fi

# Get current max sequence number (default to 0)
LAST_SEQ=$(grep -E "^  - seq:" "$TO_FILE" 2>/dev/null | tail -1 | sed 's/.*seq: //' || echo "0")
if [ -z "$LAST_SEQ" ]; then
    LAST_SEQ=0
fi
NEXT_SEQ=$((LAST_SEQ + 1))

# Create YAML entry
NEW_ENTRY="- seq: $NEXT_SEQ
  timestamp: \"$TIMESTAMP\"
  from: \"$FROM\"
  type: \"$TYPE\"
  status: \"pending\"
  message: |
    $MESSAGE"

# Append with flock protection
(
    flock -x 200
    echo "  $NEW_ENTRY" >> "$TO_FILE"
) 200>"$TO_FILE.lock"

# Log
mkdir -p logs
echo "[$(date '+%Y-%m-%d %H:%M:%S')] to_write: $TO_FILE seq=$NEXT_SEQ from=$FROM" >> logs/watcher.log

echo "Message seq=$NEXT_SEQ written to $TO_FILE"

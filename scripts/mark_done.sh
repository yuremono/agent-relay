#!/bin/bash

# mark_done.sh - Mark a message as done in to/ or from/ file
# Usage: ./scripts/mark_done.sh <file> <seq>
#
# Example:
#   ./scripts/mark_done.sh relay/to/member_1.yaml 3

set -e

FILE="${1}"
SEQ="${2}"

if [ -z "$FILE" ] || [ -z "$SEQ" ]; then
    echo "Usage: $0 <file> <seq>"
    echo "Example: $0 relay/to/member_1.yaml 3"
    exit 1
fi

if [ ! -f "$FILE" ]; then
    echo "Error: File not found: $FILE"
    exit 1
fi

# Update status to done with flock protection
(
    flock -x 200
    # Use sed to update the status for the matching sequence
    # macOS compatible
    sed -i '' "/^  - seq: $SEQ$/,/^  - seq:/{
        s/status: \"pending\"/status: \"done\"/
    }" "$FILE"
) 200>"$FILE.lock"

# Log
mkdir -p logs
echo "[$(date '+%Y-%m-%d %H:%M:%S')] mark_done: $FILE seq=$SEQ" >> logs/watcher.log

echo "Marked seq=$SEQ as done in $FILE"

#!/bin/bash

# archive.sh - Auto-archive done messages when file exceeds threshold
# Usage: ./scripts/archive.sh [max_lines]
#
# Called automatically when reading messages, or can be run manually.
# Default threshold: 600 lines

set -e

MAX_LINES="${1:-600}"
ARCHIVE_DIR="relay/archive"

archive_file() {
    local FILE="$1"
    local LINES=$(wc -l < "$FILE" | tr -d ' ')

    if [ "$LINES" -le "$MAX_LINES" ]; then
        return 0
    fi

    local BASENAME=$(basename "$FILE" .yaml)
    local TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    local ARCHIVE_PATH="$ARCHIVE_DIR/$(date +%Y%m)"

    # Count done messages
    local DONE_COUNT=$(grep -c 'status: "done"' "$FILE" 2>/dev/null || echo "0")

    if [ "$DONE_COUNT" -eq 0 ]; then
        return 0
    fi

    mkdir -p "$ARCHIVE_PATH"

    # Extract done messages to archive
    (
        flock -x 200
        # Create archive file with done messages
        local ARCHIVE_FILE="$ARCHIVE_PATH/${BASENAME}_${TIMESTAMP}.yaml"
        echo "# Archived messages from $BASENAME" > "$ARCHIVE_FILE"
        echo "messages:" >> "$ARCHIVE_FILE"

        # Extract entries with status: "done" (simplified approach)
        # This keeps the entire entry block for done items
        awk '
            /^  - seq:/ { in_entry = 1; entry = $0; next }
            in_entry { entry = entry "\n" $0 }
            /status: "done"/ && in_entry { is_done = 1 }
            /^  - seq:/ && in_entry && !is_done { in_entry = 0; entry = "" }
            /^  - seq:/ && in_entry && is_done { print entry; is_done = 0; entry = $0 }
        ' "$FILE" >> "$ARCHIVE_FILE"

        # Remove done entries from original, keep pending
        # Create a temp file with only pending entries
        local TEMP_FILE="$FILE.tmp"
        echo "# Messages for $BASENAME" > "$TEMP_FILE"
        echo "messages:" >> "$TEMP_FILE"
        awk '
            /^  - seq:/ { in_entry = 1; entry = $0; next }
            in_entry { entry = entry "\n" $0 }
            /status: "done"/ && in_entry { is_done = 1 }
            /^  - seq:/ && in_entry && is_done { in_entry = 0; entry = ""; is_done = 0 }
            /^  - seq:/ && in_entry && !is_done { print "  " entry; in_entry = 0; entry = $0 }
        ' "$FILE" >> "$TEMP_FILE"
        mv "$TEMP_FILE" "$FILE"
    ) 200>"$FILE.lock"

    # Log
    mkdir -p logs
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] archive: $FILE ($LINES lines, $DONE_COUNT done)" >> logs/watcher.log
    echo "Archived: $FILE ($DONE_COUNT messages moved to $ARCHIVE_PATH)"
}

# Process all to/ and from/ files
for FILE in relay/to/*.yaml relay/from/*.yaml; do
    if [ -f "$FILE" ]; then
        archive_file "$FILE"
    fi
done

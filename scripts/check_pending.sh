#!/bin/bash

# check_pending.sh - Check for pending messages in a to/ or from/ file
# Usage: ./scripts/check_pending.sh <file>
#
# Example:
#   ./scripts/check_pending.sh relay/to/member_1.yaml

set -e

FILE="${1}"

if [ -z "$FILE" ]; then
    echo "Usage: $0 <file>"
    echo "Example: $0 relay/to/member_1.yaml"
    exit 1
fi

if [ ! -f "$FILE" ]; then
    echo "No pending messages (file not found: $FILE)"
    exit 0
fi

# Auto-archive if needed
./scripts/archive.sh 600 2>/dev/null || true

# Check for pending messages
echo "=== Pending messages in $FILE ==="

# Use awk to extract full pending entries
awk '
/^  - seq:/ {
    in_entry = 1
    entry = $0
    is_pending = 0
    next
}
in_entry {
    entry = entry "\n" $0
    if (/status: "pending"/) is_pending = 1
}
/^  - seq:/ && in_entry {
    if (is_pending) print entry
    in_entry = 1
    entry = $0
    is_pending = 0
    next
}
END {
    if (in_entry && is_pending) print entry
}
' "$FILE" | head -100

# Count pending
PENDING_COUNT=$(grep -c 'status: "pending"' "$FILE" 2>/dev/null || echo "0")
echo ""
echo "Total pending: $PENDING_COUNT"

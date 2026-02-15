#!/bin/bash

# notify_member.sh - Send notification to Member (Pane 2+)
# Called by fswatch when relay/inbox/member_N.yaml changes
# Usage: ./notify_member.sh <member_index>

MEMBER_INDEX="${1:-1}"
LOG_FILE="logs/watcher.log"
mkdir -p logs

echo "[$(date '+%Y-%m-%d %H:%M:%S')] notify_member_$MEMBER_INDEX: Triggered" >> "$LOG_FILE"

# Check if VS Code/Cursor is in background
CURRENT_APP=$(osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' 2>/dev/null)

if [[ "$CURRENT_APP" != "Visual Studio Code" && "$CURRENT_APP" != "Cursor" && "$CURRENT_APP" != "Electron" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] notify_member_$MEMBER_INDEX: VS Code is background, activating" >> "$LOG_FILE"

    # Play notification sound
    afplay /System/Library/Sounds/Glass.aiff 2>/dev/null &

    # Activate VS Code or Cursor
    if [ -d "/Applications/Cursor.app" ]; then
        osascript -e 'tell application "Cursor" to activate' 2>> "$LOG_FILE"
    else
        osascript -e 'tell application "Visual Studio Code" to activate' 2>> "$LOG_FILE"
    fi

    sleep 0.5
fi

# Terminal index: Member_1 = 2, Member_2 = 3, etc.
TERMINAL_INDEX=$((MEMBER_INDEX + 1))

# Send notification to Extension
# Message: "Please check relay/inbox/member_N.yaml"
MESSAGE="relay/inbox/member_${MEMBER_INDEX}.yaml%E3%82%92%E7%A2%BA%E8%AA%8D%E3%81%97%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84"

RESPONSE=$(curl -s "http://localhost:3773/chat?terminal=${TERMINAL_INDEX}&text=$MESSAGE" 2>&1)

if [ $? -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] notify_member_$MEMBER_INDEX: Sent to terminal $TERMINAL_INDEX - $RESPONSE" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] notify_member_$MEMBER_INDEX: ERROR - Extension not responding" >> "$LOG_FILE"
fi

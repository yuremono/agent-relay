#!/bin/bash

# Agent Relay System Startup Script
# Usage: relay-start (after relay-init)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}Agent Relay System${NC}"
echo ""

# Check if relay directory exists
if [ ! -d "relay" ]; then
    echo -e "${RED}Error: relay/ directory not found${NC}"
    echo "Please run 'relay-init' first to initialize the project."
    exit 1
fi

# Load configuration
CONFIG_FILE=".relay-config.json"
FIRST_PANE_IS_LEADER="true"

if [ -f "$CONFIG_FILE" ]; then
    # Parse firstPaneIsLeader from JSON
    FIRST_PANE_IS_LEADER=$(grep -o '"firstPaneIsLeader":\s*[a-z]*' "$CONFIG_FILE" | grep -o '[a-z]*$')
    if [ -z "$FIRST_PANE_IS_LEADER" ]; then
        FIRST_PANE_IS_LEADER="true"
    fi
    echo -e "${CYAN}Loaded configuration from $CONFIG_FILE${NC}"
    echo -e "${CYAN}  First pane is leader: ${FIRST_PANE_IS_LEADER}${NC}"
    echo ""
else
    echo -e "${YELLOW}No .relay-config.json found, using default configuration${NC}"
    echo -e "${YELLOW}  First pane is leader: true${NC}"
    echo ""
fi

# Check if Extension HTTP server is running (port 3773)
echo -e "${BLUE}Checking Extension server...${NC}"
if curl -s --connect-timeout 2 http://localhost:3773 > /dev/null 2>&1; then
    echo -e "${GREEN}Extension server is running on port 3773${NC}"
else
    echo -e "${YELLOW}Warning: Extension server not responding on port 3773${NC}"
    echo "Make sure the Terminal Relay extension is installed and active in VS Code/Cursor."
    echo ""
fi

# Get actual terminal count from extension
TERMINAL_COUNT=$(curl -s "http://localhost:3773/list" | grep -c '\[' || echo "0")
if [ "$TERMINAL_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}Warning: Could not detect terminals, using default 3${NC}"
    TERMINAL_COUNT=3
fi
echo -e "${CYAN}Detected ${TERMINAL_COUNT} terminals${NC}"
echo ""

# Generate roles based on actual terminal count and firstPaneIsLeader
ROLE_ARRAY=()
if [[ "$FIRST_PANE_IS_LEADER" == "true" ]]; then
    ROLE_ARRAY+=("leader")
    for ((i=1; i<TERMINAL_COUNT; i++)); do
        ROLE_ARRAY+=("member_${i}")
    done
else
    for ((i=1; i<=TERMINAL_COUNT; i++)); do
        ROLE_ARRAY+=("member_${i}")
    done
fi

echo -e "${CYAN}Roles: ${ROLE_ARRAY[*]}${NC}"
echo ""

# Create logs directory
mkdir -p logs

# Check if fswatch is installed
if ! command -v fswatch &> /dev/null; then
    echo -e "${RED}Error: fswatch is not installed${NC}"
    echo "Install it with: brew install fswatch"
    exit 1
fi

echo -e "${GREEN}Starting file watchers...${NC}"
echo ""

# Start file watchers based on generated roles
PIDS=""

for role in "${ROLE_ARRAY[@]}"; do
    INBOX_FILE="relay/inbox/${role}.yaml"

    # Check if inbox file exists
    if [ ! -f "$INBOX_FILE" ]; then
        echo -e "${YELLOW}  Skipping ${role} (no inbox file)${NC}"
        continue
    fi

    # Start watcher for this role
    (
        fswatch -o "$INBOX_FILE" 2>/dev/null | while read; do
            if [ -f "./scripts/notify_${role}.sh" ]; then
                ./scripts/notify_${role}.sh
            else
                # Generic notification for custom roles
                afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true
            fi
        done
    ) &
    PID=$!

    # Convert role name to proper case for display
    DISPLAY_NAME=$(echo "$role" | sed 's/_/ /g' | sed 's/\b\(.\)/\u\1/')
    echo -e "  ${DISPLAY_NAME} watcher (PID: $PID)"

    if [ -z "$PIDS" ]; then
        PIDS="$PID"
    else
        PIDS="$PIDS $PID"
    fi
done

# Save PIDs for cleanup
echo "$PIDS" > .watcher_pids

echo ""
echo -e "${GREEN}File watchers started successfully${NC}"
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Configuration${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "  Terminal count: ${CYAN}${TERMINAL_COUNT}${NC}"
echo -e "  First pane is leader: ${CYAN}${FIRST_PANE_IS_LEADER}${NC}"
echo -e "  Roles: ${CYAN}${ROLE_ARRAY[*]}${NC}"
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Send Role Info to Terminals${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Send role information to each terminal
if curl -s --connect-timeout 2 http://localhost:3773 > /dev/null 2>&1; then
    # First, show terminal indices
    curl -s "http://localhost:3773/identify" > /dev/null 2>&1

    # Then send role information to each terminal
    pane_index=0
    for role in "${ROLE_ARRAY[@]}"; do
        # Determine instruction file based on role
        if [[ "$role" == "leader" ]]; then
            INSTRUCTION_FILE="leader.md"
        else
            INSTRUCTION_FILE="member.md"
        fi

        # Send role message to terminal (on same line as index)
        ROLE_MSG=" | Your role: ${role}. instructions/${INSTRUCTION_FILE} を読んでください。"
        ENCODED_MSG=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${ROLE_MSG}'))")
        curl -s "http://localhost:3773/send?terminal=${pane_index}&text=${ENCODED_MSG}" > /dev/null 2>&1
        echo -e "  Terminal ${pane_index}: ${role} -> sent"
        ((pane_index++))
    done

    echo ""
    echo -e "${GREEN}Role information sent to all terminals${NC}"
    echo -e "${YELLOW}Check each Claude Code pane for role assignment${NC}"
else
    echo -e "${YELLOW}Extension not running, skipping role info${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Role Assignments${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

pane_index=0
for role in "${ROLE_ARRAY[@]}"; do
    # Determine instruction file based on role
    if [[ "$role" == "leader" ]]; then
        INSTRUCTION_FILE="leader.md"
    else
        INSTRUCTION_FILE="member.md"
    fi

    # Convert role name for display
    DISPLAY_NAME=$(echo "$role" | sed 's/_/ /g')

    echo -e "  ${YELLOW}Terminal ${pane_index}:${NC} ${DISPLAY_NAME}"
    echo -e "     Instructions: instructions/${INSTRUCTION_FILE}"
    ((pane_index++))
done

echo ""
echo -e "${BLUE}Communication scripts:${NC}"
echo "  Send task:     ./scripts/to_write.sh relay/to/<role>.yaml <from> \"message\""
echo "  Send report:   ./scripts/from_write.sh relay/from/<role>.yaml <status> \"message\""
echo "  Mark done:     ./scripts/mark_done.sh relay/to/<role>.yaml <seq>"
echo "  Check pending: ./scripts/check_pending.sh relay/to/<role>.yaml"
echo ""
echo -e "${BLUE}To stop:${NC} Ctrl+C or run: pkill -f fswatch"
echo ""

# Trap for cleanup on exit
trap 'echo ""; echo "Stopping watchers..."; kill $PIDS 2>/dev/null; rm -f .watcher_pids; echo "Stopped."; exit 0' SIGINT SIGTERM

# Wait for signals
wait

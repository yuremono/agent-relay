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
if [ -f "$CONFIG_FILE" ]; then
    # Parse roles from JSON (simple extraction without jq dependency)
    ROLES=$(grep -o '"roles":\s*\[[^]]*\]' "$CONFIG_FILE" | sed 's/"roles":\s*\[//' | sed 's/\]//' | tr -d '"' | tr -d ' ' | tr ',' ' ')
    TERMINAL_COUNT=$(grep -o '"terminalCount":\s*[0-9]*' "$CONFIG_FILE" | grep -o '[0-9]*')

    if [ -z "$ROLES" ]; then
        echo -e "${YELLOW}Warning: Could not parse roles from config, using defaults${NC}"
        ROLES="officer leader member_1 member_2"
    fi

    echo -e "${CYAN}Loaded configuration from $CONFIG_FILE${NC}"
    echo -e "${CYAN}  Roles: $(echo $ROLES | tr ' ' ', ')${NC}"
    echo ""
else
    echo -e "${YELLOW}No .relay-config.json found, using default configuration${NC}"
    ROLES="officer leader member_1 member_2"
    echo ""
fi

# Convert roles to array
ROLE_ARRAY=($ROLES)

# Check if Extension HTTP server is running (port 3773)
echo -e "${BLUE}Checking Extension server...${NC}"
if curl -s --connect-timeout 2 http://localhost:3773 > /dev/null 2>&1; then
    echo -e "${GREEN}Extension server is running on port 3773${NC}"
else
    echo -e "${YELLOW}Warning: Extension server not responding on port 3773${NC}"
    echo "Make sure the Terminal Relay extension is installed and active in VS Code/Cursor."
    echo ""
fi

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

# Start file watchers based on roles
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
echo -e "  Roles: ${CYAN}$(echo $ROLES | tr ' ' ', ')${NC}"
echo -e "  Number of terminals: ${CYAN}${#ROLE_ARRAY[@]}${NC}"
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Next Steps${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "  1. In VS Code/Cursor terminal, split into ${#ROLE_ARRAY[@]} panes:"
echo "     Cmd+\\ (multiple times) or Terminal > Split Terminal"
echo ""
echo "  2. Start Claude Code in each pane:"

# Generate dynamic pane instructions
pane_index=0
for role in "${ROLE_ARRAY[@]}"; do
    # Determine model based on role
    if [[ "$role" == "officer" ]] || [[ "$role" == "leader" ]]; then
        MODEL="opus"
    else
        MODEL="sonnet"
    fi

    # Convert role name for display
    DISPLAY_NAME=$(echo "$role" | sed 's/_/ /g')

    echo -e "     ${YELLOW}Pane ${pane_index}:${NC} claude --model ${MODEL}    # ${DISPLAY_NAME}"
    ((pane_index++))
done

echo ""
echo "  3. Each agent reads its instruction file:"
for role in "${ROLE_ARRAY[@]}"; do
    echo "     - ${role}: instructions/${role}.md"
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

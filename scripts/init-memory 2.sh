#!/usr/bin/env bash
# First-time setup: copies memory templates to actual memory files
set -e
TEMPLATES_DIR="memory/templates"
TARGET_DIR="memory"
for f in SOUL.md IDENTITY.md AGENTS.md TOOLS.md HEARTBEAT.md MEMORY.md SCRATCHPAD.md; do
  if [ ! -f "$TARGET_DIR/$f" ] && [ -f "$TEMPLATES_DIR/$f" ]; then
    cp "$TEMPLATES_DIR/$f" "$TARGET_DIR/$f"
    echo "Created $TARGET_DIR/$f from template"
  fi
done
echo "Memory initialized. Edit $TARGET_DIR/*.md to customize."

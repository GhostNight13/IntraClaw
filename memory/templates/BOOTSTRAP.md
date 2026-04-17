# {AGENT_NAME} — BOOTSTRAP.md

Order in which memory files are loaded at agent start:

1. `SOUL.md`     — identity and principles
2. `USER.md`     — who the user is
3. `MEMORY.md`   — long-term facts
4. `HEARTBEAT.md` — live operational state
5. `AGENTS.md`   — capability list
6. `TOOLS.md`    — available tools

After loading, the agent:
1. Checks configured API credentials
2. Starts the scheduler
3. Enters its main loop

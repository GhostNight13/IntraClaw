# Security Policy

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for security problems.

Instead, report privately by opening a
[GitHub Security Advisory](https://github.com/OWNER/IntraClaw/security/advisories/new)
or emailing the maintainers directly.

We aim to acknowledge reports within 48 hours and release a fix or mitigation
within 14 days depending on severity.

## Supported Versions

Only the latest release on `main` receives security updates.

## Scope

In-scope vulnerabilities include:

- Authentication bypass (Telegram/Discord/Slack guards)
- Secret leakage (env vars, API keys, tokens)
- Remote code execution through skills, tools, or shell-exec
- Prompt injection leading to data exfiltration or destructive actions
- SQL injection in the SQLite layer
- Path traversal in file-ops
- Command injection in shell-exec bypass

## Out of Scope

- Issues in third-party dependencies (report upstream instead)
- Self-DoS via resource exhaustion on the local machine
- Social engineering of the user

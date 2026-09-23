# Orchestrator

Local runner for briefing per-project Claude Agent SDK agents from a chat UI, with optional auto-create of Notion tickets from the agent's output.

## Setup (first run)

This repo ships without any machine-specific config — do this once after cloning, **before** `npm run dev`:

1. **Install deps**
   ```bash
   npm install
   ```

2. **Env vars** — copy the template and fill it in:
   ```bash
   cp .env.example .env
   ```
   - `AUTH_SECRET` — required. Signs the login session cookie; generate with `openssl rand -hex 32`. There is no default — sign-in fails loudly without it.
   - `ALLOWED_PROJECT_ROOT` — required. Absolute root directory the app is allowed to scan/run agents in. Any project path registered outside this root is shown disabled.
   - `NOTION_TOKEN_<NAME>` — one per Notion integration token you want selectable in the chat UI. The variable name must match the `env` column you set in `workflow/notion-accounts.md` (step 3).
   - Leave `ANTHROPIC_API_KEY` unset — the Agent SDK uses your logged-in Claude Code subscription; setting it switches billing to the Console API instead.

3. **Workflow registry** — copy the templates and fill in your own data:
   ```bash
   cp workflow/projects.md.example workflow/projects.md
   cp workflow/notion-accounts.md.example workflow/notion-accounts.md
   cp workflow/sessions.md.example workflow/sessions.md
   cp workflow/users.json.example workflow/users.json
   ```
   - `workflow/projects.md` — one row per project: `id`, `label`, absolute `path` (must live inside `ALLOWED_PROJECT_ROOT`).
   - `workflow/notion-accounts.md` — one row per Notion account: `id`, `label`, `env` (the env var name from step 2), `workspace`, `user` (the owning user's `id` from `workflow/users.json`; leave empty to share the account with everyone).
   - `workflow/users.json` — one entry per person who may sign in: `id`, `username`, `label`, and `passwordHash` (always `null` for now). Add users by editing this file; there is no sign-up page.
   - `workflow/sessions.md` — session log, starts empty; the app appends to it as you chat.

   These files plus `workflow/briefs/` and `workflow/auth-sessions/` hold machine-specific/local data and are gitignored — never commit your filled-in versions.

4. **Per-project `.claude/` scaffold** — each project listed in `workflow/projects.md` needs its own `.claude/` folder at its root:
   ```
   .claude/
     agents/<agent-name>.md   # required: frontmatter name + description
     docs/*.md                # optional: reference material for the agent
     rules/tasking.md         # required: hard rules, read in full every session
   ```
   Without this the project shows as incomplete in the picker. If a project needs Notion auto-create tickets, also add `.claude/docs/NOTION_TASK_SCHEMA.md` (database ID + full property list). The in-app onboarding modal (pencil icon in the top bar) has a copy-pasteable AI setup prompt that generates this scaffold for you.

5. **Run it**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000), sign in with a username from `workflow/users.json`, then pick project / agent / Notion account and start a brief.

## Setup

Full setup guide: [`docs/setup.md`](docs/setup.md) — installing the local agent,
registering project folders (including write access), and preparing the Notion
integration. The same content is in the onboarding modal inside the app.

With a local agent paired, the project list comes from **your machine**, not
from `workflow/projects.md`, and `ALLOWED_PROJECT_ROOT` does not apply. Both are
the fallback for running Orchestrator on the same machine as the projects.

## Security: sign-in is username-only

There is no password. Anyone who can reach the server and knows a username can
sign in as that person, read their chat history, and use the Notion token bound
to them. This is identification, not authentication.

Run this on localhost or a trusted LAN only. Do not expose it to the internet
before passwords or OAuth are added.

## Stack

Next.js (App Router) + Claude Agent SDK, chat UI streams agent output over SSE and can parse a trailing ` ```json ` ticket block into a Notion page via `/api/notion/create-ticket`.

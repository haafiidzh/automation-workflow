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
   - `ALLOWED_PROJECT_ROOT` — required. Absolute root directory the app is allowed to scan/run agents in. Any project path registered outside this root is shown disabled.
   - `NOTION_TOKEN_<NAME>` — one per Notion integration token you want selectable in the chat UI. The variable name must match the `env` column you set in `workflow/notion-accounts.md` (step 3).
   - Leave `ANTHROPIC_API_KEY` unset — the Agent SDK uses your logged-in Claude Code subscription; setting it switches billing to the Console API instead.

3. **Workflow registry** — copy the templates and fill in your own data:
   ```bash
   cp workflow/projects.md.example workflow/projects.md
   cp workflow/notion-accounts.md.example workflow/notion-accounts.md
   cp workflow/sessions.md.example workflow/sessions.md
   ```
   - `workflow/projects.md` — one row per project: `id`, `label`, absolute `path` (must live inside `ALLOWED_PROJECT_ROOT`).
   - `workflow/notion-accounts.md` — one row per Notion account: `id`, `label`, `env` (the env var name from step 2), `workspace`.
   - `workflow/sessions.md` — session log, starts empty; the app appends to it as you chat.

   These three files plus `workflow/briefs/` hold machine-specific/local data and are gitignored — never commit your filled-in versions.

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
   Open [http://localhost:3000](http://localhost:3000), pick project / agent / Notion account, and start a brief.

## Stack

Next.js (App Router) + Claude Agent SDK, chat UI streams agent output over SSE and can parse a trailing ` ```json ` ticket block into a Notion page via `/api/notion/create-ticket`.

# Setting up Orchestrator

Full setup guide, starting from a clean machine. The content here mirrors the
first four tabs of the onboarding modal (the question-mark icon in the top
bar), written separately so it stays readable when the app itself can't be
opened yet.

The order below has been tested end to end. Follow it in sequence.

- [1. Local agent](#1-local-agent)
- [2. Project folders](#2-project-folders)
- [3. Notion](#3-notion)
- [4. The `.claude/` structure](#4-the-claude-structure)
- [5. Without a local agent](#5-without-a-local-agent)

Platform: the local agent is currently **Linux x86_64** only. Windows and
macOS are not supported yet.

---

## 1. Local agent

Orchestrator's agent runs on a server. The server cannot read your computer's
disk, and a browser cannot hand a whole folder over to a website. The local
agent closes that gap: the browser — not the server — calls
`http://127.0.0.1:47821`, then forwards the result into the chat session.

### 1.1 Install the binary

```sh
mkdir -p ~/.local/bin
curl -fsSL https://<orchestrator-host>/local-agent/orchestrator-agent-linux-amd64 \
  -o ~/.local/bin/orchestrator-agent
chmod +x ~/.local/bin/orchestrator-agent
```

Building it yourself (needs Go 1.22+):

```sh
cd local-agent && ./build.sh
install -m755 dist/orchestrator-agent-linux-amd64 ~/.local/bin/orchestrator-agent
```

Make sure `~/.local/bin` is on your `PATH`.

### 1.2 Allow the Orchestrator origin

Without this step the browser blocks every request to the agent (CORS), and
the symptom looks like "the agent isn't running".

```sh
orchestrator-agent allow-origin https://orchestrator.example.com
```

Enter the origin exactly as it appears in the address bar, with no trailing
slash. The onboarding modal fills this in automatically from the page you're
on.

### 1.3 Start it

```sh
orchestrator-agent run
```

Default port is `47821`. If it's taken, the agent walks up to `47830`; the
Orchestrator page probes the same range, so a port conflict doesn't break
pairing.

Start it automatically at login:

```sh
mkdir -p ~/.config/systemd/user
cp local-agent/orchestrator-agent.service ~/.config/systemd/user/
systemctl --user enable --now orchestrator-agent
```

### 1.4 Pair it

```sh
orchestrator-agent token
```

Copy the output, open Orchestrator, click the hard-drive icon in the top bar,
paste the token, press **Pair**. A green dot means it worked. The same dialog
lists the allowed folders and their mode.

The token is stored in the browser's `localStorage` and never sent to the
Orchestrator server.

---

## 2. Project folders

**The project list in Orchestrator comes from your machine, not from the
server.** A folder that isn't registered here is refused with `403` — that's
intended behavior, not a bug.

### 2.1 Register a folder

```sh
orchestrator-agent allow ~/projects/app-x --id app-x --label "App X"
```

- Without `--id` and `--label`, both are derived from the folder name.
- `id` must be unique and match `^[a-z0-9][a-z0-9_-]*$`. An id already used by
  another folder is rejected with a clear message, never silently overwritten.
- Folders are registered **read-only**.

### 2.2 Write access

Write access is separate from read access and is granted per folder. Before
this step, the agent cannot create or modify any file.

```sh
orchestrator-agent allow-write ~/projects/app-x     # agent may modify files
orchestrator-agent revoke-write ~/projects/app-x    # back to read-only
```

Folders marked `rw` show a **read+write** badge in the pairing dialog, with a
warning. Refusals are enforced by the local agent (`403`), not the server.

### 2.3 Verify

```sh
orchestrator-agent status
```

Prints the id, label, mode and path of every folder, plus the allowed
origins.

### 2.4 Two computers means two lists

The project list is a property of the **machine**, not of the account. If you
work from two computers, register the folders on each one. This is
intentional: a path valid on laptop A may not exist on laptop B.

---

## 3. Notion

Unlike the project list, the Notion accounts **stay server configuration** —
the token lives in a server env var, and Notion blocks calls made directly
from a browser.

### 3.1 Create an internal integration

Open <https://www.notion.so/my-integrations>, create an *internal
integration*, and copy its **Internal Integration Secret**.

### 3.2 Share the database with that integration

Open the target database in Notion → `⋯` menu → **Connections** → pick the
integration.

This is the step people miss most often. The symptom is Notion answering
**`404`** when a ticket is created, not `403`. If you see a `404` even though
the database clearly exists, the integration almost certainly hasn't been
shared with it.

### 3.3 Put the token in a server env var

```sh
NOTION_TOKEN_PERSONAL=secret_xxx
```

The token lives in the server's `.env` and is **never shown in the UI**.
Never paste a token into the chat.

### 3.4 Register the row

In `workflow/notion-accounts.md`:

```markdown
| id | label | env | workspace | user |
|---|---|---|---|---|
| jarvis | Jarvis | NOTION_TOKEN_PERSONAL | Digitamaze | u_hafidz |
```

- The `env` column holds the **name** of the env var, not its value.
- The `user` column holds the owning user's id (see `workflow/users.json`).
  Leave it empty when the account is shared by everyone.

An account shows as available in the UI once its env var is filled in.

### 3.5 Match the ticket schema

The database's property layout is documented in the project's
`.claude/docs/NOTION_TASK_SCHEMA.md` (see the next section). The agent reads
that file to know which fields to fill when creating a ticket.

---

## 4. The `.claude/` structure

A new folder counts as a valid project once it contains:

```
<project>/
  .claude/
    agents/            # at least one .md file with name + description frontmatter
    docs/               # documents the agent reads, including NOTION_TASK_SCHEMA.md
    rules/
      tasking.md       # REQUIRED — without it the project is marked incomplete
```

If `.claude/rules/tasking.md` is missing, the project shows up as
*incomplete* in the dropdown, and a chat session is refused for the same
reason.

The **AI setup prompt** tab in the onboarding modal has a ready-to-use prompt
for generating this structure from an existing repo.

---

## 5. Without a local agent

Running Orchestrator on the same machine as the projects is still fully
supported. In this mode:

- The project list is read from `workflow/projects.md` in the Orchestrator
  repo.
- Every path must sit inside `ALLOWED_PROJECT_ROOT` (see `.env`); otherwise
  the project shows as disabled.
- The agent uses the built-in `Read`/`Glob`/`Grep` tools, which read the
  server's disk.

Once a local agent is paired, both limits above stop applying: the project
list comes from the agent, and the agent's own allow-list decides what can be
read or written.

---

## Server env vars

| Var | Purpose |
| --- | --- |
| `AUTH_SECRET` | Required. HMAC key for the login cookie, at least 32 characters (`openssl rand -hex 32`). |
| `ANTHROPIC_API_KEY` | **Leave unset.** The Agent SDK uses your logged-in Claude Code credentials (subscription); setting this switches billing to the Console API. |
| `ALLOWED_PROJECT_ROOT` | Project path limit, **only for the no-local-agent mode**. |
| `NOTION_TOKEN_*` | One per Notion account, matching the `env` column in `notion-accounts.md`. |

## See also

- `local-agent/README.md` — full HTTP API and the agent's security model.
- `README.md` — how to run Orchestrator, and the login security notes.

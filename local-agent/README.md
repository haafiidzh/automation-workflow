# Orchestrator local agent

A small standalone binary that runs on **your** machine and lets the
Orchestrator web app read files from folders you explicitly allow.

Orchestrator's AI agent runs on a server. Server-side `Read`/`Glob`/`Grep` can
only ever see the server's disk, and a browser cannot hand a whole folder to a
website. This agent closes that gap: the browser (not the server) calls
`http://127.0.0.1:47821`, and forwards the result to the chat session.

```
[Browser on the Orchestrator site]
        |  fetch() to http://127.0.0.1:47821  (with your pairing token)
        v
[orchestrator-agent — this binary]
        |  direct filesystem access, limited to allow-listed folders
        v
[Your local filesystem]
```

Linux x86_64 only for now. Windows/macOS builds are deferred.

## Install

Pre-built binary:

```sh
curl -fsSL https://<your-orchestrator-host>/local-agent/install.sh | sh
```

From source (needs Go 1.22+):

```sh
git clone <this repo> && cd orchestrator/local-agent
./build.sh                       # -> dist/orchestrator-agent-linux-amd64
install -m755 dist/orchestrator-agent-linux-amd64 ~/.local/bin/orchestrator-agent
```

## Set up

```sh
orchestrator-agent allow /path/to/your/project          # folders it may read
orchestrator-agent allow-origin https://your-host       # the Orchestrator site
orchestrator-agent run                                  # start it
orchestrator-agent token                                # paste into the web UI
```

Then open Orchestrator, click the drive icon in the top bar, and paste the
token. The indicator turns green once the agent answers.

Start it automatically at login:

```sh
mkdir -p ~/.config/systemd/user
cp orchestrator-agent.service ~/.config/systemd/user/
systemctl --user enable --now orchestrator-agent
```

## Commands

| Command | What it does |
| --- | --- |
| `run` | Start the HTTP server on `127.0.0.1` (default) |
| `token` | Print the pairing token |
| `allow <folder>... [--id <id>] [--label <text>]` | Add folders to the allow-list, read-only |
| `allow-write <folder>...` | Let the agent create and modify files in these folders |
| `revoke-write <folder>...` | Put these folders back to read-only |
| `allow-origin <url>...` | Add a browser origin allowed by CORS |
| `status` | Show config path, folders with id/label/mode, origins, size limit |

Each allow-listed folder **is** a project in Orchestrator. The `id` defaults to
a slug of the folder name and must match `^[a-z0-9][a-z0-9_-]*$`; an id already
taken by another folder is rejected rather than silently overwritten. Every
machine keeps its own list, so a second computer needs its own `allow` calls.

## HTTP API

Every endpoint except `/health` requires `Authorization: Bearer <token>` and a
path inside an allow-listed folder.

| Endpoint | Returns |
| --- | --- |
| `GET /health` | `{"status":"ok","version":…,"roots":N}` — unauthenticated liveness probe, never reveals paths |
| `GET /projects` | `{"projects":[{id,label,path,mode}]}` — the project list for the picker |
| `GET /list?path=<folder>` | `{"path":…,"entries":[{name,path,isDir,size}]}` |
| `GET /read?path=<file>` | `{"path":…,"size":…,"content":"…"}` — UTF-8 text only, max 1MB |
| `GET /glob?pattern=<glob>&cwd=<folder>` | `{"cwd":…,"matches":[paths],"truncated":bool}` — `**` supported |
| `GET /grep?pattern=<regex>&cwd=<folder>[&glob=…][&limit=…]` | `{"cwd":…,"matches":[{path,line,text}],"truncated":bool}` |
| `GET /roots` | `{"roots":[{id,label,path,mode}]}` — same data as `/projects`, for the permissions UI |
| `POST /write` | Body `{"path":…,"content":…}`. Full overwrite, max 5MB. Needs a `rw` root |
| `POST /mkdir` | Body `{"path":…}`. Creates the folder and its parents. Needs a `rw` root |

Status codes: `401` no/invalid token, `403` path outside the allow-list or in a
read-only root, `405` wrong method, `413` over the size limit, `415` not UTF-8
text or a missing `Content-Type: application/json` on a write.

Quick check:

```sh
curl "http://127.0.0.1:47821/health"
curl -H "Authorization: Bearer $(orchestrator-agent token)" \
  "http://127.0.0.1:47821/list?path=$PWD"
```

## Security model

- Binds `127.0.0.1` only — never reachable from the network.
- Every request needs the token from `~/.orchestrator-agent/config.json`
  (mode `0600`); requests without it get `401`.
- Paths are resolved through symlinks and must sit inside an allow-listed
  folder, so a link inside an allowed folder cannot escape it.
- CORS headers are sent only for origins you added with `allow-origin`, so
  other sites open in your browser cannot read responses.
- Writing is off by default and granted per folder. A root stays `ro` until
  `allow-write` is run for it, and `POST /write` to a `ro` root is `403`.
- Nothing is ever deleted, and no endpoint executes commands.
- Writes resolve symlinks on the **parent** directory (the target may not exist
  yet) and re-check a final component that is itself a symlink, so a link cannot
  be used to write outside an allow-listed folder. A target that exists but is
  not a regular file is refused.
- Writes are atomic: content goes to a temporary file in the destination
  directory, is `fsync`ed, then renamed over the target. A dropped connection
  cannot leave a half-written source file. An existing file keeps its
  permissions; a new one is `0644`, a new directory `0755`.
- Write endpoints require the bearer token AND an allow-listed origin AND
  `Content-Type: application/json`. The content type matters: a cross-origin
  HTML form cannot send JSON, so simple-form CSRF cannot reach them.

Config file:

```json
{
  "token": "…",
  "allowedRoots": [
    { "id": "app-x", "label": "App X", "path": "/home/you/project", "mode": "ro" }
  ],
  "allowedOrigins": ["https://your-orchestrator-host"],
  "maxFileSize": 1048576
}
```

Configs written by an earlier version, where `allowedRoots` was a list of plain
path strings, are migrated on first start: the id and label are derived from the
folder name and the mode is `ro`. The migration runs once and is idempotent.

## Ports

The default port is `47821`. If it is taken, the agent walks up to `47830`;
the web UI probes the same range, so a conflict does not break pairing.

## Publishing a release

`./build.sh` writes `dist/orchestrator-agent-linux-amd64` plus a `.sha256`.
`dist/` is gitignored — publish the pair to GitHub Releases, or copy them next
to `install.sh` under a static path served by the Orchestrator host (e.g.
`public/local-agent/`), and point `ORCHESTRATOR_AGENT_BASE_URL` at it.

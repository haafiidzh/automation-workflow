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
| `allow <folder>...` | Add folders to the allow-list |
| `allow-origin <url>...` | Add a browser origin allowed by CORS |
| `status` | Show config path, folders, origins, size limit |

## HTTP API

Every endpoint except `/health` requires `Authorization: Bearer <token>` and a
path inside an allow-listed folder.

| Endpoint | Returns |
| --- | --- |
| `GET /health` | `{"status":"ok","version":…,"roots":N}` — unauthenticated liveness probe |
| `GET /list?path=<folder>` | `{"path":…,"entries":[{name,path,isDir,size}]}` |
| `GET /read?path=<file>` | `{"path":…,"size":…,"content":"…"}` — UTF-8 text only, max 1MB |
| `GET /glob?pattern=<glob>&cwd=<folder>` | `{"cwd":…,"matches":[paths],"truncated":bool}` — `**` supported |
| `GET /grep?pattern=<regex>&cwd=<folder>[&glob=…][&limit=…]` | `{"cwd":…,"matches":[{path,line,text}],"truncated":bool}` |

Status codes: `401` no/invalid token, `403` path outside the allow-list,
`413` file over the size limit, `415` not UTF-8 text.

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
- Read-only: there is no endpoint that writes, deletes or executes anything.

Config file:

```json
{
  "token": "…",
  "allowedRoots": ["/home/you/project"],
  "allowedOrigins": ["https://your-orchestrator-host"],
  "maxFileSize": 1048576
}
```

## Ports

The default port is `47821`. If it is taken, the agent walks up to `47830`;
the web UI probes the same range, so a conflict does not break pairing.

## Publishing a release

`./build.sh` writes `dist/orchestrator-agent-linux-amd64` plus a `.sha256`.
`dist/` is gitignored — publish the pair to GitHub Releases, or copy them next
to `install.sh` under a static path served by the Orchestrator host (e.g.
`public/local-agent/`), and point `ORCHESTRATOR_AGENT_BASE_URL` at it.

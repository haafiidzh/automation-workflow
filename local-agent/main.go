package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

const version = "0.1.0"

// defaultPort is the first port tried; portRange more are tried if it is taken
// so a stale process or another app does not block startup.
const (
	defaultPort = 47821
	portRange   = 10
)

func main() {
	cfg, err := LoadConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, "config error:", err)
		os.Exit(1)
	}

	args := os.Args[1:]
	cmd := "run"
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		cmd, args = args[0], args[1:]
	}

	switch cmd {
	case "run":
		runServer(cfg)
	case "token":
		fmt.Println(cfg.Snapshot().Token)
	case "allow":
		folders, id, label, err := parseAllowArgs(args)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
		if len(folders) > 1 && id != "" {
			fmt.Fprintln(os.Stderr, "--id can only be given for a single folder")
			os.Exit(2)
		}
		for _, p := range folders {
			root, err := cfg.AddRoot(p, id, label)
			if err != nil {
				fmt.Fprintln(os.Stderr, "cannot allow", p+":", err)
				os.Exit(1)
			}
			fmt.Printf("allowed: %s (id %s, label %q, %s)\n", root.Path, root.ID, root.Label, root.Mode)
		}
	case "allow-write", "revoke-write":
		if len(args) == 0 {
			fmt.Fprintln(os.Stderr, "usage: orchestrator-agent "+cmd+" <folder>")
			os.Exit(2)
		}
		mode := ModeRW
		if cmd == "revoke-write" {
			mode = ModeRO
		}
		for _, p := range args {
			root, err := cfg.SetRootMode(p, mode)
			if err != nil {
				fmt.Fprintln(os.Stderr, "cannot change mode for", p+":", err)
				os.Exit(1)
			}
			fmt.Printf("%s is now %s\n", root.Path, root.Mode)
		}
	case "allow-origin":
		if len(args) == 0 {
			fmt.Fprintln(os.Stderr, "usage: orchestrator-agent allow-origin <https://your-orchestrator-host>")
			os.Exit(2)
		}
		for _, o := range args {
			if err := cfg.AddOrigin(o); err != nil {
				fmt.Fprintln(os.Stderr, "cannot allow origin", o+":", err)
				os.Exit(1)
			}
			fmt.Println("origin allowed:", o)
		}
	case "status":
		snap := cfg.Snapshot()
		fmt.Println("config:  ", cfg.Path())
		fmt.Println("version: ", version)
		if len(snap.AllowedRoots) == 0 {
			fmt.Println("folders:  (none)")
		} else {
			fmt.Println("folders:")
			for _, r := range snap.AllowedRoots {
				fmt.Printf("  %-16s %-20s %-4s %s\n", r.ID, r.Label, r.Mode, r.Path)
			}
		}
		fmt.Println("origins: ", strings.Join(snap.AllowedOrigins, ", "))
		fmt.Printf("max file size: %d bytes\n", snap.MaxFileSize)
	case "help", "-h", "--help":
		usage()
	default:
		fmt.Fprintln(os.Stderr, "unknown command:", cmd)
		usage()
		os.Exit(2)
	}
}

// parseAllowArgs splits `allow` arguments into folders and the optional
// --id / --label flags, which may appear in any position.
func parseAllowArgs(args []string) (folders []string, id, label string, err error) {
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--id", "--label":
			if i+1 >= len(args) {
				return nil, "", "", fmt.Errorf("%s needs a value", args[i])
			}
			if args[i] == "--id" {
				id = args[i+1]
			} else {
				label = args[i+1]
			}
			i++
		default:
			folders = append(folders, args[i])
		}
	}
	if len(folders) == 0 {
		return nil, "", "", fmt.Errorf("usage: orchestrator-agent allow <folder> [--id <id>] [--label <text>]")
	}
	return folders, id, label, nil
}

func usage() {
	fmt.Println(`orchestrator-agent — local filesystem bridge for Orchestrator

Commands:
  run                      start the HTTP server on 127.0.0.1 (default)
  token                    print the pairing token to paste into the web UI
  allow <folder>...        allow the agent to serve these folders (read-only)
      --id <id>            project id shown to Orchestrator (single folder only)
      --label <text>       project label shown to Orchestrator
  allow-write <folder>...  let the agent modify files in these folders
  revoke-write <folder>... put these folders back to read-only
  allow-origin <url>...    allow a browser origin (your Orchestrator host)
  status                   show config path, folders and origins`)
}

func runServer(cfg *Config) {
	srv := &server{cfg: cfg}

	ln, port, err := listen()
	if err != nil {
		fmt.Fprintln(os.Stderr, "cannot bind a port:", err)
		os.Exit(1)
	}

	snap := cfg.Snapshot()
	fmt.Printf("orchestrator-agent %s listening on http://127.0.0.1:%d\n", version, port)
	fmt.Println("config:", cfg.Path())
	if len(snap.AllowedRoots) == 0 {
		fmt.Println("warning: no folders allow-listed yet — run: orchestrator-agent allow <folder>")
	} else {
		for _, r := range snap.AllowedRoots {
			fmt.Printf("serving: %s (%s, %s)\n", r.Path, r.ID, r.Mode)
		}
	}

	httpSrv := &http.Server{
		Handler:           srv.routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	if err := httpSrv.Serve(ln); err != nil {
		fmt.Fprintln(os.Stderr, "server stopped:", err)
		os.Exit(1)
	}
}

// listen binds 127.0.0.1 only — never 0.0.0.0 — so nothing outside this
// machine can reach the agent. It walks a small port range on conflict.
func listen() (net.Listener, int, error) {
	var lastErr error
	for port := defaultPort; port < defaultPort+portRange; port++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err == nil {
			return ln, port, nil
		}
		lastErr = err
	}
	return nil, 0, lastErr
}

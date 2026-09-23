package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

const (
	maxGlobResults = 1000
	maxGrepResults = 500
	maxLineLength  = 2000
)

type server struct {
	cfg *Config
}

type entry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"isDir"`
	Size  int64  `json:"size"`
}

type grepMatch struct {
	Path string `json:"path"`
	Line int    `json:"line"`
	Text string `json:"text"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// pathError maps an allow-list rejection to 403 and everything else to 400.
func (s *server) pathError(w http.ResponseWriter, err error) {
	var forbidden errForbidden
	if errors.As(err, &forbidden) {
		writeErr(w, http.StatusForbidden, forbidden.msg)
		return
	}
	writeErr(w, http.StatusBadRequest, err.Error())
}

// cors applies the origin allow-list and answers preflight requests. Only the
// origins the user paired (the Orchestrator deployment) may call the agent
// from a browser.
func (s *server) cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if !s.cfg.OriginAllowed(origin) {
				// No CORS headers: the browser blocks the response. Non-browser
				// callers still need a valid token, checked below.
				if r.Method == http.MethodOptions {
					w.WriteHeader(http.StatusForbidden)
					return
				}
			} else {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				w.Header().Set("Access-Control-Max-Age", "600")
				w.Header().Set("Vary", "Origin")
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

// auth rejects any request without the pairing token.
func (s *server) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Picks up allow/allow-write/revoke-write/allow-origin run from a
		// separate CLI invocation while this server is already running.
		s.cfg.MaybeReload()
		tok := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		tok = strings.TrimSpace(tok)
		if !s.cfg.TokenMatches(tok) {
			writeErr(w, http.StatusUnauthorized, "missing or invalid token")
			return
		}
		next(w, r)
	}
}

func (s *server) routes() http.Handler {
	mux := http.NewServeMux()
	// /health is unauthenticated on purpose: the web UI probes it to show
	// connected/disconnected state before the user has pasted a token. It
	// leaks nothing but liveness and the number of allow-listed folders.
	mux.HandleFunc("/health", s.cors(s.handleHealth))
	// /projects is the project picker's source of truth. It leaks absolute
	// paths from the user's machine, so unlike /health it requires the token.
	mux.HandleFunc("/projects", s.cors(s.auth(s.handleProjects)))
	// /roots is the same data under the name the UI uses when it is showing
	// permissions rather than projects. Authenticated for the same reason.
	mux.HandleFunc("/roots", s.cors(s.auth(s.handleRoots)))
	mux.HandleFunc("/list", s.cors(s.auth(s.handleList)))
	mux.HandleFunc("/read", s.cors(s.auth(s.handleRead)))
	mux.HandleFunc("/glob", s.cors(s.auth(s.handleGlob)))
	mux.HandleFunc("/grep", s.cors(s.auth(s.handleGrep)))
	// Write endpoints. They need the token AND an allow-listed origin AND a
	// JSON content type, and only touch roots explicitly marked rw.
	mux.HandleFunc("/write", s.cors(s.auth(s.handleWrite)))
	mux.HandleFunc("/mkdir", s.cors(s.auth(s.handleMkdir)))
	return mux
}

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request) {
	s.cfg.MaybeReload()
	snap := s.cfg.Snapshot()
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"version": version,
		"roots":   len(snap.AllowedRoots),
	})
}

func (s *server) allowedRoots() Roots {
	roots := s.cfg.Snapshot().AllowedRoots
	if roots == nil {
		return Roots{}
	}
	return roots
}

func (s *server) handleProjects(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"projects": s.allowedRoots()})
}

func (s *server) handleRoots(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"roots": s.allowedRoots()})
}

func (s *server) handleList(w http.ResponseWriter, r *http.Request) {
	dir, err := s.cfg.CheckPath(r.URL.Query().Get("path"))
	if err != nil {
		s.pathError(w, err)
		return
	}
	items, err := os.ReadDir(dir)
	if err != nil {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}
	out := make([]entry, 0, len(items))
	for _, it := range items {
		info, err := it.Info()
		var size int64
		if err == nil && !it.IsDir() {
			size = info.Size()
		}
		out = append(out, entry{
			Name:  it.Name(),
			Path:  filepath.Join(dir, it.Name()),
			IsDir: it.IsDir(),
			Size:  size,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"path": dir, "entries": out})
}

func (s *server) handleRead(w http.ResponseWriter, r *http.Request) {
	file, err := s.cfg.CheckPath(r.URL.Query().Get("path"))
	if err != nil {
		s.pathError(w, err)
		return
	}
	info, err := os.Stat(file)
	if err != nil {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}
	if info.IsDir() {
		writeErr(w, http.StatusBadRequest, "path is a directory; use /list")
		return
	}
	max := s.cfg.Snapshot().MaxFileSize
	if info.Size() > max {
		writeErr(w, http.StatusRequestEntityTooLarge,
			fmt.Sprintf("file is %d bytes, over the %d byte limit", info.Size(), max))
		return
	}
	raw, err := os.ReadFile(file)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !utf8.Valid(raw) {
		writeErr(w, http.StatusUnsupportedMediaType, "file is not valid UTF-8 text")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"path":    file,
		"size":    info.Size(),
		"content": string(raw),
	})
}

func (s *server) handleGlob(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	pattern := q.Get("pattern")
	if pattern == "" {
		writeErr(w, http.StatusBadRequest, "pattern is required")
		return
	}
	root, err := s.cfg.CheckPath(q.Get("cwd"))
	if err != nil {
		s.pathError(w, err)
		return
	}

	matches := []string{}
	truncated := false
	err = filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // unreadable entries are skipped, not fatal
		}
		if d.IsDir() {
			if p != root && skipDir[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		rel, relErr := filepath.Rel(root, p)
		if relErr != nil {
			return nil
		}
		if matchGlob(pattern, rel) {
			matches = append(matches, p)
			if len(matches) >= maxGlobResults {
				truncated = true
				return filepath.SkipAll
			}
		}
		return nil
	})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"cwd":       root,
		"matches":   matches,
		"truncated": truncated,
	})
}

func (s *server) handleGrep(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	patternStr := q.Get("pattern")
	if patternStr == "" {
		writeErr(w, http.StatusBadRequest, "pattern is required")
		return
	}
	re, err := regexp.Compile(patternStr)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid regex: "+err.Error())
		return
	}
	root, err := s.cfg.CheckPath(q.Get("cwd"))
	if err != nil {
		s.pathError(w, err)
		return
	}
	include := q.Get("glob")
	limit := maxGrepResults
	if v := q.Get("limit"); v != "" {
		if n, convErr := strconv.Atoi(v); convErr == nil && n > 0 && n < maxGrepResults {
			limit = n
		}
	}
	maxSize := s.cfg.Snapshot().MaxFileSize

	matches := []grepMatch{}
	truncated := false
	_ = filepath.WalkDir(root, func(p string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if d.IsDir() {
			if p != root && skipDir[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		rel, relErr := filepath.Rel(root, p)
		if relErr != nil {
			return nil
		}
		if include != "" && !matchGlob(include, rel) {
			return nil
		}
		info, infoErr := d.Info()
		if infoErr != nil || info.Size() > maxSize {
			return nil
		}
		raw, readErr := os.ReadFile(p)
		if readErr != nil || !utf8.Valid(raw) {
			return nil
		}
		for i, line := range strings.Split(string(raw), "\n") {
			if !re.MatchString(line) {
				continue
			}
			if len(line) > maxLineLength {
				line = line[:maxLineLength] + "…"
			}
			matches = append(matches, grepMatch{Path: p, Line: i + 1, Text: line})
			if len(matches) >= limit {
				truncated = true
				return filepath.SkipAll
			}
		}
		return nil
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"cwd":       root,
		"matches":   matches,
		"truncated": truncated,
	})
}

// maxWriteSize caps a single /write body. Source files are far below this; the
// limit exists so a runaway agent cannot fill the user's disk in one request.
const maxWriteSize = 5 << 20

// requireJSONPost enforces POST plus an explicit JSON content type. The content
// type matters: a cross-origin HTML form can only send urlencoded, plain text
// or multipart bodies, so requiring JSON removes simple-form CSRF entirely,
// on top of the bearer token and the origin allow-list.
func (s *server) requireJSONPost(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "this endpoint requires POST")
		return false
	}
	ct := strings.ToLower(strings.TrimSpace(strings.Split(r.Header.Get("Content-Type"), ";")[0]))
	if ct != "application/json" {
		writeErr(w, http.StatusUnsupportedMediaType, "Content-Type must be application/json")
		return false
	}
	return true
}

// decodeJSON reads a size-capped JSON body, answering 413 when it is too big.
func decodeJSON(w http.ResponseWriter, r *http.Request, limit int64, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeErr(w, http.StatusRequestEntityTooLarge,
				fmt.Sprintf("body is over the %d byte limit", limit))
			return false
		}
		writeErr(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return false
	}
	return true
}

type writeRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

func (s *server) handleWrite(w http.ResponseWriter, r *http.Request) {
	if !s.requireJSONPost(w, r) {
		return
	}
	var req writeRequest
	// The JSON envelope is larger than the content it carries, so the reader
	// limit is generous and the content itself is checked exactly below.
	if !decodeJSON(w, r, maxWriteSize*2, &req) {
		return
	}
	if int64(len(req.Content)) > maxWriteSize {
		writeErr(w, http.StatusRequestEntityTooLarge,
			fmt.Sprintf("content is %d bytes, over the %d byte limit", len(req.Content), maxWriteSize))
		return
	}

	target, err := s.cfg.CheckWritePath(req.Path)
	if err != nil {
		s.pathError(w, err)
		return
	}

	written, err := atomicWrite(target, []byte(req.Content))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"path":    target,
		"size":    written,
		"created": true,
	})
}

type mkdirRequest struct {
	Path string `json:"path"`
}

func (s *server) handleMkdir(w http.ResponseWriter, r *http.Request) {
	if !s.requireJSONPost(w, r) {
		return
	}
	var req mkdirRequest
	if !decodeJSON(w, r, 1<<16, &req) {
		return
	}
	target, err := s.cfg.CheckMkdirPath(req.Path)
	if err != nil {
		s.pathError(w, err)
		return
	}
	if err := os.MkdirAll(target, 0o755); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"path": target})
}

// atomicWrite writes through a temporary file in the destination directory and
// renames it into place, so a crash or a dropped bridge can never leave a
// half-written source file behind. An existing file keeps its permissions.
func atomicWrite(target string, data []byte) (int, error) {
	dir := filepath.Dir(target)
	perm := os.FileMode(0o644)
	if info, err := os.Stat(target); err == nil {
		perm = info.Mode().Perm()
	}

	tmp, err := os.CreateTemp(dir, ".orchestrator-agent-*")
	if err != nil {
		return 0, err
	}
	tmpName := tmp.Name()
	cleanup := func() {
		tmp.Close()
		os.Remove(tmpName)
	}

	n, err := tmp.Write(data)
	if err != nil {
		cleanup()
		return 0, err
	}
	if err := tmp.Sync(); err != nil {
		cleanup()
		return 0, err
	}
	if err := tmp.Chmod(perm); err != nil {
		cleanup()
		return 0, err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		return 0, err
	}
	if err := os.Rename(tmpName, target); err != nil {
		os.Remove(tmpName)
		return 0, err
	}
	return n, nil
}

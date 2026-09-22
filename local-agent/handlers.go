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
	mux.HandleFunc("/list", s.cors(s.auth(s.handleList)))
	mux.HandleFunc("/read", s.cors(s.auth(s.handleRead)))
	mux.HandleFunc("/glob", s.cors(s.auth(s.handleGlob)))
	mux.HandleFunc("/grep", s.cors(s.auth(s.handleGrep)))
	return mux
}

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request) {
	snap := s.cfg.Snapshot()
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"version": version,
		"roots":   len(snap.AllowedRoots),
	})
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

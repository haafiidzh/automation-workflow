package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// Config is persisted at ~/.orchestrator-agent/config.json. It holds the
// pairing token the web UI must send on every request, plus the absolute
// folders this agent is allowed to serve.
type Config struct {
	Token string `json:"token"`
	// AllowedRoots are absolute, symlink-resolved folder paths.
	AllowedRoots []string `json:"allowedRoots"`
	// AllowedOrigins are the browser origins permitted by CORS.
	AllowedOrigins []string `json:"allowedOrigins"`
	// MaxFileSize caps /read responses, in bytes.
	MaxFileSize int64 `json:"maxFileSize"`

	path string
	mu   sync.RWMutex
}

const defaultMaxFileSize = 1 << 20 // 1MB

func configDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".orchestrator-agent"), nil
}

// LoadConfig reads the config file, creating it with a fresh random token on
// first run.
func LoadConfig() (*Config, error) {
	dir, err := configDir()
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	path := filepath.Join(dir, "config.json")

	cfg := &Config{path: path}
	raw, err := os.ReadFile(path)
	switch {
	case err == nil:
		if err := json.Unmarshal(raw, cfg); err != nil {
			return nil, fmt.Errorf("config.json is not valid JSON: %w", err)
		}
		cfg.path = path
	case os.IsNotExist(err):
		// first run
	default:
		return nil, err
	}

	changed := false
	if cfg.Token == "" {
		tok, err := randomToken()
		if err != nil {
			return nil, err
		}
		cfg.Token = tok
		changed = true
	}
	if cfg.MaxFileSize <= 0 {
		cfg.MaxFileSize = defaultMaxFileSize
		changed = true
	}
	if cfg.AllowedRoots == nil {
		cfg.AllowedRoots = []string{}
		changed = true
	}
	if cfg.AllowedOrigins == nil {
		cfg.AllowedOrigins = []string{}
		changed = true
	}
	if changed {
		if err := cfg.save(); err != nil {
			return nil, err
		}
	}
	return cfg, nil
}

func randomToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// save writes the config with 0600 perms — the token is a secret.
func (c *Config) save() error {
	raw, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(c.path, append(raw, '\n'), 0o600)
}

func (c *Config) Path() string { return c.path }

func (c *Config) Snapshot() Config {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return Config{
		Token:          c.Token,
		AllowedRoots:   append([]string{}, c.AllowedRoots...),
		AllowedOrigins: append([]string{}, c.AllowedOrigins...),
		MaxFileSize:    c.MaxFileSize,
	}
}

// AddRoot resolves p and appends it to the allow-list.
func (c *Config) AddRoot(p string) (string, error) {
	abs, err := resolveAbs(p)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", fmt.Errorf("%s is not a directory", abs)
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	for _, existing := range c.AllowedRoots {
		if existing == abs {
			return abs, nil
		}
	}
	c.AllowedRoots = append(c.AllowedRoots, abs)
	return abs, c.save()
}

func (c *Config) AddOrigin(origin string) error {
	origin = strings.TrimRight(strings.TrimSpace(origin), "/")
	if origin == "" {
		return nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, existing := range c.AllowedOrigins {
		if existing == origin {
			return nil
		}
	}
	c.AllowedOrigins = append(c.AllowedOrigins, origin)
	return c.save()
}

func (c *Config) OriginAllowed(origin string) bool {
	origin = strings.TrimRight(origin, "/")
	c.mu.RLock()
	defer c.mu.RUnlock()
	for _, o := range c.AllowedOrigins {
		if o == origin || o == "*" {
			return true
		}
	}
	return false
}

func (c *Config) TokenMatches(tok string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return tok != "" && tok == c.Token
}

// resolveAbs turns p into an absolute, symlink-resolved path. Symlinks are
// resolved so an allow-listed root cannot be escaped by a link inside it.
func resolveAbs(p string) (string, error) {
	if strings.HasPrefix(p, "~") {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		p = filepath.Join(home, strings.TrimPrefix(p, "~"))
	}
	abs, err := filepath.Abs(p)
	if err != nil {
		return "", err
	}
	resolved, err := filepath.EvalSymlinks(abs)
	if err != nil {
		// Path may not exist yet; fall back to the lexical absolute path.
		return filepath.Clean(abs), nil
	}
	return resolved, nil
}

// CheckPath resolves p and verifies it sits inside one of the allow-listed
// roots. Every filesystem endpoint must call this before touching disk.
func (c *Config) CheckPath(p string) (string, error) {
	if p == "" {
		return "", fmt.Errorf("path is required")
	}
	abs, err := resolveAbs(p)
	if err != nil {
		return "", err
	}

	c.mu.RLock()
	roots := append([]string{}, c.AllowedRoots...)
	c.mu.RUnlock()

	if len(roots) == 0 {
		return "", errForbidden{"no folder has been allow-listed yet; run: orchestrator-agent allow <folder>"}
	}
	for _, root := range roots {
		if abs == root || strings.HasPrefix(abs, root+string(os.PathSeparator)) {
			return abs, nil
		}
	}
	return "", errForbidden{fmt.Sprintf("path %s is outside the allow-listed folders", abs)}
}

type errForbidden struct{ msg string }

func (e errForbidden) Error() string { return e.msg }

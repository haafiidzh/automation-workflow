package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Config is persisted at ~/.orchestrator-agent/config.json. It holds the
// pairing token the web UI must send on every request, plus the absolute
// folders this agent is allowed to serve.
type Config struct {
	Token string `json:"token"`
	// AllowedRoots are the folders this agent serves. Each one is a project as
	// far as Orchestrator is concerned — this list is the source of truth for
	// the project picker, so the server never needs its own registry.
	AllowedRoots Roots `json:"allowedRoots"`
	// AllowedOrigins are the browser origins permitted by CORS.
	AllowedOrigins []string `json:"allowedOrigins"`
	// MaxFileSize caps /read responses, in bytes.
	MaxFileSize int64 `json:"maxFileSize"`

	path string
	mu   sync.RWMutex
	// lastMod is the config file's mtime as of the last (re)load, so
	// MaybeReload can skip the read+unmarshal when nothing changed.
	lastMod time.Time
}

// Mode values for a root. Read-only is the default so upgrading an agent never
// silently grants write access to a folder the user allowed before.
const (
	ModeRO = "ro"
	ModeRW = "rw"
)

// Root is one allow-listed folder, presented to Orchestrator as a project.
type Root struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Path  string `json:"path"`
	Mode  string `json:"mode"`
}

func (r Root) Writable() bool { return r.Mode == ModeRW }

// Roots exists to carry the migration from the milestone 1 shape, where a root
// was a bare path string. Decoding accepts both shapes; encoding only ever
// writes the object shape, so the file is rewritten once and stays migrated.
type Roots []Root

var idPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]*$`)

// slugify derives an id from a folder name. Anything outside the id alphabet
// becomes a dash; a leading non-alphanumeric is dropped.
func slugify(name string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(name) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '_', r == '-':
			b.WriteRune(r)
		default:
			b.WriteRune('-')
		}
	}
	out := strings.Trim(b.String(), "-_")
	if out == "" || !idPattern.MatchString(out) {
		return "root"
	}
	return out
}

func (rs *Roots) UnmarshalJSON(raw []byte) error {
	var items []json.RawMessage
	if err := json.Unmarshal(raw, &items); err != nil {
		return err
	}
	out := make(Roots, 0, len(items))
	for _, item := range items {
		var legacy string
		if err := json.Unmarshal(item, &legacy); err == nil {
			base := filepath.Base(legacy)
			out = append(out, Root{ID: slugify(base), Label: base, Path: legacy, Mode: ModeRO})
			continue
		}
		var root Root
		if err := json.Unmarshal(item, &root); err != nil {
			return fmt.Errorf("allowedRoots entry is neither a path nor a root object: %w", err)
		}
		if root.Path == "" {
			return fmt.Errorf("allowedRoots entry has no path")
		}
		if root.Mode != ModeRW {
			root.Mode = ModeRO
		}
		if root.ID == "" {
			root.ID = slugify(filepath.Base(root.Path))
		}
		if root.Label == "" {
			root.Label = filepath.Base(root.Path)
		}
		out = append(out, root)
	}
	*rs = dedupeRoots(out)
	return nil
}

// dedupeRoots keeps migration idempotent: a duplicate path is dropped, and an
// id collision is suffixed rather than silently shadowing another root.
func dedupeRoots(in Roots) Roots {
	seenPath := map[string]bool{}
	seenID := map[string]bool{}
	out := make(Roots, 0, len(in))
	for _, r := range in {
		if seenPath[r.Path] {
			continue
		}
		seenPath[r.Path] = true
		id := r.ID
		for n := 2; seenID[id]; n++ {
			id = fmt.Sprintf("%s-%d", r.ID, n)
		}
		r.ID = id
		seenID[id] = true
		out = append(out, r)
	}
	return out
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
		cfg.AllowedRoots = Roots{}
		changed = true
	}
	// If the file still holds the milestone 1 shape, decoding has already
	// migrated it in memory; write it back once so the next run is a no-op.
	if migrated, err := rootsNeedRewrite(raw, cfg.AllowedRoots); err == nil && migrated {
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
	if info, statErr := os.Stat(path); statErr == nil {
		cfg.lastMod = info.ModTime()
	}
	return cfg, nil
}

// rootsNeedRewrite reports whether the on-disk roots differ from the decoded
// (migrated) ones, so the config is rewritten exactly once.
func rootsNeedRewrite(raw []byte, decoded Roots) (bool, error) {
	if len(raw) == 0 {
		return false, nil
	}
	var onDisk struct {
		AllowedRoots []json.RawMessage `json:"allowedRoots"`
	}
	if err := json.Unmarshal(raw, &onDisk); err != nil {
		return false, err
	}
	if len(onDisk.AllowedRoots) != len(decoded) {
		return true, nil
	}
	for i, item := range onDisk.AllowedRoots {
		var probe Root
		if err := json.Unmarshal(item, &probe); err != nil {
			return true, nil // was a bare string
		}
		if probe.ID != decoded[i].ID || probe.Label != decoded[i].Label || probe.Mode != decoded[i].Mode {
			return true, nil
		}
	}
	return false, nil
}

// MaybeReload re-reads the config file when it has changed on disk since the
// last (re)load, so changes made by a CLI subcommand (allow-write, allow,
// allow-origin, ...) reach an already-running `run` process without a
// restart. Each is its own OS process with its own in-memory Config, and only
// the file on disk is shared between them.
//
// Cheap by design: a request handler can call this unconditionally — the
// common case is one os.Stat syscall and nothing else. A reload failure is
// logged and otherwise ignored; the server keeps serving its last-known-good
// config rather than failing requests over it.
func (c *Config) MaybeReload() {
	info, err := os.Stat(c.path)
	if err != nil {
		return
	}

	c.mu.RLock()
	unchanged := info.ModTime().Equal(c.lastMod)
	c.mu.RUnlock()
	if unchanged {
		return
	}

	raw, err := os.ReadFile(c.path)
	if err != nil {
		fmt.Fprintln(os.Stderr, "config reload: cannot read", c.path+":", err)
		return
	}
	var fresh Config
	if err := json.Unmarshal(raw, &fresh); err != nil {
		fmt.Fprintln(os.Stderr, "config reload: invalid JSON in", c.path+":", err)
		return
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	c.Token = fresh.Token
	c.AllowedRoots = fresh.AllowedRoots
	c.AllowedOrigins = fresh.AllowedOrigins
	if fresh.MaxFileSize > 0 {
		c.MaxFileSize = fresh.MaxFileSize
	}
	c.lastMod = info.ModTime()
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
		AllowedRoots:   append(Roots{}, c.AllowedRoots...),
		AllowedOrigins: append([]string{}, c.AllowedOrigins...),
		MaxFileSize:    c.MaxFileSize,
	}
}

// AddRoot resolves p and appends it to the allow-list. An empty id or label is
// derived from the folder name. Re-adding a folder already on the list updates
// its label but never its mode — mode is changed only by allow-write/revoke-write.
func (c *Config) AddRoot(p, id, label string) (Root, error) {
	abs, err := resolveAbs(p)
	if err != nil {
		return Root{}, err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return Root{}, err
	}
	if !info.IsDir() {
		return Root{}, fmt.Errorf("%s is not a directory", abs)
	}

	base := filepath.Base(abs)
	if id == "" {
		id = slugify(base)
	}
	if !idPattern.MatchString(id) {
		return Root{}, fmt.Errorf("id %q is invalid: use lowercase letters, digits, dash and underscore, starting with a letter or digit", id)
	}
	if label == "" {
		label = base
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	for i, existing := range c.AllowedRoots {
		if existing.Path == abs {
			if existing.ID != id {
				if err := c.idFreeLocked(id, abs); err != nil {
					return Root{}, err
				}
			}
			c.AllowedRoots[i].ID = id
			c.AllowedRoots[i].Label = label
			return c.AllowedRoots[i], c.save()
		}
	}
	if err := c.idFreeLocked(id, abs); err != nil {
		return Root{}, err
	}
	root := Root{ID: id, Label: label, Path: abs, Mode: ModeRO}
	c.AllowedRoots = append(c.AllowedRoots, root)
	return root, c.save()
}

// idFreeLocked rejects an id already used by a different folder. Overwriting it
// silently would make one project disappear from the picker with no explanation.
func (c *Config) idFreeLocked(id, ownPath string) error {
	for _, existing := range c.AllowedRoots {
		if existing.ID == id && existing.Path != ownPath {
			return fmt.Errorf("id %q is already used by %s; pick another with --id", id, existing.Path)
		}
	}
	return nil
}

// SetRootMode flips one root between read-only and read-write.
func (c *Config) SetRootMode(p, mode string) (Root, error) {
	abs, err := resolveAbs(p)
	if err != nil {
		return Root{}, err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	for i, existing := range c.AllowedRoots {
		if existing.Path == abs {
			c.AllowedRoots[i].Mode = mode
			return c.AllowedRoots[i], c.save()
		}
	}
	return Root{}, fmt.Errorf("%s is not on the allow-list; run: orchestrator-agent allow %s", abs, p)
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

	_, err = c.rootFor(abs)
	if err != nil {
		return "", err
	}
	return abs, nil
}

// rootFor returns the allow-listed root containing abs.
func (c *Config) rootFor(abs string) (Root, error) {
	c.mu.RLock()
	roots := append(Roots{}, c.AllowedRoots...)
	c.mu.RUnlock()

	if len(roots) == 0 {
		return Root{}, errForbidden{"no folder has been allow-listed yet; run: orchestrator-agent allow <folder>"}
	}
	for _, root := range roots {
		if abs == root.Path || strings.HasPrefix(abs, root.Path+string(os.PathSeparator)) {
			return root, nil
		}
	}
	return Root{}, errForbidden{fmt.Sprintf("path %s is outside the allow-listed folders", abs)}
}

type errForbidden struct{ msg string }

func (e errForbidden) Error() string { return e.msg }

// expandAbs turns p into an absolute, lexically cleaned path WITHOUT resolving
// symlinks. Write paths need this: the target may not exist yet, so symlinks
// are resolved on the parent instead (see CheckWritePath).
func expandAbs(p string) (string, error) {
	if strings.HasPrefix(p, "~") {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		p = filepath.Join(home, strings.TrimPrefix(p, "~"))
	}
	return filepath.Abs(p)
}

// writableRoot resolves abs against the allow-list and refuses read-only roots.
func (c *Config) writableRoot(abs string) error {
	root, err := c.rootFor(abs)
	if err != nil {
		return err
	}
	if !root.Writable() {
		return errForbidden{fmt.Sprintf(
			"folder %s is read-only; run: orchestrator-agent allow-write %s", root.Path, root.Path)}
	}
	return nil
}

// CheckWritePath validates a path a file is about to be written to.
//
// The target itself may not exist, so symlinks are resolved on the PARENT
// directory: if the parent resolves inside a writable root and the final
// component is not a symlink leading out, the write cannot escape. A final
// component that IS a symlink is followed and re-checked before it is used.
func (c *Config) CheckWritePath(p string) (string, error) {
	if p == "" {
		return "", fmt.Errorf("path is required")
	}
	abs, err := expandAbs(p)
	if err != nil {
		return "", err
	}
	base := filepath.Base(abs)
	if base == "." || base == string(os.PathSeparator) || base == ".." {
		return "", fmt.Errorf("path %s has no file name", p)
	}

	resolvedParent, err := filepath.EvalSymlinks(filepath.Dir(abs))
	if err != nil {
		return "", fmt.Errorf("parent folder of %s does not exist", abs)
	}
	if err := c.writableRoot(resolvedParent); err != nil {
		return "", err
	}

	target := filepath.Join(resolvedParent, base)
	info, err := os.Lstat(target)
	if err != nil {
		return target, nil // new file
	}
	if info.Mode()&os.ModeSymlink != 0 {
		resolved, rerr := filepath.EvalSymlinks(target)
		if rerr != nil {
			return "", errForbidden{fmt.Sprintf("%s is a broken symlink", target)}
		}
		if err := c.writableRoot(resolved); err != nil {
			return "", err
		}
		target = resolved
		if st, serr := os.Stat(target); serr == nil && !st.Mode().IsRegular() {
			return "", errForbidden{fmt.Sprintf("%s is not a regular file", target)}
		}
		return target, nil
	}
	if !info.Mode().IsRegular() {
		return "", errForbidden{fmt.Sprintf("%s exists and is not a regular file", target)}
	}
	return target, nil
}

// CheckMkdirPath validates a directory that is about to be created, including
// any missing parents. The nearest existing ancestor is the one resolved
// through symlinks — everything below it is created by this agent.
func (c *Config) CheckMkdirPath(p string) (string, error) {
	if p == "" {
		return "", fmt.Errorf("path is required")
	}
	abs, err := expandAbs(p)
	if err != nil {
		return "", err
	}

	dir := abs
	var missing []string
	for {
		if _, err := os.Lstat(dir); err == nil {
			break
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("no existing parent folder for %s", abs)
		}
		missing = append([]string{filepath.Base(dir)}, missing...)
		dir = parent
	}

	resolved, err := filepath.EvalSymlinks(dir)
	if err != nil {
		return "", fmt.Errorf("cannot resolve %s", dir)
	}
	if err := c.writableRoot(resolved); err != nil {
		return "", err
	}
	return filepath.Join(append([]string{resolved}, missing...)...), nil
}

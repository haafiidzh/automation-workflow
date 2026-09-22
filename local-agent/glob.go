package main

import (
	"path/filepath"
	"strings"
)

// matchGlob reports whether rel (a slash-separated relative path) matches
// pattern. Supports `**` (any number of path segments), plus `*`, `?` and
// character classes within a segment via filepath.Match.
func matchGlob(pattern, rel string) bool {
	pattern = strings.TrimPrefix(filepath.ToSlash(pattern), "./")
	rel = strings.TrimPrefix(filepath.ToSlash(rel), "./")
	return matchSegments(strings.Split(pattern, "/"), strings.Split(rel, "/"))
}

func matchSegments(pat, name []string) bool {
	for len(pat) > 0 {
		if pat[0] == "**" {
			// `**` at the end matches everything below.
			if len(pat) == 1 {
				return true
			}
			// Try consuming 0..n name segments.
			for i := 0; i <= len(name); i++ {
				if matchSegments(pat[1:], name[i:]) {
					return true
				}
			}
			return false
		}
		if len(name) == 0 {
			return false
		}
		ok, err := filepath.Match(pat[0], name[0])
		if err != nil || !ok {
			return false
		}
		pat, name = pat[1:], name[1:]
	}
	return len(name) == 0
}

// skipDir lists directories never worth walking for glob/grep.
var skipDir = map[string]bool{
	".git":         true,
	"node_modules": true,
	".next":        true,
	"dist":         true,
	"build":        true,
	"target":       true,
	"vendor":       true,
	".venv":        true,
	"__pycache__":  true,
}

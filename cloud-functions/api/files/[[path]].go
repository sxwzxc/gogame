package handler

import (
	"encoding/json"
	"net/http"
	"strings"
)

// Handler handles GET /api/files/*path
// [[path]].go is a catch-all route that matches any number of path segments
// e.g. /api/files/docs/guide/intro.md → path = "docs/guide/intro.md"
func Handler(w http.ResponseWriter, r *http.Request) {
	// Extract the catch-all path after /api/files/
	filePath := ""
	prefix := "/api/files/"
	if strings.HasPrefix(r.URL.Path, prefix) {
		filePath = r.URL.Path[len(prefix):]
	}

	// Determine file extension
	ext := ""
	if idx := strings.LastIndex(filePath, "."); idx != -1 {
		ext = filePath[idx:]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"path":      filePath,
		"extension": ext,
		"segments":  strings.Split(filePath, "/"),
		"route":     "/api/files/[[path]]",
		"type":      "catch-all route",
	})
}

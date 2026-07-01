package handler

import (
	"encoding/json"
	"net/http"
)

// Handler handles GET /api/posts
// index.go serves as the default handler for the /api/posts/ directory
func Handler(w http.ResponseWriter, r *http.Request) {
	posts := []map[string]interface{}{
		{"id": 1, "title": "Getting Started with Go Functions", "slug": "getting-started"},
		{"id": 2, "title": "File-Based Routing in Go", "slug": "file-based-routing"},
		{"id": 3, "title": "Deploy Go to EdgeOne Pages", "slug": "deploy-go-edgeone"},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"posts": posts,
		"total": len(posts),
		"route": "/api/posts",
		"type":  "index route (index.go)",
	})
}

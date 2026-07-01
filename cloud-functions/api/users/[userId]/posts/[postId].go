package handler

import (
	"encoding/json"
	"net/http"
	"strings"
)

// Handler handles GET /api/users/:userId/posts/:postId
// Nested dynamic params — both [userId] and [postId] are captured
func Handler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	userId := ""
	postId := ""
	if len(parts) >= 6 {
		userId = parts[3]
		postId = parts[5]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"userId":  userId,
		"postId":  postId,
		"title":   "Post " + postId + " by User " + userId,
		"content": "This is a sample post content.",
		"route":   "/api/users/[userId]/posts/[postId]",
		"type":    "multiple dynamic params",
	})
}

package handler

import (
	"encoding/json"
	"net/http"
	"strings"
)

// Handler handles GET /api/users/:userId
// [userId].go captures the user identifier from the URL
func Handler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	userId := ""
	if len(parts) >= 4 {
		userId = parts[3]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"userId": userId,
		"name":   "User " + userId,
		"email":  userId + "@example.com",
		"route":  "/api/users/[userId]",
		"type":   "single dynamic param",
	})
}

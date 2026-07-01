package handler

import (
	"encoding/json"
	"net/http"
)

// Handler handles GET /hello
func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Hello from Go Functions on EdgeOne Pages!",
		"route":   "/hello",
		"type":    "static route",
	})
}

package router

import (
	"crypto/subtle"
	"net/http"
)

const metricsUser = "prometheus"

func withMetricsAuth(next http.Handler, password string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := r.BasicAuth()
		validUser := subtle.ConstantTimeCompare([]byte(user), []byte(metricsUser)) == 1
		validPass := password != "" && subtle.ConstantTimeCompare([]byte(pass), []byte(password)) == 1

		if !ok || !validUser || !validPass {
			w.Header().Set("WWW-Authenticate", `Basic realm="metrics"`)
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

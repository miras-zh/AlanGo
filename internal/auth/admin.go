package auth

import "net/http"

type AdminTypeGetter func(userID uint) (string, error)

var adminTypes = map[string]bool{
	"editor": true,
	"admin":  true,
	"root":   true,
}

func RequireAdminType(getType AdminTypeGetter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := GetUserID(r)
			if !ok {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			actualType, err := getType(userID)
			if err != nil || !adminTypes[actualType] {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

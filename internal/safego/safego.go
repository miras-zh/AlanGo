package safego

import (
	"log"
	"runtime/debug"
)

// Go runs fn in a new goroutine with a panic recovery guard so a bug in a
// fire-and-forget background task (email, push notification, audit log) logs
// a stack trace instead of crashing the whole API process.
func Go(fn func()) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("safego: recovered panic: %v\n%s", r, debug.Stack())
			}
		}()
		fn()
	}()
}

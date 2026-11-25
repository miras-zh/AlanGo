package netutil

import (
	"net"
	"net/http"
	"strings"
)

// TrustedProxyChecker extracts the real client IP while only trusting
// X-Forwarded-For / X-Real-IP headers when the direct peer is a trusted proxy.
type TrustedProxyChecker struct {
	nets []*net.IPNet
}

// NewTrustedProxyChecker parses a comma-separated list of CIDRs or single IPs.
func NewTrustedProxyChecker(raw string) *TrustedProxyChecker {
	var nets []*net.IPNet
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if !strings.Contains(part, "/") {
			ip := net.ParseIP(part)
			if ip == nil {
				continue
			}
			bits := 32
			if ip.To4() == nil {
				bits = 128
			}
			nets = append(nets, &net.IPNet{IP: ip, Mask: net.CIDRMask(bits, bits)})
			continue
		}
		if _, cidr, err := net.ParseCIDR(part); err == nil {
			nets = append(nets, cidr)
		}
	}
	return &TrustedProxyChecker{nets: nets}
}

func (c *TrustedProxyChecker) isTrusted(ipStr string) bool {
	if c == nil || len(c.nets) == 0 {
		return false
	}
	ip := net.ParseIP(strings.TrimSpace(ipStr))
	if ip == nil {
		return false
	}
	for _, n := range c.nets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

// ClientIP returns the client's IP address, walking X-Forwarded-For right-to-left
// only when the immediate peer IP belongs to a configured trusted proxy CIDR.
func (c *TrustedProxyChecker) ClientIP(r *http.Request) string {
	if r == nil {
		return ""
	}
	peer := remoteHost(r.RemoteAddr)
	if !c.isTrusted(peer) {
		return peer
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		for i := len(parts) - 1; i >= 0; i-- {
			candidate := strings.TrimSpace(parts[i])
			if candidate == "" {
				continue
			}
			if net.ParseIP(candidate) == nil {
				break
			}
			if !c.isTrusted(candidate) {
				return candidate
			}
		}
		// All hops were trusted proxies; fall back to the leftmost valid IP.
		for _, p := range parts {
			candidate := strings.TrimSpace(p)
			if net.ParseIP(candidate) != nil {
				return candidate
			}
		}
	}
	if xri := strings.TrimSpace(r.Header.Get("X-Real-IP")); xri != "" && net.ParseIP(xri) != nil {
		return xri
	}
	return peer
}

func remoteHost(addr string) string {
	if host, _, err := net.SplitHostPort(addr); err == nil {
		return host
	}
	return strings.TrimSpace(addr)
}

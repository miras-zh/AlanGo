package sport

import "testing"

func f(v float64) *float64 { return &v }

func TestValidateLocation(t *testing.T) {
	cases := []struct {
		name     string
		lat, lng *float64
		wantErr  bool
	}{
		{"none", nil, nil, false},
		{"astana", f(51.128), f(71.43), false},
		{"edges", f(-90), f(180), false},
		{"only lat", f(51), nil, true},
		{"only lng", nil, f(71), true},
		{"lat out of range", f(91), f(71), true},
		{"lng out of range", f(51), f(-181), true},
	}
	for _, c := range cases {
		if got := validateLocation(c.lat, c.lng) != ""; got != c.wantErr {
			t.Errorf("%s: error=%v, want %v", c.name, got, c.wantErr)
		}
	}
}

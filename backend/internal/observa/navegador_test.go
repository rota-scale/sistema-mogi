package observa

import "testing"

func TestNavegador(t *testing.T) {
	casos := map[string]string{
		"Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36":                          "Chrome 130, Android 14",
		"Mozilla/5.0 (Linux; Android 13; SM-A135M) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36":      "Samsung Internet 25, Android 13",
		"Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1":         "Safari 18, iOS 18",
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1": "Chrome 126, iOS 17",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0":                   "Edge 130, Windows 10.0",
		"Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0":                                                                            "Firefox 131, Android 14",
		"curl/8.5.0": ",",
	}
	for ua, esperado := range casos {
		if got := Navegador(ua); got != esperado {
			t.Errorf("%q\n  esperado %q\n  veio     %q", ua, esperado, got)
		}
	}
}

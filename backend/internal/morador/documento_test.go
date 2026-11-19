package morador

import (
	"math/rand/v2"
	"strconv"
	"testing"
)

// cpfGerado monta um CPF válido a partir de 9 dígitos sorteados. Nenhum CPF
// de pessoa real entra nos testes.
func cpfGerado(r *rand.Rand) string {
	base := ""
	for range 9 {
		base += strconv.Itoa(r.IntN(10))
	}
	base += strconv.Itoa(digitoCPF(base))
	return base + strconv.Itoa(digitoCPF(base))
}

func cnpjGerado(r *rand.Rand) string {
	base := ""
	for range 8 {
		base += strconv.Itoa(r.IntN(10))
	}
	base += "0001"
	base += strconv.Itoa(digitoCNPJ(base))
	return base + strconv.Itoa(digitoCNPJ(base))
}

func TestCPF(t *testing.T) {
	// Exemplos de manual, gerados pela conta dos dígitos, sem dono.
	for _, ok := range []string{"52998224725", "11144477735"} {
		if !CPFValido(ok) {
			t.Errorf("%s deveria ser válido", ok)
		}
	}
	for _, ruim := range []string{"52998224724", "11111111111", "1234567890", "123456789012", "5299822472a", ""} {
		if CPFValido(ruim) {
			t.Errorf("%q deveria ser inválido", ruim)
		}
	}
	r := rand.New(rand.NewPCG(1, 2))
	for range 200 {
		c := cpfGerado(r)
		if !todosIguais(c) && !CPFValido(c) {
			t.Fatalf("CPF gerado %s deveria ser válido", c)
		}
	}
}

func TestCNPJ(t *testing.T) {
	for _, ok := range []string{"11222333000181", "11444777000161"} {
		if !CNPJValido(ok) {
			t.Errorf("%s deveria ser válido", ok)
		}
	}
	for _, ruim := range []string{"11222333000180", "00000000000000", "1122233300018", "11.222.333/0001-81"} {
		if CNPJValido(ruim) {
			t.Errorf("%q deveria ser inválido", ruim)
		}
	}
	r := rand.New(rand.NewPCG(3, 4))
	for range 200 {
		if c := cnpjGerado(r); !todosIguais(c) && !CNPJValido(c) {
			t.Fatalf("CNPJ gerado %s deveria ser válido", c)
		}
	}
}

func TestNormalizarAceitaMascaraERecusaOResto(t *testing.T) {
	casos := []struct {
		tipo, doc, quer string
		ok              bool
	}{
		{TipoPF, "529.982.247-25", "52998224725", true},
		{TipoServidor, " 52998224725 ", "52998224725", true},
		{TipoPJ, "11.222.333/0001-81", "11222333000181", true},
		{TipoPJ, "52998224725", "", false},       // CPF onde se espera CNPJ
		{TipoPF, "11222333000181", "", false},    // CNPJ onde se espera CPF
		{TipoPF, "529.982.247-2X", "", false},    // letra
		{TipoPF, "529982247250", "", false},      // dígito a mais
		{"empresa", "11222333000181", "", false}, // tipo desconhecido
		{TipoPF, "529;982;247;25", "", false},    // símbolo estranho
		{TipoPF, "111.111.111-11", "", false},    // todos iguais
	}
	for _, c := range casos {
		got, err := Normalizar(c.tipo, c.doc)
		if (err == nil) != c.ok || got != c.quer {
			t.Errorf("Normalizar(%q, %q) = %q, %v", c.tipo, c.doc, got, err)
		}
	}
}

func TestMascararEFormatar(t *testing.T) {
	if m := Mascarar("52998224725"); m != "***.982.247-**" {
		t.Fatalf("máscara do CPF: %s", m)
	}
	if m := Mascarar("11222333000181"); m != "**.222.333/0001-**" {
		t.Fatalf("máscara do CNPJ: %s", m)
	}
	if Mascarar("123") != "" {
		t.Fatal("tamanho estranho não tem máscara")
	}
	if f := Formatar("52998224725"); f != "529.982.247-25" {
		t.Fatalf("CPF completo: %s", f)
	}
	if f := Formatar("11222333000181"); f != "11.222.333/0001-81" {
		t.Fatalf("CNPJ completo: %s", f)
	}
}

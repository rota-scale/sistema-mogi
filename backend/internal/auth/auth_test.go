package auth

import "testing"

func TestTokenDaEquipeNaoValeComoMorador(t *testing.T) {
	s := Novo(nil, []byte("segredo-de-teste-com-mais-de-32-caracteres"))
	tok, err := s.emitir(Usuario{Login: "gestor", Papel: PapelGestor})
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.ConferirMorador(tok); err == nil {
		t.Fatal("token do gestor não pode valer como cadastro de morador")
	}
	outro := Novo(nil, []byte("outro-segredo-de-teste-com-mais-de-32-car"))
	mor, _ := outro.EmitirMorador("0b6f3c1e-2d7a-4c8e-9f10-1a2b3c4d5e6f", 1)
	if _, _, err := s.ConferirMorador(mor); err == nil {
		t.Fatal("token assinado com outro segredo não vale")
	}
}

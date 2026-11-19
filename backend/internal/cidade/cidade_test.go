package cidade

import "testing"

func TestPadraoPassaNaConferencia(t *testing.T) {
	if err := Padrao().Conferir(); err != nil {
		t.Fatalf("o padrão precisa ser válido: %v", err)
	}
}

func TestMesclarCompletaComOPadrao(t *testing.T) {
	// Documento salvo antes de existirem os módulos e a retenção.
	p, err := Mesclar([]byte(`{"raio_agrupamento_m": 30, "modulos": {"video": false}}`))
	if err != nil {
		t.Fatal(err)
	}
	if p.RaioAgrupamentoM != 30 {
		t.Fatalf("o valor salvo deveria valer, veio %v", p.RaioAgrupamentoM)
	}
	if p.JanelaAgrupamentoDias != 30 || p.RetencaoDias != 90 || p.EnviosPorIP != 120 {
		t.Fatalf("o que falta no documento vale o padrão: %+v", p)
	}
	if p.Modulos.Video || !p.Modulos.Perto || !p.Modulos.Campo || !p.Modulos.Voz || !p.Modulos.Cadastro {
		t.Fatalf("só o vídeo foi desligado: %+v", p.Modulos)
	}
}

func TestMesclarForaDaFaixaVoltaAoPadrao(t *testing.T) {
	p, err := Mesclar([]byte(`{"raio_agrupamento_m": 99999}`))
	if err != nil || p != Padrao() {
		t.Fatalf("documento fora da faixa deveria voltar ao padrão: %+v %v", p, err)
	}
	if _, err := Mesclar([]byte(`{quebrado`)); err == nil {
		t.Fatal("JSON quebrado é erro")
	}
}

func TestConferirRecusaBrechas(t *testing.T) {
	casos := map[string]func(*Parametros){
		"raio zero":               func(p *Parametros) { p.RaioAgrupamentoM = 0 },
		"janela zero":             func(p *Parametros) { p.JanelaAgrupamentoDias = 0 },
		"perto gigante":           func(p *Parametros) { p.RaioPertoM = 5000 },
		"sem limite por aparelho": func(p *Parametros) { p.EnviosPorAparelho = 0 },
		"ip menor que aparelho":   func(p *Parametros) { p.EnviosPorIP = 5 },
		"retenção negativa":       func(p *Parametros) { p.RetencaoDias = -1 },
	}
	for nome, mexer := range casos {
		p := Padrao()
		mexer(&p)
		if p.Conferir() == nil {
			t.Errorf("%s deveria ser recusado", nome)
		}
	}
}

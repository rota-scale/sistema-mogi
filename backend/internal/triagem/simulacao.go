package triagem

import (
	"context"
	"os"
	"path/filepath"
	"strings"
)

// Cenario é um caso de referência do roteiro de campo, usado para conferir
// uma regra antes de salvar (T7).
type Cenario struct {
	Nome      string `json:"cenario"`
	Categoria string `json:"categoria"`
	Texto     string `json:"texto"`
}

// Cenarios cobre as categorias e os sinais críticos de docs/escala-de-prioridade.md.
func Cenarios() []Cenario {
	return []Cenario{
		{"Cano estourado jorrando", "agua", "cano estourado jorrando água"},
		{"Vazamento pequeno", "agua", "vazamento pequeno na calçada"},
		{"Fio caído", "iluminacao", "fio caído na calçada"},
		{"Poste apagado", "iluminacao", "poste apagado"},
		{"Buraco grande na curva", "vias", "buraco grande perto da curva"},
		{"Buraco pequeno", "vias", "buraco na rua"},
		{"Lixo parado", "limpeza", "lixo parado"},
		{"Árvore caída na via", "arvores", "árvore caiu e fechou a rua"},
		{"Poda necessária", "arvores", "galhos precisando de poda"},
		{"Semáforo apagado em cruzamento", "sinalizacao", "semáforo apagado no cruzamento"},
		{"Calçada quebrada", "calcadas", "calçada quebrada"},
		{"Animal morto na via", "animais", "animal morto na rua"},
		{"Relato sem categoria clara", "outros", ""},
	}
}

// Simulado é o resultado de um cenário com a regra em teste.
type Simulado struct {
	Cenario
	Nivel  int    `json:"nivel"`
	Motivo string `json:"motivo"`
	Script string `json:"script"`
	Erro   string `json:"erro,omitempty"`
}

// Simular roda os cenários de referência trocando um arquivo da pasta de
// regras pelo conteúdo informado, sem gravar nada. Serve para o gestor ver
// o efeito de uma mudança de limiar antes de salvar e para recusar script
// que quebra a triagem (C5 com segurança).
func (m MotorLua) Simular(ctx context.Context, arquivo, conteudo string) ([]Simulado, error) {
	base := filepath.Join(m.Dir, m.Cidade)
	ler := func(nome string) (string, error) {
		if nome == arquivo {
			return conteudo, nil
		}
		b, err := os.ReadFile(filepath.Join(base, nome))
		return string(b), err
	}
	existe := func(nome string) bool {
		if nome == arquivo {
			return true
		}
		_, err := os.Stat(filepath.Join(base, nome))
		return err == nil
	}
	comum, err := ler("_comum.lua")
	if err != nil {
		return nil, err
	}
	var saida []Simulado
	for _, c := range Cenarios() {
		script := "padrao.lua"
		if existe(c.Categoria + ".lua") {
			script = c.Categoria + ".lua"
		}
		s := Simulado{Cenario: c, Script: script}
		// Só interessa mostrar os cenários que o arquivo editado alcança.
		if arquivo != "_comum.lua" && arquivo != script {
			continue
		}
		codigo, err := ler(script)
		if err != nil {
			s.Erro = err.Error()
			saida = append(saida, s)
			continue
		}
		cl, _ := ClassificadorLocal{}.Classificar(ctx, Entrada{Categoria: c.Categoria, Texto: c.Texto})
		gut := CalcularGUT(cl.G, cl.U, cl.T)
		regra, err := ExecutarRegra(ctx, comum+"\n"+codigo, map[string]any{
			"categoria": cl.Categoria, "sinais": cl.Sinais, "confianca": cl.Confianca, "relatos": 1,
			"gut": map[string]any{"esperado": gut.Esperada, "p90": gut.Pessimista, "g": gut.G, "u": gut.U, "t": gut.T},
		})
		if err != nil {
			s.Erro = strings.TrimPrefix(err.Error(), "erro na regra: ")
		}
		s.Nivel, s.Motivo = regra.Nivel, regra.Motivo
		saida = append(saida, s)
	}
	return saida, nil
}

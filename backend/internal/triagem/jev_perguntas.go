package triagem

// Perguntas que a triagem faz ao Jev, todas num lugar só para auditar e
// ajustar (ADR 0010). Cada pergunta é um julgamento pequeno; quem decide o
// nível é a regra Lua da prefeitura, em código.
//
// Escritas sem teste contra a API ao vivo: calibrar com relatos reais.

// perguntaCategoria é uma escolha entre as categorias do MOGI. Os nomes das
// opções vão para o modelo, por isso são as palavras da categoria.
const perguntaCategoria = "Que tipo de problema urbano o morador está relatando?"

var criteriosCategoria = map[string]string{
	"agua":        "Água e esgoto: cano estourado, vazamento, esgoto a céu aberto ou bueiro entupido",
	"iluminacao":  "Iluminação e energia: poste apagado, lâmpada queimada ou fio elétrico caído ou solto",
	"vias":        "Vias: buraco, cratera ou asfalto afundado na rua",
	"limpeza":     "Limpeza urbana: lixo acumulado, entulho, caçamba cheia ou mato alto",
	"arvores":     "Árvores: árvore caída, galho quebrado ou árvore que precisa de poda",
	"sinalizacao": "Sinalização de trânsito: semáforo apagado, placa caída ou faixa de pedestre apagada",
	"calcadas":    "Calçadas e praças: calçada quebrada, rampa danificada ou banco e brinquedo de praça quebrados",
	"animais":     "Animais: animal morto, ferido ou solto na via",
	"outros":      "Outro problema de zeladoria em espaço público que não é nenhum dos tipos acima, como pichação ou muro caindo",
}

// perguntaHaProblema acompanha a escolha de categoria: uma Choice sempre
// escolhe uma opção, mesmo quando nada serve.
const perguntaHaProblema = "O relato mostra um problema de zeladoria num espaço público da cidade?"

var criteriosHaProblema = [2]string{
	"Há um problema na rua, na calçada, na praça, na rede de água ou na iluminação pública, visto na foto ou descrito no relato",
	"Não há problema urbano: por exemplo uma selfie, uma foto de tela, uma foto escura ou um relato sobre outro assunto",
}

// perguntaLocalPublico separa o espaço público, que a prefeitura atende, do
// interior de um imóvel. Abaixo de limiarNao, o relato vai para a conferência
// com o motivo "parece local privado" (ADR 0024).
const perguntaLocalPublico = "A foto mostra um espaço público (rua, calçada, praça, prédio público) e não o interior de casa, quintal ou dentro de comércio?"

// perguntasSinais tem uma pergunta sim ou não por sinal de risco
// (docs/escala-de-prioridade.md). Vão todas no mesmo pedido, antes de saber
// a categoria; o código lê só as da categoria escolhida.
var perguntasSinais = map[string]string{
	"agua_jorrando":          "Há água jorrando ou escorrendo com força de um cano ou da rede?",
	"alagamento":             "A água está alagando a rua, a calçada ou imóveis?",
	"perto_de_escola":        "O problema fica na frente ou ao lado de escola, creche ou posto de saúde?",
	"fio_exposto":            "Há fio elétrico caído, solto ou exposto ao alcance de pessoas?",
	"bloqueio_calcada":       "O problema bloqueia a calçada e obriga o pedestre a andar pela rua?",
	"risco_moto":             "O buraco ou defeito na via pode derrubar uma moto ou bicicleta?",
	"via_bloqueada":          "A rua está bloqueada para a passagem de carros?",
	"sobre_fios":             "A árvore ou o galho está encostado ou caído sobre fios elétricos?",
	"cruzamento_movimentado": "O problema fica num cruzamento com trânsito de carros?",
	"acessibilidade":         "O problema impede a passagem de cadeirante ou de pessoa com dificuldade para andar?",
}

// Escalas da matriz GUT. Cada nível é descrito como uma situação que faz
// sentido sozinha; o índice 0 é a nota 1.
const (
	perguntaGravidade = "Qual o dano que este problema causa se nada for feito?"
	perguntaUrgencia  = "Quanto tempo a prefeitura pode esperar para resolver este problema?"
	perguntaTendencia = "Como este problema muda com o tempo se nada for feito?"
)

var criteriosGravidade = []string{
	"Só incomoda a aparência do lugar, sem atrapalhar ninguém",
	"Atrapalha um pouco o uso da rua ou do serviço, sem risco a pessoas",
	"Atrapalha claramente o uso da rua ou do serviço, sem risco direto a pessoas",
	"Pode causar acidente, dano a carros ou casas, ou corta um serviço essencial de muita gente",
	"Põe em risco a vida ou a integridade de pessoas",
}

var criteriosUrgencia = []string{
	"Pode entrar na rotina da equipe, sem prazo",
	"Pode esperar algumas semanas",
	"Pede ação em poucos dias",
	"Pede ação no mesmo dia",
	"Pede ação imediata, em poucas horas",
}

var criteriosTendencia = []string{
	"Fica igual com o tempo",
	"Piora muito devagar, ao longo de meses",
	"Piora aos poucos, ao longo de semanas",
	"Piora rápido, em poucos dias",
	"Piora ou se espalha em poucas horas",
}

// Limiares de leitura de uma pergunta sim ou não, como sugere a TypeSafe:
// acima de 0,7 é sim, abaixo de 0,3 é não, e entre os dois a pergunta não
// está decidida. A calibrar no piloto.
const (
	limiarSim = 0.7
	limiarNao = 0.3
)

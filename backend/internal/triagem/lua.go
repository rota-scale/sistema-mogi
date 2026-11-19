package triagem

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"time"

	lua "github.com/yuin/gopher-lua"
)

// TempoMaximoRegra é o limite de cada execução de regra (RNF07).
const TempoMaximoRegra = 50 * time.Millisecond

// Regra é o que o script devolve.
type Regra struct {
	Nivel  int    `json:"nivel"`
	Motivo string `json:"motivo"`
	Script string `json:"script"`
}

// MotorLua executa as regras de backend/regras/<cidade>/. Os arquivos são
// lidos a cada triagem, então mudar um limiar vale no próximo chamado sem
// novo deploy (C5).
type MotorLua struct {
	Dir    string
	Cidade string
}

var nomeSeguro = regexp.MustCompile(`^[a-z0-9_]+$`)

// Avaliar roda _comum.lua e depois <categoria>.lua (ou padrao.lua) num estado
// novo e isolado, chamando avaliar(t).
func (m MotorLua) Avaliar(ctx context.Context, categoria string, t map[string]any) (Regra, error) {
	if !nomeSeguro.MatchString(m.Cidade) {
		return Regra{}, fmt.Errorf("cidade inválida: %q", m.Cidade)
	}
	base := filepath.Join(m.Dir, m.Cidade)
	script := "padrao.lua"
	if nomeSeguro.MatchString(categoria) {
		if _, err := os.Stat(filepath.Join(base, categoria+".lua")); err == nil {
			script = categoria + ".lua"
		}
	}
	comum, err := os.ReadFile(filepath.Join(base, "_comum.lua"))
	if err != nil {
		return Regra{}, fmt.Errorf("ler _comum.lua: %w", err)
	}
	codigo, err := os.ReadFile(filepath.Join(base, script))
	if err != nil {
		return Regra{}, fmt.Errorf("ler %s: %w", script, err)
	}
	r, err := ExecutarRegra(ctx, string(comum)+"\n"+string(codigo), t)
	r.Script = m.Cidade + "/" + script
	return r, err
}

// ExecutarRegra roda o código Lua em sandbox: só base, table, string e math,
// sem io, os, debug, package nem carregamento de código, com 50 ms de limite.
// gopher-lua não limita memória; esse limite fica no contêiner (ADR 0013).
func ExecutarRegra(ctx context.Context, codigo string, t map[string]any) (Regra, error) {
	L := lua.NewState(lua.Options{SkipOpenLibs: true, CallStackSize: 256, RegistrySize: 1024 * 16})
	defer L.Close()
	for _, lib := range []struct {
		nome string
		fn   lua.LGFunction
	}{
		{lua.BaseLibName, lua.OpenBase},
		{lua.TabLibName, lua.OpenTable},
		{lua.StringLibName, lua.OpenString},
		{lua.MathLibName, lua.OpenMath},
	} {
		L.Push(L.NewFunction(lib.fn))
		L.Push(lua.LString(lib.nome))
		L.Call(1, 0)
	}
	for _, proibida := range []string{"dofile", "loadfile", "load", "loadstring", "require", "module",
		"collectgarbage", "getfenv", "setfenv", "print", "newproxy", "_printregs"} {
		L.SetGlobal(proibida, lua.LNil)
	}
	if s, ok := L.GetGlobal("string").(*lua.LTable); ok {
		s.RawSetString("dump", lua.LNil)
		s.RawSetString("rep", lua.LNil) // evita estourar memória com uma linha
	}

	ctx, cancelar := context.WithTimeout(ctx, TempoMaximoRegra)
	defer cancelar()
	L.SetContext(ctx)

	if err := L.DoString(codigo); err != nil {
		return Regra{}, erroRegra(ctx, err)
	}
	avaliar, ok := L.GetGlobal("avaliar").(*lua.LFunction)
	if !ok {
		return Regra{}, errors.New("regra sem função avaliar(t)")
	}
	if err := L.CallByParam(lua.P{Fn: avaliar, NRet: 1, Protect: true}, paraLua(L, t)); err != nil {
		return Regra{}, erroRegra(ctx, err)
	}
	ret, ok := L.Get(-1).(*lua.LTable)
	if !ok {
		return Regra{}, errors.New("avaliar(t) deve devolver uma tabela { nivel, motivo }")
	}
	nivel, ok := ret.RawGetString("nivel").(lua.LNumber)
	if !ok || nivel < 1 || nivel > 5 || float64(nivel) != float64(int(nivel)) {
		return Regra{}, fmt.Errorf("nível inválido devolvido pela regra: %v", ret.RawGetString("nivel"))
	}
	return Regra{Nivel: int(nivel), Motivo: lua.LVAsString(ret.RawGetString("motivo"))}, nil
}

func erroRegra(ctx context.Context, err error) error {
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return fmt.Errorf("regra passou de %v: %w", TempoMaximoRegra, context.DeadlineExceeded)
	}
	return fmt.Errorf("erro na regra: %w", err)
}

func paraLua(L *lua.LState, v any) lua.LValue {
	switch x := v.(type) {
	case nil:
		return lua.LNil
	case bool:
		return lua.LBool(x)
	case int:
		return lua.LNumber(x)
	case float64:
		return lua.LNumber(x)
	case string:
		return lua.LString(x)
	case map[string]float64:
		tb := L.NewTable()
		for k, val := range x {
			tb.RawSetString(k, lua.LNumber(val))
		}
		return tb
	case map[string]any:
		tb := L.NewTable()
		for k, val := range x {
			tb.RawSetString(k, paraLua(L, val))
		}
		return tb
	case Distribuicao:
		tb := L.NewTable()
		for _, p := range x {
			tb.Append(lua.LNumber(p))
		}
		return tb
	default:
		return lua.LNil
	}
}

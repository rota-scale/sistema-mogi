package banco

import (
	"io/fs"
	"regexp"
	"strings"
	"testing"
)

// Migração só acrescenta ("expandir e depois contrair"): assim a versão
// anterior do servidor continua rodando no banco migrado e o "make voltar"
// é seguro. Remover ou renomear coluna, apagar tabela ou trocar o tipo de
// uma coluna só entra numa versão seguinte, com a linha "-- contrair:"
// explicando por que a versão anterior já não usa aquilo.
var reDestrutivo = regexp.MustCompile(`(?i)\b(DROP\s+(COLUMN|TABLE)|RENAME\s+(COLUMN|TO)|ALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE)\b`)

func TestMigracoesSoAcrescentam(t *testing.T) {
	nomes, err := fs.Glob(migracoes, "migracoes/*.sql")
	if err != nil || len(nomes) == 0 {
		t.Fatalf("migrações: %v %v", nomes, err)
	}
	for _, nome := range nomes {
		b, _ := migracoes.ReadFile(nome)
		sql := string(b)
		if strings.Contains(sql, "-- contrair:") {
			continue
		}
		for i, linha := range strings.Split(sql, "\n") {
			codigo, _, _ := strings.Cut(linha, "--")
			if reDestrutivo.MatchString(codigo) {
				t.Errorf("%s:%d apaga ou muda o que a versão anterior usa: %q (use expandir e depois contrair)", nome, i+1, strings.TrimSpace(linha))
			}
		}
	}
}

func TestReconheceMigracaoDestrutiva(t *testing.T) {
	for _, s := range []string{"ALTER TABLE x DROP COLUMN y;", "DROP TABLE x;", "ALTER TABLE x RENAME COLUMN a TO b;", "ALTER TABLE x ALTER COLUMN a TYPE int;"} {
		if !reDestrutivo.MatchString(s) {
			t.Errorf("não reconheceu: %s", s)
		}
	}
	for _, s := range []string{"ALTER TABLE x ADD COLUMN y text;", "CREATE TABLE x (id int);", "DROP INDEX IF EXISTS i;"} {
		if reDestrutivo.MatchString(s) {
			t.Errorf("recusou sem motivo: %s", s)
		}
	}
}

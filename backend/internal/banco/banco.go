// Package banco abre o pool do Postgres e aplica as migrações embutidas.
package banco

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"sort"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migracoes/*.sql
var migracoes embed.FS

// Abrir conecta ao Postgres e aplica as migrações pendentes.
func Abrir(ctx context.Context, url string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("abrir pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping no banco: %w", err)
	}
	if err := migrar(ctx, pool); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

// travaDeMigracao é a chave da trava consultiva: um número qualquer, fixo.
const travaDeMigracao = 7046641121

func migrar(ctx context.Context, pool *pgxpool.Pool) error {
	// Com mais de uma réplica subindo junto (ou o seed ao lado da API), só
	// uma aplica as migrações; as outras esperam e acham tudo pronto.
	trava, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer trava.Release()
	if _, err := trava.Exec(ctx, `SELECT pg_advisory_lock($1)`, travaDeMigracao); err != nil {
		return fmt.Errorf("trava de migração: %w", err)
	}
	defer func() {
		_, _ = trava.Exec(context.Background(), `SELECT pg_advisory_unlock($1)`, travaDeMigracao)
	}()
	if _, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS migracoes (
		nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())`); err != nil {
		return fmt.Errorf("tabela de migrações: %w", err)
	}
	nomes, err := fs.Glob(migracoes, "migracoes/*.sql")
	if err != nil {
		return err
	}
	sort.Strings(nomes)
	for _, nome := range nomes {
		var existe bool
		if err := pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM migracoes WHERE nome = $1)`, nome).Scan(&existe); err != nil {
			return err
		}
		if existe {
			continue
		}
		sql, err := migracoes.ReadFile(nome)
		if err != nil {
			return err
		}
		tx, err := pool.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("migração %s: %w", nome, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO migracoes (nome) VALUES ($1)`, nome); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	return nil
}

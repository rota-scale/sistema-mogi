// Comando seed cria ou apaga os chamados simulados da demo (SOP 05).
//
//	go run ./cmd/seed -chamados 80   cria chamados simulados em Itamogi
//	go run ./cmd/seed -apagar        remove todos os simulados
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/banco"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/config"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/demo"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/midia"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/ocorrencias"
	"github.com/rota-scale/cidade-inteligente-akcit/backend/internal/triagem"
)

func main() {
	chamados := flag.Int("chamados", 80, "quantos relatos simulados gerar")
	apagar := flag.Bool("apagar", false, "apaga os chamados simulados em vez de criar")
	flag.Parse()
	if err := rodar(*chamados, *apagar); err != nil {
		fmt.Fprintln(os.Stderr, "seed:", err)
		os.Exit(1)
	}
}

func rodar(chamados int, apagar bool) error {
	cfg, err := config.Carregar()
	if err != nil {
		return err
	}
	ctx := context.Background()
	pool, err := banco.Abrir(ctx, cfg.BancoURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	repo := ocorrencias.NovoRepositorio(pool)
	if apagar {
		n, err := repo.ApagarDemo(ctx)
		fmt.Println("chamados simulados apagados:", n)
		return err
	}
	arm, err := midia.NovoS3(ctx, cfg.S3Endpoint, cfg.S3AccessKey, cfg.S3SecretKey, cfg.S3Bucket, cfg.S3SSL)
	if err != nil {
		return err
	}
	n, err := demo.Semear(ctx, pool, repo, arm, triagem.MotorLua{Dir: cfg.RegrasDir, Cidade: cfg.Cidade}, chamados, time.Now())
	fmt.Println("chamados simulados criados:", n)
	return err
}

// Package midia guarda as fotos (ADR 0008) atrás de portas trocáveis:
// Armazenamento (S3 compatível, hoje SeaweedFS) e Borrador (RF03). A mídia
// nunca sai direto do S3: o Go entrega a versão borrada por um link
// assinado de curta duração (veja Assinador).
package midia

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Armazenamento é a porta de gravação e leitura de mídia.
type Armazenamento interface {
	Gravar(ctx context.Context, chave, tipo string, dados []byte) error
	Ler(ctx context.Context, chave string) (dados []byte, tipo string, err error)
	// Pronto confere se o armazenamento responde (usado pelo /saude).
	Pronto(ctx context.Context) error
	// GravarFluxo grava sem carregar o arquivo inteiro na memória (vídeo).
	GravarFluxo(ctx context.Context, chave, tipo string, r io.Reader, tamanho int64) error
	// Abrir devolve o objeto com suporte a salto, para servir com Range.
	Abrir(ctx context.Context, chave string) (Objeto, error)
	// Apagar remove o objeto; apagar o que não existe não é erro.
	Apagar(ctx context.Context, chave string) error
}

// Objeto é uma mídia aberta para leitura com salto.
type Objeto struct {
	io.ReadSeekCloser
	Tipo       string
	Modificado time.Time
}

// S3 é o adaptador para qualquer servidor com API S3 (SeaweedFS, Garage, R2).
type S3 struct {
	cli    *minio.Client
	bucket string
}

func NovoS3(ctx context.Context, endpoint, acesso, segredo, bucket string, ssl bool) (*S3, error) {
	cli, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(acesso, segredo, ""),
		Secure: ssl,
		Region: "us-east-1",
	})
	if err != nil {
		return nil, err
	}
	existe, err := cli.BucketExists(ctx, bucket)
	if err != nil {
		return nil, fmt.Errorf("conferir bucket %s: %w", bucket, err)
	}
	if !existe {
		if err := cli.MakeBucket(ctx, bucket, minio.MakeBucketOptions{Region: "us-east-1"}); err != nil {
			return nil, fmt.Errorf("criar bucket %s: %w", bucket, err)
		}
	}
	return &S3{cli: cli, bucket: bucket}, nil
}

func (s *S3) Gravar(ctx context.Context, chave, tipo string, dados []byte) error {
	_, err := s.cli.PutObject(ctx, s.bucket, chave, bytes.NewReader(dados), int64(len(dados)),
		minio.PutObjectOptions{ContentType: tipo})
	return err
}

func (s *S3) Pronto(ctx context.Context) error {
	existe, err := s.cli.BucketExists(ctx, s.bucket)
	if err == nil && !existe {
		err = fmt.Errorf("bucket %s não existe", s.bucket)
	}
	return err
}

// Ler devolve o objeto inteiro. As fotos têm limite de 15 MB na entrada.
func (s *S3) Ler(ctx context.Context, chave string) ([]byte, string, error) {
	obj, err := s.cli.GetObject(ctx, s.bucket, chave, minio.GetObjectOptions{})
	if err != nil {
		return nil, "", err
	}
	defer obj.Close()
	info, err := obj.Stat()
	if err != nil {
		return nil, "", err
	}
	dados, err := io.ReadAll(io.LimitReader(obj, 20<<20))
	if err != nil {
		return nil, "", err
	}
	return dados, info.ContentType, nil
}

func (s *S3) GravarFluxo(ctx context.Context, chave, tipo string, r io.Reader, tamanho int64) error {
	_, err := s.cli.PutObject(ctx, s.bucket, chave, r, tamanho, minio.PutObjectOptions{ContentType: tipo})
	return err
}

func (s *S3) Abrir(ctx context.Context, chave string) (Objeto, error) {
	obj, err := s.cli.GetObject(ctx, s.bucket, chave, minio.GetObjectOptions{})
	if err != nil {
		return Objeto{}, err
	}
	info, err := obj.Stat()
	if err != nil {
		_ = obj.Close()
		return Objeto{}, err
	}
	return Objeto{ReadSeekCloser: obj, Tipo: info.ContentType, Modificado: info.LastModified}, nil
}

func (s *S3) Apagar(ctx context.Context, chave string) error {
	return s.cli.RemoveObject(ctx, s.bucket, chave, minio.RemoveObjectOptions{})
}

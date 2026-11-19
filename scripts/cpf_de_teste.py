#!/usr/bin/env python3
"""Gera CPF e CNPJ válidos (só os dígitos verificadores certos) para os
testes de fumaça e de conferência. Os números são sorteados: não são de
ninguém de propósito, e nenhum CPF real entra no repositório.

Uso: python3 scripts/cpf_de_teste.py [cpf|cnpj] [--mascara]
"""
import random
import sys


def _digito_cpf(base):
    soma = sum(int(d) * p for d, p in zip(base, range(len(base) + 1, 1, -1)))
    r = soma * 10 % 11
    return '0' if r == 10 else str(r)


def _digito_cnpj(base):
    pesos = [2, 3, 4, 5, 6, 7, 8, 9] * 2
    soma = sum(int(d) * p for d, p in zip(reversed(base), pesos))
    r = soma % 11
    return '0' if r < 2 else str(11 - r)


def cpf(mascara=False):
    while True:
        base = ''.join(random.choice('0123456789') for _ in range(9))
        if len(set(base)) > 1:
            break
    base += _digito_cpf(base)
    d = base + _digito_cpf(base)
    return f'{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}' if mascara else d


def cnpj(mascara=False):
    base = ''.join(random.choice('0123456789') for _ in range(8)) + '0001'
    base += _digito_cnpj(base)
    d = base + _digito_cnpj(base)
    return f'{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}' if mascara else d


def cpf_invalido():
    """Um CPF com o último dígito trocado: falha na conta."""
    d = cpf()
    return d[:10] + str((int(d[10]) + 1) % 10)


if __name__ == '__main__':
    tipo = sys.argv[1] if len(sys.argv) > 1 else 'cpf'
    mascara = '--mascara' in sys.argv
    print({'cpf': cpf, 'cnpj': cnpj}[tipo](mascara))

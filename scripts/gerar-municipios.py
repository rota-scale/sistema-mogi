#!/usr/bin/env python3
"""Gera painel/src/relatar/municipios.json: os municípios do IBGE para a busca
de cidade do cadastro. Cada item é "Nome;UF;código IBGE de 7 dígitos".

Fonte: o arquivo dadosOriginais.txt do pacote npm municipios-ibge (MIT),
copiado da tabela de municípios do IBGE. Uso:

    npm pack municipios-ibge@1.0.1 && tar xzf municipios-ibge-1.0.1.tgz
    python3 scripts/gerar-municipios.py package/dadosOriginais.txt
"""
import json
import sys

UF = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
    "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
    "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS",
    "50": "MS", "51": "MT", "52": "GO", "53": "DF",
}

vistos = {}
with open(sys.argv[1], encoding="utf-8") as f:
    for linha in f:
        partes = linha.rstrip("\n").split("\t")
        if len(partes) != 4 or partes[0] not in UF:
            continue
        cod_uf, _, cod, nome = partes
        ibge = cod_uf + cod
        vistos[ibge] = f"{nome.strip()};{UF[cod_uf]};{ibge}"

saida = sorted(vistos.values())
destino = "painel/src/relatar/municipios.json"
with open(destino, "w", encoding="utf-8") as f:
    json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))
print(len(saida), "municípios em", destino)

# Gera o HTML do kit impresso da visita: a folha do prefeito (página 1, em
# formato comercial), o roteiro de quem apresenta (página 2) e a ficha da rua
# (página 3). Os textos vêm de folha-prefeito.md, visita-prefeitura.md e
# teste-de-campo-itamogi.md: edite lá, não aqui. Uso, na raiz do repositório:
#   pip install markdown
#   python3 docs/pdf/gerar_kit.py . kit.html
# Depois imprima kit.html em PDF (A4) pelo navegador e salve em
# docs/pdf/kit-visita-18-11.pdf.
import html, re, sys
import markdown

R = sys.argv[1]
ler = lambda p: open(f'{R}/{p}', encoding='utf-8').read()
sem_links = lambda s: re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', s)
negrito = lambda s: re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', html.escape(s, quote=False))


def secao(t, inicio, fim=None):
    i = t.index(inicio)
    j = t.index(fim, i + len(inicio)) if fim else len(t)
    return t[i:j]


def linhas_da_tabela(bloco):
    out = []
    for l in bloco.splitlines():
        if l.startswith('|') and not re.match(r'^\|[\s|:-]+\|$', l):
            out.append([c.strip() for c in l.strip().strip('|').split('|')])
    return out


# Página 1: a folha do prefeito, montada como peça comercial.
f = ler('docs/folha-prefeito.md')
titulo = f.splitlines()[0].lstrip('# ').strip()
chamada = re.search(r'^\*\*(.+)\*\*$', f, re.M).group(1)
beneficios = [l for l in linhas_da_tabela(secao(f, '## O que muda', '## Como funciona')) if l[0]]
passos = linhas_da_tabela(secao(f, '## Como funciona', '## Para começar'))
comecar = [l[2:] for l in secao(f, '## Para começar').splitlines() if l.startswith('- ')]
rodape = [l for l in secao(f, '## Para começar').splitlines() if l.startswith('**Rota Scale**')][0]
logo = ler('painel/public/logo.svg')

cartoes = ''.join(
    f'<div class="cartao"><h3>{negrito(b[0]).replace("<b>", "").replace("</b>", "")}</h3><p>{negrito(b[1])}</p></div>'
    for b in beneficios
)
etapas = ''.join(
    f'<div class="passo"><span>{i + 1}</span><h3>{html.escape(t.split(". ", 1)[-1])}</h3><p>{negrito(d)}</p></div>'
    for i, (t, d) in enumerate(zip(passos[0], passos[1]))
)
itens = ''.join(f'<li>{negrito(c)}</li>' for c in comecar)
folha = f'''<section class="folha">
<header><div class="logo">{logo}</div><div><h1>{html.escape(titulo)}</h1><p class="chamada">{html.escape(chamada)}</p></div></header>
<h2>O que muda para a prefeitura</h2><div class="cartoes">{cartoes}</div>
<h2>Como funciona</h2><div class="passos">{etapas}</div>
<div class="comecar"><h2>Para começar</h2><ul>{itens}</ul></div>
<footer>{negrito(rodape)}</footer></section>'''

# Páginas 2 e 3: roteiro de quem apresenta e ficha da rua.
v, c = ler('docs/visita-prefeitura.md'), ler('docs/teste-de-campo-itamogi.md')
roteiro = ('# Roteiro da visita: 18/11/2026, 8h\n\n' + secao(v, 'Itamogi é uma cidade', '**Na véspera')
           + secao(v, '## 4. Mostrar', '## 5. Plano B') + secao(v, '## 5. Plano B', '## 6.'))
rua = '# Na rua: ficha dos avisos\n\n' + secao(c, '## Regras do dia', '## Evidência a gravar')
md = markdown.Markdown(extensions=['tables'])
paginas = folha + ''.join(f'<section>{md.reset().convert(sem_links(p))}</section>' for p in (roteiro, rua))

css = '''@page{size:A4;margin:12mm}*{box-sizing:border-box}
body{margin:0;font:10.5pt/1.45 Urbanist,-apple-system,"Segoe UI",Roboto,sans-serif;color:#2b2420}
section{page-break-after:always}section:last-child{page-break-after:auto}
h1{font-size:17pt;color:#1f4d2b;margin:0 0 6px}h2{font-size:12.5pt;color:#1f4d2b;margin:12px 0 6px}
section:not(.folha)>h1{border-bottom:3px solid #e9b526;padding-bottom:4px}
table{border-collapse:collapse;width:100%;margin:4px 0 8px}th,td{border:1px solid #b9b2a3;padding:4px 6px;vertical-align:top;text-align:left}
th{background:#efe9dc}td:empty{height:28px}ol,ul{margin:4px 0;padding-left:20px}li{margin:3px 0}code{font-size:9.5pt;background:#f1ece1;padding:0 3px}
.folha{min-height:268mm;height:268mm;overflow:hidden;display:flex;flex-direction:column}
.folha header{display:flex;gap:16px;align-items:center;background:#1f4d2b;color:#fff;border-radius:14px;padding:16px 20px}
.folha .logo{flex:none;width:64px;height:64px;border-radius:14px;overflow:hidden}.folha .logo svg{width:100%;height:100%}
.folha h1{color:#fff;font-size:26pt;margin:0;line-height:1.1}.chamada{margin:6px 0 0;font-size:12.5pt;color:#f5f1e8}
.folha h2{font-size:14pt;margin:18px 0 8px}
.cartoes{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cartao{background:#f5f1e8;border-left:5px solid #e9b526;border-radius:10px;padding:10px 12px}
.cartao:last-child{grid-column:1/-1}.cartao h3{margin:0 0 3px;font-size:12pt;color:#1f4d2b}.cartao p{margin:0}
.passos{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.passo{border:2px solid #1f4d2b;border-radius:12px;padding:10px 12px}.passo span{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#e9b526;color:#1f4d2b;font-weight:800}
.passo h3{margin:6px 0 3px;font-size:12pt;color:#1f4d2b}.passo p{margin:0}
.comecar{margin-top:16px;background:#1f4d2b0d;border:2px dashed #1f4d2b;border-radius:12px;padding:6px 16px 10px}.comecar h2{margin-top:6px}
.folha footer{margin-top:auto;padding-top:14px;border-top:3px solid #e9b526;font-size:11pt;color:#1f4d2b}'''
open(sys.argv[2], 'w', encoding='utf-8').write(
    f'<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Kit da visita a Itamogi</title><style>{css}</style>{paginas}</html>'
)

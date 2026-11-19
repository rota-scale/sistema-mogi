import re,subprocess,os,glob,markdown,hashlib
R='/workspace/cia/'; os.makedirs('img',exist_ok=True)
open('pp.json','w').write('{"executablePath":"/usr/bin/google-chrome","args":["--no-sandbox"]}')
def rd(p): return open(R+p).read()
def shift(s,n=1):
    out=[];code=False
    for l in s.split('\n'):
        if l.startswith('```'): code=not code
        if not code and re.match(r'#+ ',l): l='#'*n+l
        out.append(l)
    return '\n'.join(out)
def merm(s):
    def f(m):
        src=m.group(1); h=hashlib.md5(src.encode()).hexdigest()[:8]
        open(f'img/{h}.mmd','w').write(src)
        if not os.path.exists(f'img/{h}.png'):
            subprocess.run(['mmdc','-p','pp.json','-i',f'img/{h}.mmd','-o',f'img/{h}.png','-s','3','-b','white'],check=True,capture_output=True)
        return f'\n<div class="fig"><img src="img/{h}.png"/></div>\n'
    return re.sub(r'```mermaid\n(.*?)```',f,s,flags=re.S)
def links(s): return re.sub(r'\[([^\]]+)\]\((?!http)[^)]+\)',r'\1',s)
secs=[('Visão geral e problema',['docs/proposta-itamogi.md']),
('Solução e fluxo',['docs/fluxo-do-agente.md','docs/escala-de-prioridade.md']),
('Inovação e concorrentes',['docs/inovacao-e-diferenciais.md','docs/pesquisa-solucoes-semelhantes.md']),
('SPEC do MVP',['docs/spec-mvp.md']),
('Stack, linguagens e licenças',['STACK','prototipo/README.md','docs/pesquisa-painel-web.md']),
('Arquitetura',['docs/arquitetura.md']),
('ADRs na íntegra',sorted(x[len(R):] for x in glob.glob(R+'docs/adr/0*.md'))),
('SOPs',sorted(x[len(R):] for x in glob.glob(R+'docs/sops/0*.md'))),
('Plano até 21/11',['docs/plano-ate-21-11.md']),
('Decisões e pendências',['docs/decisoes-e-pendencias.md'])]
STACK='''# Linguagens do projeto
| Linguagem | Onde | Por quê |
|---|---|---|
| Go | Backend: API, fila de triagem, JWT, WebSocket, URLs pré-assinadas, h3-go | Rápido de escrever, um binário, ótimo para concorrência |
| Lua (gopher-lua) | Regras da Triagem Urbana por prefeitura | Linguagem brasileira (PUC-Rio), editável sem deploy, sandbox |
| TypeScript + React Native (Expo) | App Android e iPhone | Câmera, voz e GPS com um código só |
| TypeScript + React + Vite | Painel da prefeitura (proposta) | deck.gl e react-map-gl oficiais, estático servido pelo Go |
| SQL (PostgreSQL + PostGIS + H3) | Banco, geodados e quadrantes | Consultas espaciais e LISTEN/NOTIFY para tempo real |
| Mídia: SeaweedFS | Fotos e vídeos, S3 compatível | Apache-2.0, binário pronto, um servidor |
'''
md=''
for i,(t,fs) in enumerate(secs,1):
    md+=f'\n<h1 class="sec">{i}. {t}</h1>\n'
    for f in fs:
        s=STACK if f=='STACK' else rd(f)
        md+='\n'+shift(links(merm(s)))+'\n'
md=md.replace('\u2014',', ')
body=markdown.markdown(md,extensions=['tables','fenced_code','sane_lists'])
toc=''.join(f'<li>{i}. {t}</li>' for i,(t,_) in enumerate(secs,1))
css='''@page{size:A4;margin:2cm 1.8cm;@bottom-right{content:counter(page);font-size:9pt;color:#666}}
@page:first{@bottom-right{content:none}}
body{font-family:"DejaVu Sans",sans-serif;font-size:10pt;line-height:1.45;color:#222}
h1.sec{page-break-before:always;color:#0b4f6c;border-bottom:3px solid #0b4f6c;padding-bottom:4px;font-size:20pt}
h2{color:#0b4f6c;font-size:15pt;margin-top:18px;border-bottom:1px solid #ccc}
h3{color:#1a6f8f;font-size:12pt} h4{font-size:11pt}
table{border-collapse:collapse;width:100%;margin:8px 0;font-size:8.5pt;page-break-inside:auto}
th,td{border:1px solid #999;padding:4px 6px;vertical-align:top;text-align:left}
th{background:#e3eef3} tr:nth-child(even) td{background:#f7f9fa}
code{font-family:"DejaVu Sans Mono";font-size:8.5pt;background:#f2f2f2;padding:1px 3px}
pre{background:#f2f2f2;padding:8px;border-left:3px solid #0b4f6c;font-size:8.5pt;white-space:pre-wrap}
pre code{background:none}
.fig{text-align:center;margin:10px 0;page-break-inside:avoid} .fig img{max-width:100%;max-height:22cm}
a{color:#0b4f6c;text-decoration:none}
.capa{height:25cm;display:flex;flex-direction:column;justify-content:center;text-align:center}
.capa h1{font-size:34pt;color:#0b4f6c;margin:0} .capa .s{font-size:15pt;color:#444;margin:6px}
.capa .l{width:40%;margin:20px auto;border-top:3px solid #0b4f6c}
.toc{page-break-before:always} .toc li{font-size:12pt;margin:6px 0;list-style:none}'''
html=f'''<html><head><meta charset="utf-8"><style>{css}</style></head><body>
<div class="capa"><h1>Sistema MOGI</h1><div class="s">Monitoramento e Ocorrências com Gestão Inteligente</div><div class="s">Cidade inteligente: arquitetura, SPEC, ADRs e SOPs</div><div class="l"></div>
<div class="s">Piloto: Itamogi-MG</div><div class="s">Equipe ROTA Scale</div><div class="s">AKCIT Camp Sul 2026</div><div class="s">01/11/2026</div></div>
<div class="toc"><h2>Sumário</h2><ul>{toc}</ul></div>{body}</body></html>'''
open('doc.html','w').write(html)
from weasyprint import HTML
HTML('doc.html',base_url='.').write_pdf('Sistema-MOGI-Arquitetura.pdf')

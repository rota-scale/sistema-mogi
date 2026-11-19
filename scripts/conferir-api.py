#!/usr/bin/env python3
"""Confere, contra um servidor de pé, as rotas do morador e da equipe de campo
(ADR 0016): acompanhar o protocolo, "Perto de você" e "Também vi", papéis,
foto do depois, "não encontrei" e gestão de usuários; e o cadastro do
morador com CPF, o perfil, o histórico e "Meu bairro" (ADR 0024).

Uso: make conferir   (com make subir ou make dev rodando)
Cria chamados reais de teste em pontos sorteados; não use em produção.
"""
import json, os, random, re, subprocess, sys, uuid, urllib.request, urllib.error

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(RAIZ, 'scripts'))
import cpf_de_teste  # noqa: E402  CPF e CNPJ válidos sorteados, de ninguém
API = os.environ.get('API', 'http://localhost:8080')
FOTO = os.path.join(RAIZ, 'scripts', 'fixtures', 'foto-rua.jpg')
falhas = []


def env(nome):
    for linha in open(os.path.join(RAIZ, '.env')):
        if linha.startswith(nome + '='):
            return linha.split('=', 1)[1].strip().strip('"')
    return ''


def chamar(metodo, caminho, corpo=None, token=None, cab=None):
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(API + caminho, data=dados, method=metodo)
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    for k, v in (cab or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        txt = e.read()
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, txt.decode()[:200]


def curl(*args):
    out = subprocess.run(['curl', '-s', '-w', '\n%{http_code}', *args], capture_output=True, text=True).stdout
    corpo, _, status = out.rpartition('\n')
    try:
        return int(status), json.loads(corpo)
    except Exception:
        return int(status), corpo[:200]


def confere(nome, cond, extra=''):
    print(('ok   ' if cond else 'FALHA') + ' ' + nome + (' ' + str(extra) if not cond else ''))
    if not cond:
        falhas.append(nome)


def login(l, s):
    st, d = chamar('POST', '/auth/login', {'login': l, 'senha': s})
    assert st == 200, (l, st, d)
    return d['token']


gestor = login(env('SEED_LOGIN') or 'gestor', env('SEED_SENHA'))
operador = login(env('OPERADOR_LOGIN') or 'operador', env('OPERADOR_SENHA'))
campo = login(env('CAMPO_LOGIN') or 'equipe', env('CAMPO_SENHA'))

lat = round(-21.03 + random.uniform(-0.01, 0.01), 6)
lng = round(-47.02 + random.uniform(-0.01, 0.01), 6)
ap1, ap2 = str(uuid.uuid4()), str(uuid.uuid4())

# 0. cadastro do morador (ADR 0024). O código de recuperação é um módulo:
# liga aqui para conferir a v0.2.1 inteira e desliga depois, como no protótipo.
st, par0 = chamar('GET', '/admin/parametros', token=gestor)
confere('módulo recuperacao vem desligado no protótipo', st == 200 and par0['parametros']['modulos'].get('recuperacao') is False, (st, par0))
com_codigo = json.loads(json.dumps(par0['parametros']))
com_codigo['modulos']['recuperacao'] = True
st, _ = chamar('PUT', '/admin/parametros', com_codigo, token=gestor)
confere('gestor liga o código de recuperação', st == 200, st)
cpf = cpf_de_teste.cpf(mascara=True)
cpf_digitos = re.sub(r'\D', '', cpf)
st, cad = chamar('POST', '/moradores', {'tipo': 'pf', 'nome': 'Moradora de Teste', 'documento': cpf, 'profissao': 'professora', 'aceite': True})
confere('cadastro do morador com CPF', st == 201 and cad.get('token') and cad['morador']['tipo'] == 'pf', (st, cad))
morador = cad['token']
mascara = '***.%s.%s-**' % (cpf_digitos[3:6], cpf_digitos[6:9])
confere('documento volta mascarado', cad['morador']['documento_mascarado'] == mascara and cpf_digitos not in json.dumps(cad['morador']), cad['morador'])
codigo = cad.get('codigo_recuperacao') or ''
confere('cadastro entrega o código de recuperação uma vez', re.fullmatch(r'[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}', codigo) is not None, cad)
# P0 (issue #26): quem só sabe o CPF não pode pegar a conta de outra pessoa.
st, cad2 = chamar('POST', '/moradores', {'tipo': 'pf', 'nome': 'Outro Nome', 'documento': cpf_digitos, 'aceite': True})
confere('mesmo CPF de novo não emite token nem devolve dados', st == 409 and cad2.get('codigo') == 'documento_cadastrado' and 'token' not in cad2 and 'morador' not in cad2, (st, cad2))
st, d = chamar('POST', '/moradores/entrar', {'documento': cpf_digitos, 'codigo': 'AAAA-BBBB-CCCC'})
confere('entrar com código errado dá 401 genérico', st == 401 and d.get('codigo') == 'credenciais_invalidas' and 'token' not in d, (st, d))
st, d = chamar('POST', '/moradores/entrar', {'documento': cpf_de_teste.cpf(), 'codigo': 'AAAA-BBBB-CCCC'})
confere('entrar com CPF sem cadastro dá a mesma resposta (sem enumerar)', st == 401 and d.get('codigo') == 'credenciais_invalidas', (st, d))
st, ent = chamar('POST', '/moradores/entrar', {'documento': cpf, 'codigo': codigo.lower().replace('-', ' ')})
confere('entrar com documento e código certos devolve token', st == 200 and ent.get('token') and ent['morador']['id'] == cad['morador']['id'], (st, ent))
st, d = chamar('GET', '/eu', token=morador)
confere('entrar em outro aparelho derruba o token antigo', st == 401 and d.get('codigo') == 'cadastro_obrigatorio', (st, d))
morador = ent['token']
st, _ = chamar('PUT', '/admin/parametros', par0['parametros'], token=gestor)
confere('gestor desliga o código de recuperação', st == 200, st)
cpf_sem = cpf_de_teste.cpf()
st, sem = chamar('POST', '/moradores', {'tipo': 'pf', 'nome': 'Sem Codigo', 'documento': cpf_sem, 'aceite': True})
confere('sem o módulo, cadastro não entrega código', st == 201 and sem.get('token') and 'codigo_recuperacao' not in sem, (st, sem))
st, d = chamar('POST', '/moradores/entrar', {'documento': cpf_sem, 'codigo': 'AAAA-BBBB-CCCC'})
confere('sem o módulo, entrar com código está desligado', st == 404 and d.get('codigo') == 'modulo_desligado' and 'token' not in d, (st, d))
st, d = chamar('POST', '/moradores', {'tipo': 'pf', 'nome': 'Outro', 'documento': cpf_sem, 'aceite': True})
confere('sem o módulo, CPF repetido continua sem token e pede a prefeitura', st == 409 and 'token' not in d and 'prefeitura' in d.get('erro', ''), (st, d))
st, d = chamar('POST', '/moradores', {'tipo': 'pf', 'nome': 'Moradora', 'documento': cpf_de_teste.cpf_invalido(), 'aceite': True})
confere('CPF inválido dá 400', st == 400 and d.get('codigo') == 'documento_invalido', (st, d))
st, d = chamar('POST', '/moradores', {'tipo': 'pf', 'nome': 'Moradora', 'documento': cpf_de_teste.cpf()})
confere('sem aceite do termo dá 400', st == 400 and d.get('codigo') == 'aceite_obrigatorio', (st, d))
st, d = chamar('POST', '/moradores', {'tipo': 'pj', 'nome': 'Padaria de Teste', 'documento': cpf_de_teste.cpf(), 'aceite': True})
confere('pessoa jurídica com CPF dá 400', st == 400 and d.get('codigo') == 'documento_invalido', (st, d))
cnpj = cpf_de_teste.cnpj(mascara=True)
st, pj = chamar('POST', '/moradores', {'tipo': 'pj', 'nome': 'Padaria de Teste', 'documento': cnpj, 'aceite': True})
cnpj_d = re.sub(r'\D', '', cnpj)
confere('pessoa jurídica com CNPJ, mascarado', st == 201 and pj['morador']['documento_mascarado'] == '**.%s.%s/%s-**' % (cnpj_d[2:5], cnpj_d[5:8], cnpj_d[8:12]), (st, pj))
st, eu = chamar('GET', '/eu', token=morador)
confere('GET /eu traz o perfil mascarado', st == 200 and eu['nome'] == 'Moradora de Teste' and eu['documento_mascarado'] == mascara and eu['profissao'] == 'professora', (st, eu))
st, eu = chamar('PUT', '/eu', {'nome': 'Moradora Teste', 'bairro': 'Centro', 'profissao': ''}, token=morador)
confere('PUT /eu muda nome e bairro e apaga a profissão', st == 200 and eu['nome'] == 'Moradora Teste' and eu['bairro'] == 'Centro' and eu['profissao'] is None, (st, eu))
# v0.3.1: CEP e município onde a pessoa mora, opcionais.
st, mor = chamar('POST', '/moradores', {'tipo': 'pf', 'nome': 'Moradora de Curitiba', 'documento': cpf_de_teste.cpf(), 'aceite': True,
                                         'cep': '80010-000', 'municipio': 'Curitiba', 'uf': 'pr', 'municipio_ibge': '4106902'})
confere('cadastro guarda CEP e município', st == 201 and mor['morador']['cep'] == '80010000' and mor['morador']['municipio'] == 'Curitiba' and mor['morador']['uf'] == 'PR', (st, mor))
st, d = chamar('POST', '/moradores', {'tipo': 'pf', 'nome': 'Moradora', 'documento': cpf_de_teste.cpf(), 'aceite': True, 'cep': '123'})
confere('CEP com menos de 8 números dá 400', st == 400 and d.get('codigo') == 'moradia_invalida', (st, d))
st, eu = chamar('PUT', '/eu', {'nome': 'Moradora Teste', 'moradia': {'municipio': 'Itamogi', 'uf': 'MG', 'municipio_ibge': '3132909'}}, token=morador)
confere('PUT /eu troca o município sem mexer no bairro', st == 200 and eu['municipio'] == 'Itamogi' and eu['uf'] == 'MG' and eu['bairro'] == 'Centro', (st, eu))
st, d = chamar('GET', '/cep/123')
confere('GET /cep com CEP inválido dá 400', st == 400 and d.get('codigo') == 'cep_invalido', (st, d))
st, d = chamar('GET', '/eu')
confere('GET /eu sem token dá 401', st == 401 and d.get('codigo') == 'cadastro_obrigatorio', (st, d))
st, d = chamar('GET', '/eu', token=gestor)
confere('token do gestor não vale como morador', st == 401, (st, d))
for metodo, rota_staff in (('GET', '/ocorrencias'), ('GET', '/indicadores'), ('GET', '/admin/usuarios'), ('GET', '/auth/eu')):
    st, _ = chamar(metodo, rota_staff, token=morador)
    confere('token de morador recusado em ' + rota_staff, st == 401, st)
st, d = curl(API + '/ocorrencias', '-F', 'foto=@' + FOTO, '-F', f'lat={lat}', '-F', f'lng={lng}')
confere('relato sem cadastro dá 401', st == 401 and d.get('codigo') == 'cadastro_obrigatorio' and d.get('erro') == 'Faça seu cadastro para relatar', (st, d))


def relatar(categoria, texto, lat, lng, aparelho, token=None):
    return curl(API + '/ocorrencias', '-H', 'Idempotency-Key: ' + str(uuid.uuid4()), '-H', 'X-Mogi-Aparelho: ' + aparelho,
                '-H', 'Authorization: Bearer ' + (token or morador),
                '-F', 'foto=@' + FOTO, '-F', f'lat={lat}', '-F', f'lng={lng}', '-F', 'categoria=' + categoria, '-F', 'texto=' + texto)


# 1. relato e acompanhamento
st, rec = relatar('vias', 'buraco na rua', lat, lng, ap1)
confere('relato de vias criado', st == 201 and rec.get('chave') and rec.get('fora_do_escopo') is False, (st, rec))
st, ac = chamar('GET', f"/acompanhar/{rec['protocolo']}?k={rec['chave']}")
confere('acompanhar com a chave', st == 200 and ac['passos'][0] == {'tipo': 'recebido', 'feito': True, 'quando': ac['enviado_em']}, (st, ac))
confere('acompanhar não traz dado interno', not any(k in ac for k in ('id', 'texto', 'triagem', 'endereco', 'lat')), ac)
st, _ = chamar('GET', f"/acompanhar/{rec['protocolo']}?k={'0' * 32}")
confere('acompanhar com chave errada dá 404', st == 404, st)

# 2. perto de você e também vi
st, perto = chamar('GET', f'/perto?lat={lat}&lng={lng + 0.0002}')
confere('perto lista o chamado', st == 200 and len(perto) == 1 and perto[0]['categoria'] == 'vias' and perto[0]['distancia_m'] % 10 == 0, (st, perto))
confere('perto não expõe id, protocolo nem coordenada', not any(k in perto[0] for k in ('id', 'protocolo', 'lat', 'lng', 'texto')), perto)
ref = perto[0]['ref']
st, d = chamar('POST', '/perto/confirmacao', {'ref': ref, 'lat': lat, 'lng': lng + 0.0002}, cab={'X-Mogi-Aparelho': ap2})
confere('também vi sem cadastro dá 401', st == 401 and d.get('codigo') == 'cadastro_obrigatorio', (st, d))
mor_pj = pj['token']
st, tv = chamar('POST', '/perto/confirmacao', {'ref': ref, 'lat': lat, 'lng': lng + 0.0002}, token=mor_pj, cab={'X-Mogi-Aparelho': ap2})
confere('também vi soma ao chamado', st == 201 and tv['protocolo'] == rec['protocolo'] and tv['relatos'] == 2 and tv['agrupada'], (st, tv))
st, d = chamar('POST', '/perto/confirmacao', {'ref': ref, 'lat': lat, 'lng': lng}, token=mor_pj, cab={'X-Mogi-Aparelho': ap2})
confere('segundo também vi do mesmo aparelho dá 409', st == 409 and d.get('codigo') == 'ja_confirmou', (st, d))
st, d = chamar('POST', '/perto/confirmacao', {'ref': ref, 'lat': lat + 0.01, 'lng': lng}, token=mor_pj, cab={'X-Mogi-Aparelho': str(uuid.uuid4())})
confere('também vi de longe dá 422', st == 422 and d.get('codigo') == 'longe_demais', (st, d))
st, d = chamar('POST', '/perto/confirmacao', {'ref': ref[:-3] + 'abc', 'lat': lat, 'lng': lng}, token=mor_pj, cab={'X-Mogi-Aparelho': str(uuid.uuid4())})
confere('ref adulterada dá 400', st == 400, (st, d))
st, d = chamar('POST', '/perto/confirmacao', {'ref': ref, 'lat': lat, 'lng': lng}, token=mor_pj)
confere('também vi sem aparelho dá 400', st == 400, (st, d))
st, ac2 = chamar('GET', f"/acompanhar/{tv['protocolo']}?k={tv['chave']}")
confere('quem deu também vi acompanha com a própria chave', st == 200 and ac2['relatos'] == 2, (st, ac2))

# 3. um chamado de outra secretaria
st, rec_agua = relatar('agua', 'vazamento pequeno na calçada', lat + 0.02, lng, ap1)
confere('relato de água criado', st == 201, (st, rec_agua))

st, lista = chamar('GET', '/ocorrencias', token=operador)
por_protocolo = {o['protocolo']: o for o in lista}
vias, agua = por_protocolo[rec['protocolo']], por_protocolo[rec_agua['protocolo']]
confere('lista do operador traz as duas', vias['secretaria'] == 'Obras e vias' and agua['secretaria'] == 'Água e esgoto', (vias['secretaria'], agua['secretaria']))
# Relato real (morador cadastrado, pelo app) nunca entra como simulado, e o
# filtro ?demo= da lista separa a demonstração dos relatos reais.
confere('relato real chega com demo = false', vias['demo'] is False and agua['demo'] is False, (vias['demo'], agua['demo']))
st_so, so_demo = chamar('GET', '/ocorrencias?demo=so', token=operador)
confere('?demo=so não traz relato real', st_so == 200 and not any(o['protocolo'] in (rec['protocolo'], rec_agua['protocolo']) for o in so_demo) and all(o['demo'] for o in so_demo), st_so)
st_oc, reais = chamar('GET', '/ocorrencias?demo=ocultar', token=operador)
confere('?demo=ocultar traz só relatos reais', st_oc == 200 and not any(o['demo'] for o in reais) and {rec['protocolo'], rec_agua['protocolo']} <= {o['protocolo'] for o in reais}, st_oc)
st_in, todos = chamar('GET', '/ocorrencias?demo=incluir', token=operador)
confere('?demo=incluir traz reais e simulados', st_in == 200 and len(todos) == len(reais) + len(so_demo), (len(todos), len(reais), len(so_demo)))

for o in (vias, agua):
    if o['status'] in ('revisao', 'a_classificar'):
        st, _ = chamar('POST', f"/ocorrencias/{o['id']}/revisao", {'nivel': 3}, token=operador)
        assert st == 200, st
st, d = chamar('POST', f"/ocorrencias/{vias['id']}/despacho", {'observacao': 'levar massa asfáltica', 'secretaria': 'Secretaria Inventada'}, token=operador)
confere('despacho com secretaria desconhecida dá 400', st == 400, (st, d))
st, d = chamar('POST', f"/ocorrencias/{vias['id']}/despacho", {'observacao': 'levar massa asfáltica'}, token=operador)
confere('despacho põe em atendimento', st == 200 and d['status'] == 'em_atendimento', (st, d))
st, d = chamar('POST', f"/ocorrencias/{agua['id']}/despacho", {}, token=operador)
confere('despacho da água', st == 200, st)

# 4. equipe de campo
st, eu = chamar('GET', '/auth/eu', token=campo)
confere('campo se vê com papel e secretaria', eu.get('papel') == 'campo' and eu.get('secretaria') == 'Obras e vias', eu)
st, minha = chamar('GET', '/ocorrencias?status=em_atendimento', token=campo)
confere('campo só vê a própria secretaria', st == 200 and minha and all(o['secretaria'] == 'Obras e vias' for o in minha), (st, [o['secretaria'] for o in minha][:5]))
confere('campo vê o chamado despachado', any(o['id'] == vias['id'] for o in minha))
st, _ = chamar('GET', f"/ocorrencias/{agua['id']}", token=campo)
confere('campo não abre chamado de outra secretaria', st == 404, st)
st, _ = chamar('POST', f"/ocorrencias/{vias['id']}/revisao", {'nivel': 1}, token=campo)
confere('campo não revisa', st == 403, st)
st, _ = chamar('GET', '/indicadores', token=campo)
confere('campo não vê indicadores', st == 403, st)
st, _ = chamar('GET', '/admin/usuarios', token=campo)
confere('campo não vê usuários', st == 403, st)
st, _ = chamar('POST', f"/ocorrencias/{agua['id']}/resolucao", {}, token=campo)
confere('campo não resolve chamado de outra secretaria', st == 404, st)
st, d = chamar('POST', f"/ocorrencias/{agua['id']}/nao-encontrado", {'motivo': 'x'}, token=campo)
confere('campo não marca não encontrado em outra secretaria', st == 404, st)

st, d = curl('-X', 'POST', API + f"/ocorrencias/{vias['id']}/resolucao", '-H', 'Authorization: Bearer ' + campo,
             '-F', 'motivo=buraco tapado com massa asfáltica', '-F', 'foto=@' + FOTO, '-F', 'foto=@' + FOTO)
confere('campo resolve com 2 fotos do depois', st == 200 and d['status'] == 'resolvida' and d['resolvido_por'] == (env('CAMPO_LOGIN') or 'equipe'), (st, d if st != 200 else ''))
st, det = chamar('GET', f"/ocorrencias/{vias['id']}", token=operador)
depois = [m for m in det['midias'] if m['tipo'] == 'depois']
confere('detalhe traz 2 fotos do depois com link', len(depois) == 2 and all(m.get('url') for m in depois), [m['tipo'] for m in det['midias']])
confere('histórico: despachada com observação, também vi, resolvida com fotos',
        [e['tipo'] for e in det['eventos']][-3:] == ['tambem_vi', 'despachada', 'resolvida'] or
        {'tambem_vi', 'despachada', 'resolvida'} <= {e['tipo'] for e in det['eventos']}, [e['tipo'] for e in det['eventos']])
confere('relatos_lista marca o tipo', sorted(r['tipo'] for r in det['relatos_lista']) == ['relato', 'tambem_vi'], [r['tipo'] for r in det['relatos_lista']])
st, ac = chamar('GET', f"/acompanhar/{rec['protocolo']}?k={rec['chave']}")
confere('morador vê resolvido, o que foi feito e a foto do depois',
        st == 200 and ac['status'] == 'resolvida' and all(p['feito'] for p in ac['passos']) and
        'massa' in ac.get('o_que_foi_feito', '') and len(ac.get('fotos_do_depois', [])) == 2, (st, ac))
st_foto = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', API + ac['fotos_do_depois'][0].removeprefix('/api')], capture_output=True, text=True).stdout
confere('foto do depois abre pelo link', st_foto == '200', st_foto)

# 4b. quem relatou, documento auditado e "Meu bairro" (ADR 0024)
quem = {r['tipo']: r.get('morador') for r in det['relatos_lista']}
confere('detalhe mostra quem relatou, mascarado', quem.get('relato') == {'nome': 'Moradora Teste', 'tipo': 'pf', 'documento_mascarado': mascara, 'profissao': None}
        and quem.get('tambem_vi', {}).get('tipo') == 'pj', quem)
confere('detalhe não traz o documento completo', cpf_digitos not in json.dumps(det) and cpf not in json.dumps(det))
st, det_campo = chamar('GET', f"/ocorrencias/{vias['id']}", token=campo)
confere('equipe de campo não vê quem relatou', st == 200 and all(r.get('morador') is None for r in det_campo['relatos_lista']), (st, [r.get('morador') for r in det_campo.get('relatos_lista', [])]))
relato_id = next(r['id'] for r in det['relatos_lista'] if r['tipo'] == 'relato')
caminho_doc = f"/ocorrencias/{vias['id']}/relatos/{relato_id}/documento"
st, _ = chamar('POST', caminho_doc, token=operador)
confere('operador não abre o documento', st == 403, st)
st, _ = chamar('POST', caminho_doc, token=morador)
confere('morador não abre o documento pela rota do gestor', st == 401, st)
st, doc = chamar('POST', caminho_doc, token=gestor)
confere('gestor vê o documento completo', st == 200 and doc.get('documento') == cpf, (st, doc))
st, det2 = chamar('GET', f"/ocorrencias/{vias['id']}", token=gestor)
vistos = [e for e in det2['eventos'] if e['tipo'] == 'documento_visto']
confere('ver o documento fica no histórico, com autor e sem o número',
        len(vistos) == 1 and vistos[0]['autor'] == (env('SEED_LOGIN') or 'gestor') and cpf_digitos not in json.dumps(vistos), vistos)
st, com = chamar('GET', f'/comunidade?lat={lat}&lng={lng}')
itens = com.get('itens', []) if st == 200 else []
confere('Meu bairro conta o resolvido perto, com a foto do depois',
        st == 200 and com['raio_m'] > 0 and com['resolvidos_30d'] >= 1 and isinstance(com['abertos'], int)
        and any(i['categoria'] == 'vias' and i['foto_depois_url'] and i['distancia_m'] % 10 == 0 for i in itens), (st, com))
confere('Meu bairro sem protocolo, texto nem coordenada',
        all(set(i) == {'categoria', 'categoria_nome', 'resolvido_em', 'foto_depois_url', 'distancia_m'} for i in itens) and 'protocolo' not in json.dumps(com), com)
st, d = chamar('GET', '/comunidade?lat=abc&lng=1')
confere('Meu bairro com ponto inválido dá 400', st == 400, st)

# não encontrado
st, rec3 = relatar('calcadas', 'calçada quebrada', lat - 0.02, lng, ap1)
st, lista = chamar('GET', '/ocorrencias', token=operador)
c3 = next(o for o in lista if o['protocolo'] == rec3['protocolo'])
if c3['status'] in ('revisao', 'a_classificar'):
    chamar('POST', f"/ocorrencias/{c3['id']}/revisao", {'nivel': 2}, token=operador)
chamar('POST', f"/ocorrencias/{c3['id']}/despacho", {}, token=operador)
st, d = chamar('POST', f"/ocorrencias/{c3['id']}/nao-encontrado", {}, token=campo)
confere('não encontrado sem motivo dá 400', st == 400, st)
st, d = chamar('POST', f"/ocorrencias/{c3['id']}/nao-encontrado", {'motivo': 'a calçada já foi consertada pelo dono'}, token=campo)
confere('não encontrado volta para a revisão', st == 200 and d['status'] == 'revisao', (st, d if st != 200 else ''))

# 5. gestão de usuários
novo = 'teste' + uuid.uuid4().hex[:6]
st, d = chamar('POST', '/admin/usuarios', {'login': novo, 'senha': 'curta', 'papel': 'campo', 'secretaria': 'Trânsito'}, token=gestor)
confere('senha curta é recusada', st == 400, (st, d))
st, d = chamar('POST', '/admin/usuarios', {'login': novo, 'senha': 'senha-longa-1', 'papel': 'campo'}, token=gestor)
confere('campo sem secretaria é recusado', st == 400, (st, d))
st, d = chamar('POST', '/admin/usuarios', {'login': novo, 'nome': 'Equipe de Trânsito', 'senha': 'senha-longa-1', 'papel': 'campo', 'secretaria': 'Trânsito'}, token=gestor)
confere('gestor cria usuário de campo', st == 201 and d['ativo'], (st, d))
st, d = chamar('POST', '/admin/usuarios', {'login': novo, 'senha': 'senha-longa-1', 'papel': 'operador'}, token=gestor)
confere('login repetido dá 409', st == 409, st)
st, d = chamar('POST', '/admin/usuarios', {'login': novo + 'x', 'senha': 'senha-longa-1', 'papel': 'operador'}, token=operador)
confere('operador não cria usuário', st == 403, st)
t_novo = login(novo, 'senha-longa-1')
st, eu = chamar('GET', '/auth/eu', token=t_novo)
confere('usuário novo entra', eu.get('secretaria') == 'Trânsito' and eu.get('nome') == 'Equipe de Trânsito', eu)
st, d = chamar('PUT', f'/admin/usuarios/{novo}', {'ativo': False}, token=gestor)
confere('gestor desliga o usuário', st == 200 and d['ativo'] is False, (st, d))
st, _ = chamar('GET', '/auth/eu', token=t_novo)
confere('token de usuário desligado deixa de valer na hora', st == 401, st)
st, _ = chamar('POST', '/auth/login', {'login': novo, 'senha': 'senha-longa-1'})
confere('usuário desligado não entra', st == 401, st)
st, d = chamar('PUT', f"/admin/usuarios/{env('SEED_LOGIN') or 'gestor'}", {'papel': 'operador'}, token=gestor)
confere('gestor não tira o próprio acesso', st == 409, (st, d))
st, lista_u = chamar('GET', '/admin/usuarios', token=gestor)
confere('lista de usuários sem senha', st == 200 and all('senha' not in json.dumps(u) for u in lista_u) and any(u['login'] == novo for u in lista_u))
st, secs = chamar('GET', '/secretarias', token=operador)
confere('lista de secretarias', st == 200 and 'Obras e vias' in secs, secs)

# 6. relato novo pior sobe o nível ao agrupar
lat2 = lat + 0.03
st, r1 = relatar('agua', 'vazamento pequeno na calçada', lat2, lng, ap1)
st, r2 = relatar('agua', 'cano estourado jorrando água, rua alagando', lat2, lng + 0.0001, ap2)
confere('relato pior sobe o nível do chamado agrupado', r2['agrupada'] and (r2['nivel'] or 0) > (r1['nivel'] or 0), (r1['nivel'], r2['nivel']))

# 6b. histórico do morador e exclusão do cadastro (ADR 0024)
st, hist = chamar('GET', '/eu/relatos', token=morador)
rel = hist.get('relatos', []) if st == 200 else []
confere('histórico do morador com total, resolvidos e tempo médio',
        st == 200 and hist['total'] == 5 and hist['resolvidos'] == 1 and isinstance(hist['tempo_medio_horas'], (int, float))
        and len(rel) == 5 and rel[0]['criado_em'] >= rel[-1]['criado_em'] and all(r['chave'] and r['protocolo'] for r in rel), (st, hist))
confere('histórico traz a chave que abre o acompanhamento', any(r['protocolo'] == rec['protocolo'] and r['chave'] == rec['chave'] for r in rel), rel[:2])
st, hist_pj = chamar('GET', '/eu/relatos', token=mor_pj)
confere('também vi conta no histórico de quem confirmou', st == 200 and hist_pj['total'] == 1 and hist_pj['relatos'][0]['protocolo'] == rec['protocolo'], (st, hist_pj))
st, _ = chamar('DELETE', '/eu', token=mor_pj)
confere('DELETE /eu apaga o cadastro', st == 204, st)
st, d = chamar('GET', '/eu', token=mor_pj)
confere('token de cadastro apagado deixa de valer', st == 401 and d.get('codigo') == 'cadastro_obrigatorio', (st, d))
st, det3 = chamar('GET', f"/ocorrencias/{vias['id']}", token=operador)
confere('relato de quem apagou a conta fica no chamado, sem a pessoa',
        st == 200 and len(det3['relatos_lista']) == 2 and next(r for r in det3['relatos_lista'] if r['tipo'] == 'tambem_vi')['morador'] is None, det3.get('relatos_lista'))

# O gestor libera um CPF repetido apagando o cadastro (protótipo sem código).
caminho_apagar = f"/ocorrencias/{vias['id']}/relatos/{relato_id}/morador"
st, _ = chamar('DELETE', caminho_apagar, token=operador)
confere('operador não apaga cadastro de morador', st == 403, st)
st, _ = chamar('DELETE', caminho_apagar, token=gestor)
confere('gestor apaga o cadastro de quem relatou', st == 204, st)
st, det4 = chamar('GET', f"/ocorrencias/{vias['id']}", token=gestor)
apagados = [e for e in det4['eventos'] if e['tipo'] == 'cadastro_apagado']
confere('apagar o cadastro fica no histórico, com autor', len(apagados) == 1 and apagados[0]['autor'] == (env('SEED_LOGIN') or 'gestor'), apagados)
confere('o relato continua, sem o cadastro', any(r['id'] == relato_id and r.get('morador') is None for r in det4['relatos_lista']), det4['relatos_lista'])
st, _ = chamar('DELETE', caminho_apagar, token=gestor)
confere('apagar de novo dá 404', st == 404, st)
st, cad3 = chamar('POST', '/moradores', {'tipo': 'pf', 'nome': 'Moradora de Teste', 'documento': cpf, 'aceite': True})
confere('o mesmo CPF cadastra de novo depois de liberado', st == 201 and cad3.get('token'), (st, cad3))

# 7. parâmetros, operação e telemetria (ADRs 0018 e 0019)
st, par = chamar('GET', '/admin/parametros', token=gestor)
confere('gestor lê os parâmetros', st == 200 and par['parametros']['raio_agrupamento_m'] > 0 and 'modulos' in par['parametros'], (st, par))
st, d = chamar('PUT', '/admin/parametros', {'raio_agrupamento_m': 1}, token=gestor)
confere('parâmetro fora da faixa é recusado', st == 400, (st, d))
st, d = chamar('PUT', '/admin/parametros', par['parametros'], token=operador)
confere('operador não muda parâmetros', st == 403, st)
desligado = json.loads(json.dumps(par['parametros']))
desligado['modulos']['perto'] = False
st, d = chamar('PUT', '/admin/parametros', desligado, token=gestor)
st2, cfg = chamar('GET', '/config')
confere('/config traz o módulo cadastro', cfg['modulos'].get('cadastro') is True, cfg.get('modulos'))
st3, vazio = chamar('GET', f'/perto?lat={lat}&lng={lng}')
confere('desligar o módulo vale na hora', st == 200 and cfg['modulos']['perto'] is False and vazio == [], (st, cfg.get('modulos'), vazio))
st, d = chamar('PUT', '/admin/parametros', par['parametros'], token=gestor)
st2, cfg = chamar('GET', '/config')
confere('parâmetros restaurados', st == 200 and cfg['modulos']['perto'] == par['parametros']['modulos']['perto'], (st, cfg.get('modulos')))

st, _ = chamar('POST', '/telemetria', {'tipo': 'envio_falhou', 'detalhe': 'teste, fone 35 99999-1234', 'tela': 'conferencia'})
confere('telemetria aceita', st == 204, st)
st, _ = chamar('POST', '/telemetria', {'tipo': 'Tipo Inválido'})
confere('telemetria com tipo estranho é recusada', st == 400, st)
st, op = chamar('GET', '/operacao', token=gestor)
recentes = op['aparelhos']['recentes'] if st == 200 else []
confere('operação mostra saúde, fila, triagem e o sinal do aparelho',
        st == 200 and op['saude']['banco'] == 'ok' and 'revisao' in op['fila'] and len(op['relatos']['por_hora']) == 24
        and any(r['tipo'] == 'envio_falhou' for r in recentes), (st, list(op) if st == 200 else op))
confere('telemetria guardada sem o telefone', all('99999' not in (r.get('detalhe') or '') for r in recentes), recentes[:2])
st, _ = chamar('GET', '/operacao', token=operador)
confere('operador não vê a operação', st == 403, st)
req = urllib.request.Request(API + '/relatorio.csv?dias=1', headers={'Authorization': 'Bearer ' + gestor})
with urllib.request.urlopen(req) as r:
    linhas = r.read().decode().splitlines()
confere('relatório sem texto, coordenada nem login',
        linhas[0].startswith('protocolo,criado_em,categoria') and len(linhas) > 1
        and not {'texto', 'lat', 'lng', 'endereco', 'revisado_por', 'despachado_por', 'resolvido_por'} & set(linhas[0].split(',')), linhas[0])

print('\n%d falha(s)' % len(falhas))
sys.exit(1 if falhas else 0)

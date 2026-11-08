import json, html, re, difflib, sys
sys.path.insert(0, '.')
from clauses import CLAUSES, TEXTS, GENERATOR

S = {s['c']: s for s in json.load(open('services.json'))}
L = json.load(open('levels.json'))
LV = {'bronze': 'Bronze', 'prata': 'Prata', 'ouro': 'Ouro'}
ORDER = {'bronze': 0, 'prata': 1, 'ouro': 2}

GENERIC = ('serviços de outra categoria', 'serviços, visitas, aprovações', 'recursos visuais, visitas',
           'a taxa de art legalmente exigível')

def clean(t):
    t = re.sub(r'\s+', ' ', (t or '').strip())
    t = re.sub(r'\.{2,}', '.', t)
    return t.rstrip(' ;')

def sent(t):
    t = clean(t)
    return t if not t or t.endswith('.') else t + '.'

def extra_conditions(cs):
    # trecho específico entre a lista de produtos e a frase-padrão final
    m = re.search(r'Produtos identificados para o nível:.*?\d\) [^\n]*?\.\.\s*(.*?)\s*O contrato identifica', cs or '', re.S)
    if not m:
        return ''
    t = clean(m.group(1))
    return '' if not t or t.startswith('O contrato') else sent(t)

def new_scope(code, level, mode):
    s = S[code]; r = next(x for x in L if x['c'] == code and x['l'] == level)
    inc = [clean(x).rstrip('.') for x in (r['inc'] or [])]
    exc, seen = [], set()
    for x in (s['ex'] or []) + (r['exc'] or []):
        k = clean(x).rstrip('.')
        if not k or any(k.lower().startswith(g) for g in GENERIC) or k.lower() in seen or (len(k) > 180 and extra_conditions(r['cs'])):
            continue
        seen.add(k.lower()); exc.append(k)
    ins = [clean(x).rstrip('.') for x in (s['in'] or []) if clean(x)]
    rev = r['rev']; vis = r['vis']; fmt = ', '.join(r['fmt'] or s['fmt'] or []) or 'PDF'
    parts = [f"{s['n']} — nível {LV[level]}.", f"Objeto: {sent(s['d'])}"]
    parts.append('Entregas incluídas: ' + '; '.join(f'({i+1}) {x}' for i, x in enumerate(inc)) + '.')
    rv = str(rev) if rev is not None else 'somente as fixadas no Quadro (sem número, nenhuma)'
    vv = str(vis) if vis else 'somente as fixadas no Quadro (sem número, nenhuma)'
    parts.append(f"Revisões de preferência: {rv}. Visitas: {vv}. Formato: {fmt}. Números diferentes dos indicados aqui só valem se fixados no Quadro.")
    extra = extra_conditions(r['cs'])
    if extra:
        parts.append('Condições específicas: ' + extra)
    if ins:
        parts.append('O cliente fornece: ' + '; '.join(ins) + '.')
    parts.append('Não inclui: ' + '; '.join(exc + ['taxas de ART e de órgãos públicos (cláusula 5.5)', 'qualquer item não listado acima, que será serviço adicional (cláusula 1.2)']) + '.')
    if mode == 'contract':
        parts.append('Quantidades, prazo técnico, marco de início e valor: conforme Quadro de Condições Comerciais deste contrato.')
    elif mode == 'budget':
        parts.append('Quantidades, prazo técnico e valor: conforme esta proposta.')
    else:
        parts.insert(0, 'SERVIÇO ADICIONAL —')
        parts.append('Quantidades, prazo técnico, valor e parcelas: conforme quadro deste Anexo I.')
    return ' '.join(parts)

def diff(a, b):
    aw, bw = a.split(' '), b.split(' ')
    out_a, out_b = [], []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, aw, bw, autojunk=False).get_opcodes():
        A = html.escape(' '.join(aw[i1:i2])); B = html.escape(' '.join(bw[j1:j2]))
        if op == 'equal':
            out_a.append(A); out_b.append(B)
        else:
            if A: out_a.append(f'<del>{A}</del>')
            if B: out_b.append(f'<ins>{B}</ins>')
    return ' '.join(out_a), ' '.join(out_b)

def pair(label, why, a, b, sub=''):
    da, db = diff(a, b)
    return f'''<article class="chg"><header><span class="ref">{html.escape(label)}</span>{f'<span class="sub">{html.escape(sub)}</span>' if sub else ''}<p class="why">{html.escape(why)}</p></header>
<div class="ab"><div class="col before"><span class="tag">Antes</span><p>{da}</p></div><div class="col after"><span class="tag">Depois</span><p>{db}</p></div></div></article>'''

# dados aplicáveis depois do "ok"
out = {'clauses': [{'ref': c[0], 'before': c[2], 'after': c[3]} for c in CLAUSES],
       'texts': [{'code': t[0], 'before': t[2], 'after': t[3]} for t in TEXTS],
       'generator': [{'file': g[1], 'before': g[2], 'after': g[3]} for g in GENERATOR],
       'scopes': []}
scope_html = []
for code in sorted(S, key=lambda c: (len(c), c)):
    s = S[code]
    rows = sorted([x for x in L if x['c'] == code], key=lambda x: ORDER[x['l']])
    items = []
    for r in rows:
        nc, nb, na = new_scope(code, r['l'], 'contract'), new_scope(code, r['l'], 'budget'), new_scope(code, r['l'], 'annex')
        out['scopes'].append({'service_code': code, 'level_code': r['l'], 'version_from': r['v'],
                              'contract_scope': nc, 'budget_description': nb, 'annex_scope': na})
        items.append(pair(f"{LV[r['l']]}", 'Texto do contrato (o orçamento e o Anexo I do adicional usam o mesmo texto, mudando só a última frase).', clean(r['cs']), nc))
    scope_html.append(f'<section class="svc" id="s-{code}"><h3><span class="code">{html.escape(code)}</span>{html.escape(s["n"])}</h3>{"".join(items)}</section>')

json.dump(out, open('revisao-v8.json', 'w'), ensure_ascii=False, indent=1)

clause_html = ''.join(pair(c[0], c[1], c[2], c[3], 'Contrato Mestre') for c in CLAUSES)
text_html = ''.join(pair(t[1], 'Texto padronizado usado nos documentos.', t[2], t[3], t[0]) for t in TEXTS)
gen_html = ''.join(pair(g[0], 'Texto fixo do gerador de Word; só o conteúdo muda.', g[2], g[3], g[1]) for g in GENERATOR)
nav = ''.join(f'<a href="#s-{c}">{html.escape(c)}</a>' for c in sorted(S, key=lambda c: (len(c), c)))

page = f'''<title>Revisão Contrato Mestre v8</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Layout: coluna de leitura única; cada alteração em par Antes | Depois, empilhado no celular */
:root {{ --bg:#f6f7f5; --panel:#ffffff; --fg:#1d2420; --muted:#5b665f; --line:#d9dfda; --accent:#2f5d50;
  --del:#f6dcd6; --delfg:#8a2a17; --ins:#d5ecd9; --insfg:#1d5a2c;
  --display:"Source Serif 4", Georgia, serif; --body:"IBM Plex Sans", system-ui, sans-serif; --mono:"IBM Plex Mono", ui-monospace, monospace; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg:#141816; --panel:#1c211e; --fg:#e4e9e5; --muted:#9aa69f; --line:#2e3631; --accent:#8cc4b2;
  --del:#4a2620; --delfg:#f3b4a6; --ins:#1f3d27; --insfg:#a9e0b5; color-scheme:dark }} }}
:root[data-theme="dark"] {{ --bg:#141816; --panel:#1c211e; --fg:#e4e9e5; --muted:#9aa69f; --line:#2e3631; --accent:#8cc4b2;
  --del:#4a2620; --delfg:#f3b4a6; --ins:#1f3d27; --insfg:#a9e0b5; color-scheme:dark }}
body {{ background:var(--bg); color:var(--fg); font:15px/1.55 var(--body); }}
.wrap {{ max-width:1080px; margin:0 auto; padding-block:32px 64px; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); display:grid; gap:28px; }}
h1 {{ font:600 2rem/1.15 var(--display); margin:0; text-wrap:balance; }}
h2 {{ font:600 1.4rem/1.2 var(--display); margin:0 0 4px; text-wrap:balance; }}
h3 {{ font:600 1.1rem/1.3 var(--body); margin:0; display:flex; gap:10px; align-items:baseline; }}
.lede p {{ max-width:68ch; margin:6px 0; }}
.box {{ background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:16px 18px; }}
.box ul {{ margin:6px 0 0; padding-left:20px; }} .box li {{ margin:3px 0; }}
.ok {{ border-left:4px solid var(--accent); }}
section.grp {{ display:grid; gap:14px; }}
.chg {{ background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:12px 14px; display:grid; gap:8px; }}
.chg header {{ display:flex; flex-wrap:wrap; gap:6px 10px; align-items:baseline; }}
.ref {{ font:500 .95rem var(--mono); color:var(--accent); }}
.sub {{ font:500 .75rem var(--mono); color:var(--muted); }}
.why {{ margin:0; flex-basis:100%; color:var(--muted); font-size:.9rem; }}
.ab {{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }}
.col {{ min-width:0; }} .col p {{ margin:4px 0 0; overflow-wrap:anywhere; }}
.tag {{ font:600 .7rem var(--body); letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }}
del {{ background:var(--del); color:var(--delfg); text-decoration:line-through; border-radius:2px; padding:0 2px; }}
ins {{ background:var(--ins); color:var(--insfg); text-decoration:none; border-radius:2px; padding:0 2px; }}
.code {{ font:500 .8rem var(--mono); color:var(--accent); border:1px solid var(--line); border-radius:4px; padding:1px 6px; }}
.svc {{ display:grid; gap:10px; padding-top:8px; }}
nav.idx {{ display:flex; flex-wrap:wrap; gap:6px; }}
nav.idx a {{ font:500 .8rem var(--mono); color:var(--accent); text-decoration:none; border:1px solid var(--line); border-radius:4px; padding:2px 7px; background:var(--panel); }}
nav.idx a:focus-visible, a:focus-visible {{ outline:2px solid var(--accent); outline-offset:2px; }}
@media (max-width:720px) {{ .ab {{ grid-template-columns:1fr; }} h1 {{ font-size:1.6rem; }} }}
</style>
<div class="wrap">
<div class="lede">
<h1>Revisão do Contrato Mestre v8 e dos escopos</h1>
<p>Preparada em 08/11/2026 para aprovação. Nada abaixo foi aplicado ainda. Layout, cores e fontes dos documentos não mudam; só o conteúdo.</p>
</div>
<div class="box ok"><strong>Como aprovar</strong>
<ul><li>Responda <strong>“ok”</strong> no chat. Eu aplico tudo de uma vez: Contrato Mestre v8 (substitui a v7 como vigente; a v7 fica no histórico), textos padronizados, textos fixos do gerador e os 123 escopos (41 atividades × 3 níveis), e libero a trava do Contrato Mestre no mesmo passo.</li>
<li>Para mudar algo, diga o número da cláusula ou o código da atividade e o texto desejado.</li>
<li>Documentos já emitidos não mudam (cláusula 21.7): a v8 vale só para novas emissões.</li></ul></div>
<div class="box"><strong>O que muda, em resumo</strong>
<ul><li>Escopo, valores, parcelas e forma de pagamento ficam no próprio contrato, no “Quadro de Condições Comerciais”. O Anexo I passa a existir só para serviço adicional, com valor e parcelas próprios.</li>
<li>Brechas fechadas: soma das parcelas diferente do total (5.2); prevalência do orçamento sobre o contrato (21.5); atividade sem número de revisões ou visitas (6.1: sem número, não há).</li>
<li>Escopos reescritos num padrão único e curto: objeto, entregas numeradas, revisões, visitas e formato, o que o cliente fornece e o que não inclui, terminando com “qualquer item não listado é serviço adicional”.</li>
<li>Ao todo: {len(CLAUSES)} cláusulas, {len(TEXTS)} textos padronizados, {len(GENERATOR)} textos do gerador e {len(out['scopes'])} escopos.</li></ul></div>
<div class="box"><strong>Revisão jurídica</strong>
<p style="margin:6px 0 0">Recomendo que uma advogada leia o Contrato Mestre v8 antes de usá-lo com clientes, em especial as cláusulas 5.2, 6.1 e 21.5. Esta revisão é técnica e de coerência; não substitui a análise jurídica.</p></div>

<section class="grp"><h2>1. Contrato Mestre — cláusulas alteradas</h2>{clause_html}</section>
<section class="grp"><h2>2. Textos padronizados dos documentos</h2>{text_html}</section>
<section class="grp"><h2>3. Textos fixos do gerador de Word</h2>{gen_html}</section>
<section class="grp"><h2>4. Escopos das 41 atividades</h2>
<p style="margin:0;max-width:68ch">Cada atividade mostra os três níveis. A coluna “Depois” é o texto que entra no contrato.</p>
<nav class="idx" aria-label="Atividades">{nav}</nav>{''.join(scope_html)}</section>
</div>'''
open('revisao-v8.html', 'w').write(page)
print(len(page), len(out['scopes']))
print(out['scopes'][[i for i,x in enumerate(out['scopes']) if x['service_code']=='n' and x['level_code']=='prata'][0]]['contract_scope'])
print(out['scopes'][[i for i,x in enumerate(out['scopes']) if x['service_code']=='f' and x['level_code']=='ouro'][0]]['contract_scope'])

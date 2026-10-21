# HANDOFF

Atualizado: 2026-10-20 (sessão 22)

Branch: feature/gestao-online-segura
HEAD: e3232ed

## Última entrega — Sessão 22
Redesenho da capa do Cardápio (Pg1) e melhoria completa do editor de imagem de capa na Central.

### Commits desta sessão
| Commit   | O que fez |
|----------|-----------|
| e3232ed  | refactor(editor): layout de recorte inline — controles abaixo de cada prévia |
| e2c9028  | fix(editor): recorte de capa com arraste X/Y nos dois eixos |
| f25a054  | fix(editor): drag usa rect do container + height explícita no recorte celular |
| 0435cd2  | fix(editor): drag igual H/V + scroll para zoom nos recortes |
| b8ee0e3  | feat(editor): enquadramento independente celular/desktop na capa |
| 8b94e67  | feat(editor): arrastar para ponto focal + zoom até 3× na prévia da capa |
| 5c408ce  | feat(cardápio): redesenho capa Pg1 — tipografia, checkboxes, gap tablet, ponto focal prévia |

### Entregas confirmadas em produção

**Cardápio — Pg1 (capa):**
- Título: `Cardápio Oba Doceria` (Cormorant Garamond, weight 400)
- Parágrafo: "Brigadeiros gourmet artesanais, com cremosidade envolvente..."
- CTA: "DESCUBRA NOSSOS SABORES"
- Tipografia ajustada: `clamp(1.7rem, 5.5vw, 2rem)` mobile · `clamp(2.0rem, 2.8vw, 2.4rem)` desktop com foto
- Checkboxes novos: Exibir assinatura abaixo do botão · Exibir rótulo da página
- Gap tablet 768–1023px corrigido (position:static no CTA + margin-top limitado)

**Editor de imagem de capa (Central):**
- Arraste para ponto focal na prévia: drag X e Y funcionando nos dois recortes
- Zoom até 3× (era 2×) com aviso de qualidade acima de 2×
- Recortes celular e desktop com enquadramento independente
- Layout redesenhado: controles inline abaixo de cada recorte (sem abas)
- Altura dos recortes na prévia corrigida para valores representativos
- Nota clara: prévia completa usa a mesma lógica do cardápio publicado

**Version ID atual:** `f1b55715-b673-400b-9ff5-e6c888b7b8e2`

## Estado atual — TUDO APROVADO E EM PRODUÇÃO

### Pendentes identificados na sessão

**Título em maiúsculas na capa**
- O `text-transform: uppercase` da classe Tailwind `uppercase` no HTML do `#pag1-ne-titulo` faz "Cardápio Oba Doceria" aparecer em caixa alta como "CARDÁPIO OBA DOCERIA"
- O CSS do b2-polimento define `text-transform: none !important`, mas o elemento HTML tem a classe diretamente
- Decisão tomada: manter em maiúsculas (aprovado pelo usuário)

**Divergência entre recortes e cardápio publicado**
- Os recortes de prévia (celular/desktop) usam `position:absolute + left/top` com FATOR=1.5
- O cardápio usa `object-position` com `object-fit:cover`
- As fórmulas são diferentes — recortes exageram o movimento no eixo que não tem sobra no cover
- A prévia completa (360×640) usa `object-position + scale()`, igual ao cardápio — essa é a referência fiel
- Valores salvos e cardápio publicado: não afetados. Problema é apenas visual nos thumbnails de recorte
- Decisão: manter FATOR=1.5 (arraste funciona) com nota orientando usar a prévia completa

**Validação no smartphone real**
- Ainda recomendada para confirmar o comportamento visual final da capa redesenhada

**Borda do botão Voltar no Catálogo**
- Confirmada nos prints — regra `.oba-btn-voltar-dest` ainda aplica borda
- Uma linha de CSS para remover quando decidido

## Pontos de retorno seguros
- HEAD atual = e3232ed (estável, deploy validado — sessão 22)
- Anterior = e2c9028 (fix arraste X/Y)
- Anterior = 5c408ce (redesenho Pg1 + checkboxes + gap tablet)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

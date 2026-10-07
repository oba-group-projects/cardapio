# HANDOFF

Atualizado: 2026-10-07 (sessão 7)

Branch: feature/gestao-online-segura
HEAD: d1367b7

## Última entrega
Etapa A completa — Ed. Visual Catálogo com cores, logo, tipografia e tema global. Refinamentos visuais cardápio (Pg1, Pg3, fluxo). Central reorganizada com abas separadas.

## Commits recentes relevantes
| Commit   | O que fez |
|----------|-----------|
| d1367b7  | feat(catalogo): Ed. Visual completa — cores, logo, tipografia, tema global |
| 1aee67f  | feat(12C-4): Ed. Visual Catálogo — Pg2 e Pg3/4 editáveis |
| 0cd18cc  | feat(central): Ed. Visual Cardápio e Ed. Visual Catálogo como abas separadas |
| 6dedb28  | feat(cardapio): texto Nossa Essência controlado pela Central |
| 4c1dfc0  | feat(cardapio): Pg1 título menor + botão centralizado + fluxo compacto |

## Estado atual — TUDO APROVADO

### Cardápio (/cardapio)

**Pg1 — Interpretação B (Nossa Essência como título principal):**
- Logo: 96px, align-self flex-start
- Rótulo "CARDÁPIO": 12px, linha decorativa ::after
- Título "Nossa Essência": Cormorant Garamond 2.4rem/500
- Texto: 2 parágrafos via D1 (pag1-ne-texto + pag1-ne-texto-2), 13px/1.65
- Citação: 14px, centralizada
- CTA: py-3.5, max-w-280px, shadow-md, align-self center, mt-24px
- `#oba-pag1-titulo` e `#oba-pag1-subtitulo`: ocultos (DOM intacto)

**Pg3 — Menu Principal:**
- Labels .oba-btn-label: 15px/500
- Subtítulo: 13px, cor rgba(139,69,19,0.85)
- Ícones: 1.5rem, opacity .35

**Fluxo de montagem:**
- Categorias: grid 3 colunas
- secao-passo1/passo2: padding 16px, mt 12px entre cards

### Catálogo (/catalogo) — APROVADO
- Paleta Verde Sálvia (#6B9E7A, #F4F8F4)
- Ed. Visual completa implementada (Etapa A)
- catHidratarTema() aplica CSS vars + fonte + tipografia global
- catMontarPg1/Pg3 expandidas com cores/logo/tipografia

### Central de Gestão
- **✏️ Ed. Visual Cardápio** — Páginas (Pg1/Pg2/Pg3) + Tema Global
- **🗂️ Ed. Visual Catálogo** — sub-abas Páginas / Tema Global
  - Pg1: textos + logo + cores + tipografia
  - Pg2: textos + logo + cores + tipografia
  - Pg3/4: textos + corTitulo por grupo
  - Tema Global: 6 cores + fonte + tipografia + arredondamento
- theme-catalogo.json v3 (schemaVersion 3)

## REGRAS TÉCNICAS CRÍTICAS
1. Nunca usar Set-Content/Out-File do PowerShell — adiciona BOM
2. Sempre usar str_replace/fs_write para edições de texto
3. theme.json = cardápio. theme-catalogo.json = catálogo. NUNCA misturar.
4. pag1-ne-texto e pag1-ne-texto-2: textos vêm do D1 (nossa_essencia.texto e texto2)
5. catAbrirGrupo assinatura: (grupo, dados) — não (grupo, titulo, subtitulo, dados)
6. _catSet: função global no catálogo, não local em catMontarPg1
7. obaSaveDraftWith('tema', ...) = cardápio. obaSaveDraftWith('tema_catalogo', ...) = catálogo.

## Pendente — próximas sessões
- Validar Ed. Visual Catálogo ao vivo (abrir Central → Ed. Visual Catálogo → testar Pg1/Pg2/Pg3/Tema Global)
- Refinamentos do catálogo: "Encontre o seu favorito" (Pg de sabores)
- Etapa B futura: hidratarTemaCatalogo() para temas salvos via D1 (hoje só static asset)
- Microinterações (sessão futura)

## Pontos de retorno seguros
- HEAD atual = d1367b7 (estável, validado)
- Anterior = 1aee67f

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

Branch: feature/gestao-online-segura
HEAD: 6a2a2bb

## Última entrega
12C-4 completa — Edição Visual do Catálogo implementada. Refinamentos visuais do cardápio (Pg1, Pg3, fluxo). Avisos na Central sobre Pg1→Pg2.

## Commits recentes relevantes
| Commit   | O que fez |
|----------|-----------|
| 6a2a2bb  | feat(12C-4): Edição Visual Catálogo — theme-catalogo.json, hidratação, Central |
| 0b89a9e  | feat(central): avisos informativos Pg1/Pg2 na Edição Visual |
| 9376512  | fix(cardapio): Pg3 seletores corretos — oba-btn-label/oba-btn-sublabel |
| 222b43a  | feat(cardapio): Pg3 refinamento visual — hierarquia botões |
| fd39128  | fix(cardapio): categorias sabores — grid 3 colunas |
| 481cfea  | feat(cardapio): refinamento Pg3 + fluxo montagem |
| 8000eb9  | feat(cardapio): Pg1 refinamento v3 — rótulo, título semibold, 2 parágrafos |

## Estado atual — TUDO APROVADO

### Cardápio (/cardapio)

**Pg1 — Interpretação B (Nossa Essência como título principal):**
- Logo: 96px, align-self flex-start
- Rótulo "CARDÁPIO": 12px, linha decorativa ::after
- Título "Nossa Essência": Cormorant Garamond 3rem/500, #3B2A1E
- Texto: 2 parágrafos fixos no HTML, 13px, #4B5563
- Citação: "Feito à mão, com amor e precisão." 14px, centralizada
- CTA: py-3.5, max-w-280px, shadow-md
- `#oba-pag1-titulo` e `#oba-pag1-subtitulo`: ocultos (DOM intacto)

**Pg3 — Menu Principal:**
- Subtítulo: 13px, cor /85
- Labels: 15px/500 (classe .oba-btn-label)
- Sublabels: 10px/.65 (classe .oba-btn-sublabel)
- Ícones: 1.5rem, brancos opacity .35
- 2º botão: borda /20

**Fluxo de montagem:**
- Categorias: grid 3 colunas, flex-wrap, tudo visível
- Resumo caixa: text-left

### Catálogo (/catalogo) — APROVADO
- Paleta Verde Sálvia (#6B9E7A, #F4F8F4)
- Layout editorial, Pg1 unificada, float-bar, lightbox
- **Edição Visual implementada (12C-4)**

### Central de Gestão
- Edição Visual: avisos informativos Pg1/Pg2 sobre relação dos campos
- Edição Visual: formulário "Catálogo — Pg1 (Abertura)" funcional
- Pipeline DRAFT → PREVIEW → PUBLISHED: funcional

## REGRAS TÉCNICAS CRÍTICAS
1. Nunca usar Set-Content/Out-File do PowerShell para HTML/JSON — adiciona BOM
2. Sempre usar str_replace/fs_write para edições de texto
3. theme.json = cardápio. theme-catalogo.json = catálogo. NUNCA misturar.
4. querySelector('#pag-1 button[onclick="navegarPara(2)"]') — NÃO alterar o onclick
5. .glass-card e .bg-orange-200/60 — NÃO remover essas classes
6. obaSaveDraftWith('tema', ...) = cardápio. obaSaveDraftWith('tema_catalogo', ...) = catálogo.

## Pendente — próximas sessões
- Refinamentos visuais do catálogo: "Encontre o seu favorito" (Pg sabores) e segundo parágrafo Pg1 encurtado
- Microinterações (sessão futura, uma por vez)
- Hardening: substituir querySelector frágil por getElementById

## Pontos de retorno seguros
- HEAD atual = 6a2a2bb (estável, validado)
- Anterior estável = 9376512

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

Branch: feature/gestao-online-segura
HEAD: b644fd2

## Última entrega
Pg1 Interpretação B — "Nossa Essência" como título principal em Cormorant Garamond. Layout editorial à esquerda, alinhado ao modelo visual aprovado.

## Commits recentes relevantes
| Commit   | O que fez |
|----------|-----------|
| b644fd2  | feat(cardapio): Pg1 Interpretação B — Nossa Essência como título principal |
| 8f908e6  | fix(cardapio): mover CTA para após bloco de essência na Pg1 |
| 9b49c69  | feat(cardapio): unificar Pg1+Pg2 — nossa essência na abertura |
| c48eb9c  | fix: byte ctrl 0x19 removido dos botões ← + título Pg1 centralizado |
| f17255f  | docs: handoff anterior |

## Estado atual — TUDO APROVADO

### Cardápio (/cardapio) — Evolução B+ INTERPRETAÇÃO B

**Pg1 — layout editorial à esquerda:**
- `#oba-pag1-titulo` e `#oba-pag1-subtitulo`: ocultos via CSS, DOM intacto (JS preservado)
- Título principal: "Nossa Essência" (`#pag1-ne-titulo`) — Cormorant Garamond 2.6rem/300, cor #3B2A1E
- Rótulo: "CARDÁPIO" (`#pag1-ne-rotulo`) — com linha decorativa ::after, à esquerda
- Texto (`#pag1-ne-texto`): 14px, #4B5563, font-weight 300
- Citação (`#pag1-ne-citacao`): itálico, com ♡ via ::after
- CTA: `#oba-pag1-btn-cta` com `navegarPara(2)` — intacto
- Logo: alinhada à esquerda (`align-self: flex-start`)
- `#pag-1`: `align-items: flex-start`, padding lateral 28px, `max-width: 100%`
- Cormorant Garamond adicionada ao `@import` de fonts

**Pg2:**
- Título: "Nossa Essência"
- Texto condensado em parágrafo único, line-height 1.9
- Citação: "Feito à mão, com amor e precisão." — itálico/500

**Pg3, fluxo de compra, Vitrine, Orçamentos:** intactos e validados

### Catálogo (/catalogo) — APROVADO
- Paleta Verde Sálvia médio (#6B9E7A, #F4F8F4)
- Layout editorial, Pg1 unificada, float-bar 3 botões, lightbox

### Validação completa (Parte 3) — PASSOU
- Pg1 → Pg2 → Pg3: navegação correta
- Fluxo de caixas: funcional
- Vitrine de Presentes: funcional
- Modal Orçamentos de Eventos: funcional
- WhatsApp flutuante: aparece da Pg3 em diante

## REGRAS TÉCNICAS CRÍTICAS
1. Nunca usar Set-Content/Out-File do PowerShell para HTML/JSON — adiciona BOM
2. Sempre usar str_replace/fs_write para edições de texto
3. Para remover bytes de controle: usar [System.IO.File]::ReadAllBytes + Replace direto de string
4. theme.json local = fallback; D1 PUBLISHED = prevalece. Para atualizar textos: editar na Central e publicar
5. querySelector('#pag-1 button[onclick="navegarPara(2)"]') — NÃO alterar o onclick
6. .glass-card e .bg-orange-200/60 — NÃO remover essas classes

## Pendente — próximas sessões

### Refinamentos do Catálogo
- "Escolha o tipo de doce" → "Encontre o seu favorito" (Pg3 do catálogo)
- Segundo parágrafo da Pg1 do catálogo levemente encurtado

### Hardening técnico (fase futura)
- Substituir querySelector frágil por getElementById
- Edição Visual do Catálogo na Central (12C-4)

## Pontos de retorno seguros
- HEAD atual = b644fd2 (estável, validado — Pg1 Interpretação B)
- Anterior estável = 8f908e6

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

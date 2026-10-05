# HANDOFF

Atualizado: 2026-10-05 (sessão 5)

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

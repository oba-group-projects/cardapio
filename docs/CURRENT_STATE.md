# CURRENT STATE

Atualizado: 2026-10-05 (sessão 5)

## Git
Branch: feature/gestao-online-segura
Commit HEAD: b644fd2

## Estado funcional
- Central privada autenticada e operacional (senha Oba2026!)
- Fluxo DRAFT → PREVIEW → PUBLISHED funcional e aprovado
- Cardápio público funcional em /cardapio — Pg1 Interpretação B aplicada e validada
- Catálogo público funcional em /catalogo — paleta Verde Sálvia aprovada

## Cardápio — estado final aprovado e validado

### Pg1 — Interpretação B (Nossa Essência como título principal)
- `#oba-pag1-titulo` e `#oba-pag1-subtitulo`: ocultos via CSS (`display: none`), DOM intacto
- Título principal: `#pag1-ne-titulo` — Cormorant Garamond 2.6rem/300, cor #3B2A1E, à esquerda
- Rótulo: `#pag1-ne-rotulo` — "CARDÁPIO" com linha decorativa ::after
- Texto: `#pag1-ne-texto` — 14px, #4B5563
- Citação: `#pag1-ne-citacao` — itálico, ♡ via ::after
- Logo: `align-self: flex-start`
- `#pag-1`: `align-items: flex-start`, `max-width: 100%`, padding lateral 28px
- CTA: `navegarPara(2)` intacto
- Cormorant Garamond no `@import` de fonts

### Pg2
- Título: "Nossa Essência"
- Texto condensado, dois parágrafos em um
- Citação em itálico

### Bugs corrigidos em sessões anteriores
- Ícone ← quebrado (←🔲): byte de controle 0x19 removido de 4 locais
- Unificação Pg1+Pg2 (commit 9b49c69)
- CTA movido para após bloco de essência (commit 8f908e6)

### Como textos chegam ao cardápio
1. theme.json local → Static Asset (fallback)
2. D1 PUBLISHED → prevalece sobre o HTML
3. Para atualizar: Central → Edição Visual → Salvar → Publicar

## Catálogo — estado aprovado
- Paleta Verde Sálvia médio (#6B9E7A, #F4F8F4)
- Layout editorial Pg1 unificada
- Float-bar 3 botões: Voltar / WhatsApp / Montar pedido
- Lightbox card branco

## Pontos de retorno seguros
- HEAD atual = b644fd2 (aprovado, validado — Pg1 Interpretação B)
- Anterior estável = 8f908e6

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

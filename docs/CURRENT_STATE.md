# CURRENT STATE

Atualizado: 2026-10-07 (sessão 8)

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 5d5a611

## Estado funcional
- Central privada autenticada e operacional
- Fluxo DRAFT → PREVIEW → PUBLISHED funcional
- Cardápio público funcional em /cardapio — Pg1 Interpretação B + refinamentos
- Catálogo público funcional em /catalogo — Verde Sálvia + Ed. Visual Etapa A

## Cardápio — estado atual
### Pg1
- Título/subtítulo originais: ocultos. Título "Nossa Essência": Cormorant Garamond 2.4rem/500
- 2 parágrafos: pag1-ne-texto (D1 nossa_essencia.texto) + pag1-ne-texto-2 (D1 nossa_essencia.texto2)
- Citação: 14px, centralizada. CTA: py-3.5, max-w-280px, centralizado
### Pg3
- Labels .oba-btn-label: 15px/500, subtítulo 13px, ícones 1.5rem/.35
### Fluxo
- Categorias: grid 3 colunas, secao-passo1/2: padding 16px, mt 12px

## Catálogo — estado atual
- Paleta Verde Sálvia (#6B9E7A, #F4F8F4)
- Ed. Visual Etapa A: catHidratarTema(), catMontarPg1/Pg3 com cores+logo+tipografia
- catAbrirGrupo: lê temaCatalogo.grupos com fallback
- **Ed. Visual Pg3/4 profissional (sessão 8):**
  - Estado ativo/inativo por grupo (artesanais/finos)
  - Cor do subtítulo por grupo
  - Cor de fundo da Pg4 por grupo
  - Tipografia granular por grupo (tam+peso título + tam+peso subtítulo)
- theme-catalogo.json schemaVersion 3 (campos novos adicionados retrocompativelmente)

## Central — estado atual
- ✏️ Ed. Visual Cardápio: Páginas (Pg1/Pg2/Pg3) + Tema Global (intacto)
- 🗂️ Ed. Visual Catálogo: sub-abas Páginas/Tema Global completas
  - Pg3/4 profissional: ativo/inativo, corSubtitulo, corFundo, tipografia (sessão 8)
- obaSaveDraftWith('tema_catalogo', ...) salva no D1 e sincroniza GitHub

## Pontos de retorno seguros
- HEAD atual = 5d5a611
- Anterior = 4789a82

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 6a2a2bb

## Estado funcional
- Central privada autenticada e operacional
- Fluxo DRAFT → PREVIEW → PUBLISHED funcional
- Cardápio público funcional em /cardapio — Pg1 Interpretação B + refinamentos visuais
- Catálogo público funcional em /catalogo — Verde Sálvia + Edição Visual implementada

## Cardápio — estado atual aprovado

### Pg1 — Interpretação B
- Título/subtítulo originais: ocultos via CSS (DOM intacto)
- Título principal: "Nossa Essência" — Cormorant Garamond 3rem/500
- 2 parágrafos de texto fixos no HTML
- Citação: 14px, centralizada
- CTA: py-3.5, max-w-280px, shadow-md

### Pg3 — Menu Principal
- Labels .oba-btn-label: 15px/500
- Subtítulo: 13px/rgba(139,69,19,0.85)
- Ícones brancos: opacity .35

### Fluxo
- Categorias: grid 3 colunas
- Resumo caixa: text-left

## Catálogo — estado atual aprovado
- Paleta Verde Sálvia (#6B9E7A)
- Layout editorial Pg1 unificada
- Edição Visual (12C-4): theme-catalogo.json + hidratação + formulário na Central

## Central — estado atual
- Edição Visual cardápio: avisos Pg1/Pg2 sobre relação dos campos
- Edição Visual catálogo: formulário "Catálogo Pg1" funcional
- Pipeline completo funcional

## Pontos de retorno seguros
- HEAD atual = 6a2a2bb
- Anterior = 9376512

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

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

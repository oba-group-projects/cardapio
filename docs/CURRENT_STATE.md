# CURRENT STATE

Atualizado: 2026-10-04

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 8da620d
Tag de marco anterior: v12C-pre-4 (9c011b3)

## Estado funcional
- Central privada autenticada e operacional (senha Oba2026!)
- Fluxo DRAFT → PREVIEW → PUBLISHED funcional e aprovado
- Badge de status atualiza automaticamente após cada salvamento
- Cardápio público funcional em /cardapio
- Catálogo público funcional em /catalogo — APROVADO
- Módulo de Propostas completo (12A + 12B)

## Catálogo (/catalogo) — entregue e aprovado nesta sessão

### Layout editorial (Pg1 unificada)
- Logo vertical no topo esquerdo (100px, fallback textual "Oba / DOCERIA")
- Rótulo "CATÁLOGO —" em uppercase tracking
- Título Cormorant Garamond 48px/600: "Descubra a Oba"
- Dois parágrafos de texto
- CTA "Conhecer nossos sabores →" vai direto para Pg3

### Pg3 — Menu de grupos
- Logo horizontal centralizada
- Subtítulo 15px uppercase: "ESCOLHA O TIPO DE DOCE"
- Botões Doces Artesanais (destaque terracota) e Doces Finos
- Botão Voltar pill com borda

### Pg4 — Sabores
- Título 32px/600 em terracota
- Subtítulo 11px uppercase tracking
- Abas agrupadas por nome base (Tradicionais / Clássicos / Especiais)
- Grid 2 colunas com sombra suave e lupa
- Scroll funcionando (position:relative removido)
- Float-bar fora do #pg-4: [← Voltar] [Pedir WPP] [Montar pedido]
- Lightbox: card branco + foto aspect-ratio:1 + nome + ×

### Paleta Rosa Creme
- --brand: #C2735A (terracota suave)
- --bg: #FDF6F0 (creme rosado)
- --line: #F0D5C8 (bege rosado)

## Worker — melhorias desta sessão
- Handler: (request, env, ctx)
- ctx.waitUntil para sync GitHub
- try/catch global no bloco /api/
- Gate pós-write protegido

## Fase 12C — Catálogo de Sabores
- ✅ 12C-1: Campo grupoCatalogo nas categorias
- ✅ 12C-2: Rota /catalogo + HTML
- ✅ 12C-3: Dados reais conectados + redesign visual aprovado
- ⬜ 12C-4: Edição Visual do Catálogo na Central

## Próximo
- Redesign Pg1/Pg2 do cardápio seguindo padrão do catálogo
- Ver restrições críticas no HANDOFF.md antes de tocar

## Pontos de retorno seguros
- Tag v12C-pre-4 = 9c011b3 (antes desta sessão)
- HEAD atual = 8da620d (estável, aprovado)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

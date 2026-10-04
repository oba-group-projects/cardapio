# HANDOFF

Atualizado: 2026-10-04

Branch: feature/gestao-online-segura
HEAD: 8da620d
Tag de marco atual: v12C-pre-4 (base) — sessão de catálogo

## Última entrega
Catálogo de Sabores (/catalogo) — redesign visual completo, layout editorial, aprovado

## Commits recentes relevantes
| Commit   | O que fez |
|----------|-----------|
| 8da620d  | fix: botão Montar pedido com ícone + duas linhas |
| 9a4f9fc  | fix: botão Voltar na float-bar junto com WPP e Montar pedido |
| d35886a  | fix: título Pg1 negrito, Pg3 subtítulo maior, Pg4 scroll + títulos maiores |
| e92c601  | fix: float-bar fora do #pg-4, lightbox card branco, Pg3 destacado |
| 8d378e7  | feat: unificar Pg1+Pg2 — layout editorial, título grande, dois parágrafos |
| 3c4c7d6  | feat: redesign paleta Rosa Creme + logos + tipografia |
| 807a2fb  | fix: badge de status atualiza após cada salvamento |
| 79d9a14  | fix: ctx.waitUntil + try/catch /api/ + gate pós-write Worker |

## O que está funcionando (8da620d)

### Catálogo (/catalogo) — APROVADO
- **Pg1 (abertura):** layout editorial, logo vertical, rótulo "CATÁLOGO —", título Cormorant 48px/600 "Descubra a Oba", dois parágrafos, CTA direto para Pg3
- **Pg3 (menu de grupos):** logo horizontal, subtítulo 15px uppercase, botões Artesanais/Finos, Voltar pill
- **Pg4 (sabores):** título 32px/600, subtítulo 11px, abas por nome base, grid 2 colunas, scroll ok
- **Float-bar:** [← Voltar] [Pedir via WhatsApp] [Montar pedido ícone+2 linhas] — fora do #pg-4, position:fixed real
- **Lightbox:** card branco + foto + nome + × — estilo cardápio
- **Paleta:** Rosa Creme (#C2735A, #FDF6F0, #F0D5C8)

### Fluxo de publicação — APROVADO
- Badge atualiza automaticamente após qualquer salvamento
- atualizarStatus() em 6 pontos: salvarEditor, obaToggleStatus, form loja, obaSalvarPaginaDoTema, remover seção, salvar seção extra
- Worker: ctx.waitUntil sync GitHub, try/catch /api/, gate pós-write protegido

### Central — funcional
- DRAFT → PREVIEW → PUBLISHED operacional
- Edição Visual completa (Pg1, Pg2, Pg3, Vitrine, Modais, Tema, Seções extras)
- Catálogo: campo grupoCatalogo nas categorias (Doces Artesanais / Doces Finos)

## Pendente — próximas sessões

### Redesign do Cardápio (/cardapio) — Pg1 e Pg2
- Seguir padrão visual do catálogo (layout editorial, tipografia maior)
- RESTRIÇÕES CRÍTICAS (não alterar):
  - `onclick="navegarPara(2)"` no CTA da Pg1 — querySelector do JS depende disso
  - Classe `glass-card` no container da Pg2
  - Classe `bg-orange-200/60` no separador da Pg2
  - IDs: oba-pag1-logo, oba-pag1-titulo, oba-pag1-subtitulo, oba-pag1-cta, oba-pag1-btn-cta, oba-pag2-logo, oba-pag2-titulo, oba-pag2-texto, oba-pag2-citacao

### 12C-4 — Edição Visual do Catálogo na Central
- Aba "Catálogo" com configurações editáveis (textos, logo, toggle preços)
- Reservado após homologação completa do layout

## Ponto de retorno seguro
HEAD atual = 8da620d (estável, aprovado em produção)
Tag anterior = v12C-pre-4 = 9c011b3

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

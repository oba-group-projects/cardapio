# CURRENT STATE

Atualizado: 2026-09-23

## Git
Branch: feature/gestao-online-segura
Commit HEAD: ca003b1
Branch main: 5913078

## Estado funcional
- Central privada autenticada e operacional
- Fluxo DRAFT → PREVIEW → PUBLISHED com rollback e histórico
- Cardápio público: páginas 1/2/3 fixas, passo 1 sem scroll
- Vitrine Presenteáveis: lista compacta, tela de detalhe por kit, Degustação integrada
- Módulo de Propostas de Orçamento (12A-1 e 12A-2 concluídas)

## Fases concluídas (12A)
- 12A-1: D1 migrations (proposals, proposal_scenarios, proposal_items) + rotas Worker
  - GET/POST /api/proposals, GET/PUT /api/proposals/:id, PATCH /api/proposals/:id/status
  - GET /proposta/:id (pública — retorna JSON por ora)
- 12A-2: Aba Propostas na Central
  - Editor com dados do evento + resumo geral
  - Cenários com: doces/convidado × convidados = total doces
  - Categorias abertas automaticamente, recolhidas por padrão (acordeão)
  - Total por categoria com contador (restando/completo/excedeu)
  - Contador global (faltam X nas categorias)
  - Estimativa financeira usando precoReferencia da categoria
  - Sabores expandíveis dentro de cada categoria
  - Itens livres (frete, montagem, etc)
  - Desconto por cenário (R$ ou %)
  - Copiar cenário anterior ao adicionar novo
  - Botões: Salvar / Enviar Proposta / Copiar Link / Ver+PDF
  - Listagem: ✏️ Editar · 🔗 Link · 📄 PDF · Status
  - CSRF corrigido (__Host-oba_csrf + X-CSRF-Token)
  - Restauração ao editar corrigida (__total__ tratado separadamente)

## Próxima fase
12A-3 — Página pública /proposta/:id
- HTML bonito, mobile-first, identidade visual Oba Doceria
- 3 cenários navegáveis (abas ou accordion)
- CTA "Quero este cenário" → WhatsApp pré-formatado
- Validade visível
- CSS @media print para geração de PDF via window.print()

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- GitHub: https://github.com/oba-group-projects/cardapio

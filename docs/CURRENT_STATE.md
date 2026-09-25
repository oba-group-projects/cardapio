# CURRENT STATE

Atualizado: 2026-09-24

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 7f8d230
Branch main: 5913078

## Estado funcional
- Central privada autenticada e operacional
- Fluxo DRAFT → PREVIEW → PUBLISHED com rollback e histórico
- Cardápio público: páginas 1/2/3 fixas, passo 1 sem scroll
- Vitrine Presenteáveis: lista compacta, tela de detalhe por kit, Degustação integrada
- Módulo de Propostas de Orçamento (12A-1, 12A-2 e 12A-3 concluídas)

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
- 12A-3: Página pública /proposta/:id — redesign completo
  - Página 0: 3 cards de resumo (badge, nome, descrição, pills convidados/doces, valor, botão "Ver detalhes")
  - Páginas 1/2/3: detalhe individual por cenário (show/hide JS, sem reload)
  - Barra sticky no topo de cada detalhe: "Voltar" + navegação entre cenários
  - Rodapé de navegação espelhado em cada detalhe
  - CTA: "Escolhi este cenário — vamos conversar"
  - Mensagem WhatsApp: "Oba! Recebi a proposta e quero seguir com o Cenário X – Nome (R$ X). Vamos fechar os detalhes?"
  - campo texto_publico por cenário preservado (prioridade sobre intro automática)

## Próxima fase
Deploy: executar EXECUTAR-9AB-DEPLOY.cmd para levar 7f8d230 ao Cloudflare

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- GitHub: https://github.com/oba-group-projects/cardapio

# CURRENT STATE

Atualizado: 2026-09-24

## Git
Branch: feature/gestao-online-segura
Commit HEAD: ac87851
Branch main: 5913078

## Estado funcional
- Central privada autenticada e operacional
- Fluxo DRAFT → PREVIEW → PUBLISHED com rollback e histórico
- Cardápio público: páginas 1/2/3 fixas, passo 1 sem scroll
- Vitrine Presenteáveis: lista compacta, tela de detalhe por kit, Degustação integrada
- Módulo de Propostas de Orçamento (12A-1, 12A-2 e 12A-3 concluídas)

## Fases concluídas (12A)
- 12A-1: D1 migrations (proposals, proposal_scenarios, proposal_items) + rotas Worker
- 12A-2: Aba Propostas na Central (editor completo, cenários, estimativa, CSRF, restauração)
- 12A-3: Página pública /proposta/:id — redesign com 4 páginas de navegação
  - PG0 — Abertura personalizada: logo, nome do cliente, bloco de info do evento,
    texto gerado dinamicamente (evento, data, convidados, cenários), citação opcional,
    botão "Ver minha proposta"
  - PG1 — Resumo compacto: 3 cards com borda colorida por cenário, número grande,
    nome, pills (doces/pessoa, total de doces), valor e botão "Ver detalhes"
  - PG2/3/4 — Detalhe por cenário: topbar sticky (Voltar + navegar entre cenários),
    tabela de itens, CTA "Escolhi este cenário — vamos conversar"
  - WhatsApp: "Oba! Recebi a proposta e quero seguir com o Cenário X – Nome (R$ X). Vamos fechar os detalhes?"
  - PDF: capa (pg0) + resumo (pg1) + 1 cenário por página via @media print
  - Strings JS puras (sem template literals aninhados) para estabilidade

## Próxima fase
Deploy: executar EXECUTAR-9AB-DEPLOY.cmd para levar ac87851 ao Cloudflare e homologar ao vivo

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- GitHub: https://github.com/oba-group-projects/cardapio

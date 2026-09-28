# CURRENT STATE

Atualizado: 2026-09-27

## Git
Branch: feature/gestao-online-segura
Commit HEAD: a8d7312
Tag estável anterior: v12B-baseline (ded3c58)
Branch main: 5913078

## Estado funcional
- Central privada autenticada e operacional
- Fluxo DRAFT → PREVIEW → PUBLISHED com rollback e histórico
- Cardápio público funcional
- Módulo de Propostas completo: Evento (12A) + Corporativo e Sazonal (12B)

## Fases concluídas
- **12A-1:** D1 migrations + rotas Worker (proposals, scenarios, items)
- **12A-2:** Aba Propostas na Central (editor completo)
- **12A-3:** Página pública /proposta/:id — 4 páginas, texto emocional, cards delicados
- **12A-4:** Status inline, Excluir, campo Abertura, migration 0007
- **12B completo:** Redesign Corporativo e Sazonal com proposal_options
  - Migrations 0011-0014: proposal_options, option_id em media, faixas, briefing
  - Rotas Worker: POST/PUT/DELETE /options, /options/:id/media, duplicate corrigido
  - Central: obaAdicionarOpcao, obaOpcaoProcessarImagem, obaPreencherCamposSazonais
  - Páginas públicas corporativo e sazonal usam proposal.options (foto + faixas)
  - Cenários ocultos em Corp/Sazonal; apenas Evento usa cenários

## Arquitetura de opções (Corp/Sazonal)
```
proposal
  └── proposal_options (máx. 5)
        ├── proposal_option_faixas (ate, preco, ordem)
        └── proposal_media (option_id, dados Base64)
```

## Próxima fase — 12C (pendente)
Catálogo de Festas — vitrine pública `/festas` no Worker, sem fluxo de pedido.
CTA único: "Quero um orçamento" → WhatsApp.
Iniciar somente após 12B homologada em produção.

## Ponto de retorno seguro
Tag git: v12B-baseline (commit ded3c58) — estado antes do redesign 12B.
Commit atual: a8d7312 — 12B completo, deployado.

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- GitHub: https://github.com/oba-group-projects/cardapio

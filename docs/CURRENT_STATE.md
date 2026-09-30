# CURRENT STATE

Atualizado: 2026-09-30

## Git
Branch: feature/gestao-online-segura
Commit HEAD: b93cc02
Branch main: 5913078

## Estado funcional
- Central privada autenticada e operacional
- Fluxo DRAFT → PREVIEW → PUBLISHED com rollback e histórico
- Cardápio público funcional
- Módulo de Propostas completo: Evento (12A) + Corporativo e Sazonal (12B + rev1–rev7)

## Fases concluídas
- **12A completa:** proposals, scenarios, items, página pública /proposta/:id
- **12B completa:** proposal_options, faixas De-Até, mídia por opção, briefing corporativo
- **12B-rev1:** fix validação por template, faixas dinâmicas, campo frequência, obs sazonal
- **12B-rev2:** redesign visual Corp/Sazonal + faixas De-Até + migration 0015
- **12B-rev3:** redesign editorial final — fundo claro, textos emocionais 2 parágrafos
- **12B-rev4:** coluna Tipo na tabela, paginação por opção, PDF profissional
- **12B-rev5 (a–d):** ajustes visuais pg0/pg1/pg2 corporativo aprovados
  - Logo real 64px, parágrafos uniformes Plus Jakarta Sans 13px
  - Sem chips de briefing na pg0
  - Pg1 flex container, rodapé ancorado no fundo via margin-top:auto
  - Pg2/3: padding-top:14vh → justify-content:center
  - Cards índice: 80px/22px/15px
  - Botões: PDF outline + WhatsApp suave com ícone SVG
- **12B-rev6:** sazonal mesmo layout corporativo; copiar última opção (sazonal); duplicar (corporativo)
- **12B-rev7:** textos aprovados aplicados no sazonal (2 parágrafos por data)
  - Limpo campo `abertura` das propostas sazonais no D1 (texto antigo curto removido)
  - Foto hero 260px, faixas 6px, det-page justify-content:center

## Estado atual da proposta sazonal
- Todos os textos pg0 usam os aprovados nesta sessão (Natal, Páscoa, Mães, Pais, Namorados, Crianças, genérico)
- Campo `abertura` no D1 limpo para NULL em todas as propostas sazonais existentes
- Ao criar nova proposta sazonal: `obaPreencherCamposSazonais()` preenche `prop-abertura-saz` com os textos aprovados (2 parágrafos separados por \n\n)

## Próxima fase — 12C (pendente)
Catálogo de Festas — vitrine pública `/festas` no Worker.
Iniciar somente após 12B homologada em produção.

## Ponto de retorno seguro
Tag git: v12B-baseline (ded3c58) — antes do redesign 12B.
Commit atual: b93cc02 — 12B-rev7 completo, deployado.

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- GitHub: https://github.com/oba-group-projects/cardapio

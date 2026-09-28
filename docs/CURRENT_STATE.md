# CURRENT STATE

Atualizado: 2026-09-27

## Git
Branch: feature/gestao-online-segura
Commit HEAD: f2c7809
Tag estável anterior: v12B-baseline (ded3c58)
Branch main: 5913078

## Estado funcional
- Central privada autenticada e operacional
- Fluxo DRAFT → PREVIEW → PUBLISHED com rollback e histórico
- Cardápio público funcional
- Módulo de Propostas completo: Evento (12A) + Corporativo e Sazonal (12B + rev1 + rev2)

## Fases concluídas
- **12A completa:** proposals, scenarios, items, página pública /proposta/:id
- **12B completa:** proposal_options, faixas, mídia por opção, briefing corporativo
- **12B-rev1:** fix validação por template, faixas dinâmicas, campo frequência, observações sazonal
- **12B-rev2:** redesign visual Corporativo e Sazonal + faixas De-Até
  - Migration 0015: coluna `de` em `proposal_option_faixas`
  - Corporativo: paleta esmeralda escuro + cobre; pg0 impactante com chips de briefing
  - Sazonal: paletas temáticas por data comemorativa; pg0 emocional sem condições
  - Condições do sazonal movidas para rodapé de pg1
  - Faixas formato "De X a Até Y un." com dois campos editáveis

## Arquitetura de opções (Corp/Sazonal)
```
proposal
  └── proposal_options (máx. 5)
        ├── proposal_option_faixas (de, ate, preco, ordem)
        └── proposal_media (option_id, dados Base64)
```

## Paletas visuais
- **Evento:** dourado quente #C8922A + bege #F9E4BE + marrom #3B2A1E
- **Corporativo:** esmeralda #1C3B2E + cobre #C8922A + creme #FAFAF6
- **Sazonal:** temática por data (Natal=vinho, Páscoa=roxo, Mães=rosa, Pais=azul, Namorados=bordô, Crianças=laranja)

## Próxima fase — 12C (pendente)
Catálogo de Festas — vitrine pública `/festas` no Worker.
Iniciar somente após 12B homologada em produção.

## Ponto de retorno seguro
Tag git: v12B-baseline (ded3c58) — estado antes do redesign 12B.
Commit atual: f2c7809 — 12B-rev2 completo, deployado.

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- GitHub: https://github.com/oba-group-projects/cardapio

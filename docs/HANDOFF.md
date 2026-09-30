# HANDOFF

Atualizado: 2026-09-30

Branch: feature/gestao-online-segura
HEAD: b93cc02
Tag estável anterior: v12B-baseline (ded3c58)

## Ultima fase entregue
12B-rev7 — Textos aprovados no sazonal, ajustes visuais finais

## Commits recentes
| Commit   | O que fez |
|----------|-----------|
| b93cc02  | fix: textos sazonal aprovados em obaPreencherCamposSazonais; abertura limpada no D1 |
| 404b857  | feat(12B-rev7): textos aprovados sazonal; det-page justify-center; foto 260px; faixas 6px |
| badbd53  | feat(12B-rev6): sazonal layout corp; copiar opcao sazonal; duplicar corp |
| fca1a79  | fix: botoes pg1 menos agressivos — PDF outline discreto, WhatsApp menor e mais leve |
| 334e798  | fix: cards opcoes maiores — foto 80px, nome 22px, preco 15px, padding maior |

## O que está funcionando (b93cc02)
- Proposta Corporativa: pg0 logo 64px + texto 2 parágrafos PlusJakarta 13px + assinatura Cormorant suave; pg1 índice com cards 80px/22px/15px + rodapé no fundo; pg2+ uma opção por página centralizada verticalmente
- Proposta Sazonal: mesmo layout do corporativo com paletas temáticas por data; textos emocionais aprovados (2 parágrafos completos) para cada data comemorativa; condições em 1 linha compacta na pg0
- Tabela de propostas na Central: coluna Tipo com badge colorido por template
- Copiar última opção ao adicionar nova (Sazonal)
- Botão Duplicar em cada card de opção (Corp/Sazonal)
- PDF @media print profissional: pg abertura + uma opção por folha A4

## Comportamento do campo `abertura`
O Worker usa `proposal.abertura` se preenchido. Se NULL/vazio, usa os textos do objeto `textos{}` por data.
O campo foi zerado no D1 para todas as propostas sazonais existentes (via UPDATE).
Ao criar nova proposta sazonal na Central, `obaPreencherCamposSazonais()` preenche com os textos aprovados.

## Próxima implementação — Fase 12C
Catálogo de Festas — vitrine pública `/festas`:
- Rota pública sem autenticação
- Exibe categorias + doces finos para eventos
- Sem fluxo de pedido — CTA único WhatsApp
- **Pré-requisito:** homologar 12B em produção

## Ponto de retorno seguro
Tag: `v12B-baseline` = commit `ded3c58` — antes do redesign 12B.

## Arquivos críticos
- online/gestao/src/index.js
- online/gestao/public/index.html
- online/gestao/migrations/ (0001 a 0015)
- docs/CURRENT_STATE.md
- docs/HANDOFF.md
- docs/PLANO_EXECUCAO.md

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

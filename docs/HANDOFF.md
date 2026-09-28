# HANDOFF

Atualizado: 2026-09-27

Branch: feature/gestao-online-segura
HEAD: f2c7809
Tag estável anterior: v12B-baseline (ded3c58)

## Ultima fase entregue
12B-rev2 — Redesign visual Corporativo e Sazonal + faixas De-Até

## Commits recentes
| Commit   | O que fez |
|----------|-----------|
| f2c7809  | feat(12B-rev2): redesign visual Corp/Sazonal + faixas De-Ate |
| 943df8e  | fix(12B-rev1): validacao por template, faixas dinamicas, frequencia, obs sazonal |
| 843d06e  | docs: handoff sessao 12B |
| a8d7312  | feat(12B): redesign Corporativo e Sazonal com proposal_options |
| ded3c58  | docs: checkpoint v12B-baseline |

## O que está funcionando (f2c7809)
- Propostas Evento: cenários, itens, faixas, PDF — sem mudança
- Propostas Corporativo:
  - Pg0 escura: esmeralda + cobre, chips de briefing, texto contextualizado
  - Pg1: lista de opções com acento verde-esmeralda
  - Pg2+: detalhe com foto, faixas De-Até, CTA WhatsApp por opção
- Propostas Sazonal:
  - Pg0 escura emocional com paleta temática por data comemorativa
  - Pg1: cards de produto com foto hero + faixas De-Até + "a partir de"
  - Condições (prazos, pagamento) no rodapé de pg1, não na abertura
  - Pg2+: hero grande, galeria extra, faixas, CTA WhatsApp
- Faixas formato "De X a Até Y un." com dois campos editáveis na Central
- Migration 0015: coluna `de` em `proposal_option_faixas`

## Paletas visuais
| Template | Pg0 | Acento | Fundo claro |
|----------|-----|--------|-------------|
| Evento | dourado romântico | #C8922A | #FFF8EE |
| Corporativo | esmeralda #1C3B2E | #C8922A cobre | #FAFAF6 |
| Natal | vinho #5C1220 | #D4A843 ouro | #FDF8F0 |
| Páscoa | roxo #2E1A5C | #C8922A | #FAF8FF |
| Dia das Mães | rosa-bordô #6B1A38 | #E8A0B8 | #FFF5F8 |
| Dia dos Pais | azul noturno #0E2440 | #C8922A | #F5F8FF |
| Dia dos Namorados | bordô #4A0E1A | #E8A0A8 | #FFF5F5 |
| Dia das Crianças | laranja escuro #5A2200 | #F5D060 | #FFFBF2 |

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

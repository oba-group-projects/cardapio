# HANDOFF

Atualizado: 2026-09-27

Branch: feature/gestao-online-segura
HEAD: a8d7312
Tag estável anterior: v12B-baseline (ded3c58)

## Ultima fase entregue
12B completo — Redesign Corporativo e Sazonal com `proposal_options`

## Commits recentes
| Commit   | O que fez |
|----------|-----------|
| a8d7312  | feat(12B): redesign Corporativo e Sazonal com proposal_options |
| ded3c58  | docs: checkpoint v12B-baseline — estado estável antes do redesign 12B |
| b426272  | feat(12B): templates Corporativo e Sazonal completos |
| e828a73  | docs: handoff sessão 12A-3 + 12A-4 |
| 85525cf  | fix: remove valor da mensagem WhatsApp CTA |

## O que está funcionando (a8d7312)
- Cardápio público e Central 100% operacionais
- Propostas Evento: completo (cenários, itens, faixas de preço, PDF)
- Propostas Corporativo: opções com foto, faixas, briefing (qtd/orçamento/entrega)
- Propostas Sazonal: opções com foto, faixas, data comemorativa, pré-preenchimento
- Modal de seleção de template ao criar proposta
- Rotas de options (POST/PUT/DELETE) + mídia por opção
- Duplicar proposta: copia opções + faixas + imagens
- Status inline editável (6 opções), Excluir rascunho
- Páginas públicas Corporativo e Sazonal: foto grande + faixas + CTA WhatsApp

## Arquitetura de opções (Corp/Sazonal)
- Nova tabela `proposal_options` (máx. 5 por proposta)
- `proposal_media.option_id` vincula imagem à opção
- `proposal_option_faixas` tabela de preços por volume
- `proposals`: `qtd_solicitada`, `orcamento_max`, `data_entrega`, `data_comemorativa`
- Template Evento: usa cenários (sem mudança)

## Próxima implementação — Fase 12C
Catálogo de Festas — vitrine pública `/festas`:
- Rota pública no Worker (sem autenticação)
- Exibe categorias do catálogo + doces finos para eventos
- Sem fluxo de pedido — apenas visualização
- CTA: "Quero um orçamento" → WhatsApp
- **Pré-requisito:** homologar 12B em produção

## Ponto de retorno seguro
Tag: `v12B-baseline` = commit `ded3c58` — estado antes do redesign 12B.

## Arquivos críticos
- online/gestao/src/index.js
- online/gestao/public/index.html
- online/gestao/migrations/ (0001 a 0014)
- docs/CURRENT_STATE.md
- docs/HANDOFF.md
- docs/PLANO_EXECUCAO.md

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md e ROADMAP.md antes de alterar código.

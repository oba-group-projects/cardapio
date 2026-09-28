# HANDOFF

Atualizado: 2026-09-25

Branch: feature/gestao-online-segura
HEAD: b426272
Tag estável: v12B-baseline

## Ultima fase entregue
12B (infraestrutura base) — Templates Corporativo e Sazonal

## Commits recentes
| Commit   | O que fez |
|----------|-----------|
| b426272  | feat(12B): templates Corporativo e Sazonal completos |
| 5f528c0  | docs: atualiza PLANO_EXECUCAO com 12A concluida e 12B aprovada |
| e828a73  | docs: handoff sessao 12A-3 + 12A-4 |
| 85525cf  | fix: remove valor da mensagem WhatsApp CTA |
| ecbc167  | feat(12A-4): deletar rascunho + status inline + abertura no D1 |

## O que está funcionando (v12B-baseline)
- Cardápio público e Central 100% operacionais
- Propostas: Evento (completo), Corporativo (base), Sazonal (base)
- Modal de seleção de template ao criar proposta
- Rotas de mídia por proposta (upload Base64, serve imagem, DELETE)
- Duplicar proposta (copia dados + cenários + imagens)
- Status inline editável (6 opções), Excluir rascunho

## Próxima implementação — 12B redesign
**Decisões aprovadas:**
- `proposal_options`: nova tabela substituindo cenários para Corp/Sazonal
- `proposal_media`: adicionar coluna `option_id`
- `proposal_option_faixas`: tabela de preços por volume por opção
- Campo "data comemorativa" no Sazonal (select + pré-preenchimento)
- Galeria dentro de cada opção (não global)
- Briefing Corporativo: quantidade, orçamento máximo, data/hora entrega
- Máximo 5 opções por proposta Corp/Sazonal
- Layout opção: foto grande + descrição + faixas de preço
- Template Evento: NÃO muda

**Ponto de retorno:** tag v12B-baseline = commit b426272

## Arquivos críticos
- online/gestao/src/index.js
- online/gestao/public/index.html
- online/gestao/migrations/ (0001 a 0010)
- docs/CURRENT_STATE.md
- docs/HANDOFF.md
- docs/PLANO_EXECUCAO.md

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md e ROADMAP.md antes de alterar código.

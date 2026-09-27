# HANDOFF

Atualizado: 2026-09-25

Branch: feature/gestao-online-segura
HEAD: 85525cf

## Ultima fase entregue
12A-4 — Melhorias na listagem de propostas (completo)

## Commits desta sessão (mais recente primeiro)
| Commit   | O que fez |
|----------|-----------|
| 85525cf  | fix: remove valor da mensagem WhatsApp CTA |
| e24af53  | fix: mensagem WhatsApp CTA mais proxima e natural |
| ecbc167  | feat(12A-4): deletar rascunho + status inline + abertura no D1 |
| ff10cda  | fix(12A-3): remove res-sub + caps para caixa mista via JS |
| d2e1eff  | feat(12A-3): texto encantador + cenario mais delicado |
| bebcc3b  | feat(12A-3): paraD encerramento + cards delicados |
| d45d009  | fix(12A-3): card menor + pg1 respiro + PDF centralizado |
| a81dc2e  | fix(12A-3): reverte centralização mobile + PDF |

## O que está funcionando
- Página pública /proposta/:id completa (12A-3):
  - Pg0: abertura personalizada com texto emocional (usa campo abertura > resumo > automático)
  - Pg1: resumo compacto dos 3 cenários com cards delicados
  - Pg2/3/4: detalhe por cenário, navegação sticky, tabela com caixa mista
  - CTA: "Escolhi este cenário — vamos conversar"
  - WhatsApp: "Olá, Oba Doceria! Gostei do Cenário X – Nome. E agora, quais os próximos passos?"
  - PDF: @page{margin:14mm 18mm}, cenários com padding-top para centralizar
- Central — Propostas (12A-4):
  - Status editável inline com select colorido (Rascunho/Enviada/Em negociação/Aceita/Recusada/Arquivada)
  - Botão Excluir visível só para rascunhos (confirm + DELETE com CASCADE)
  - Campo "Texto da abertura" na Central com contador de caracteres
  - Migration 0007: coluna abertura na tabela proposals

## Próxima fase planejada
12B — Modelo corporativo:
- Seleção de template ao criar (Evento / Corporativo)
- Formulário Corporativo: briefing + itens com foto
- Tabela proposal_media (upload por proposta, D1 Base64)
- Layout público alternativo com galeria de imagens

## Arquivos críticos alterados nesta sessão
- online/gestao/src/index.js
- online/gestao/public/index.html
- online/gestao/migrations/0007_proposals_abertura.sql
- docs/CURRENT_STATE.md
- docs/HANDOFF.md

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md e ROADMAP.md antes de alterar código.

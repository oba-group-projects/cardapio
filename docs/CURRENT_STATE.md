# CURRENT STATE

Atualizado: 2026-09-25

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 85525cf
Branch main: 5913078

## Estado funcional
- Central privada autenticada e operacional
- Fluxo DRAFT → PREVIEW → PUBLISHED com rollback e histórico
- Cardápio público funcional
- Módulo de Propostas completo (12A-1 a 12A-4)

## Fases concluídas (12A)
- 12A-1: D1 migrations + rotas Worker (proposals, scenarios, items)
- 12A-2: Aba Propostas na Central (editor completo)
- 12A-3: Página pública /proposta/:id — 4 páginas, texto emocional, cards delicados
  - Pg0: abertura personalizada (campo abertura > resumo > automático)
  - Pg1: resumo compacto dos 3 cenários
  - Pg2/3/4: detalhe com tabela, navegação sticky
  - WhatsApp: "Olá, Oba Doceria! Gostei do Cenário X – Nome. E agora, quais os próximos passos?"
  - PDF: @page{margin:14mm 18mm}
- 12A-4: Melhorias na listagem
  - Status editável inline (select colorido, 6 opções)
  - Botão Excluir para rascunhos (confirm + CASCADE)
  - Campo "Texto da abertura" na Central com contador
  - Migration 0007: coluna abertura no D1

## Próxima fase
12B — Modelo corporativo:
- Template Evento / Corporativo ao criar proposta
- Formulário Corporativo com briefing + itens + fotos
- Tabela proposal_media (upload por proposta)
- Layout público com galeria de imagens

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- GitHub: https://github.com/oba-group-projects/cardapio

# CURRENT STATE

Atualizado: 2026-09-25

## Git
Branch: feature/gestao-online-segura
Commit HEAD: b426272
Tag estável: v12B-baseline
Branch main: 5913078

## Estado funcional
- Central privada autenticada e operacional
- Fluxo DRAFT → PREVIEW → PUBLISHED com rollback e histórico
- Cardápio público funcional
- Módulo de Propostas completo (12A + 12B infraestrutura base)

## Fases concluídas
- **12A-1:** D1 migrations + rotas Worker (proposals, scenarios, items)
- **12A-2:** Aba Propostas na Central (editor completo)
- **12A-3:** Página pública /proposta/:id — 4 páginas, texto emocional, cards delicados
- **12A-4:** Status inline, Excluir, campo Abertura, migration 0007
- **12B base:** Templates Corporativo e Sazonal — infraestrutura inicial
  - Migrations 0008/0009/0010: campos template, proposal_media, faixas
  - Modal de seleção de template (Evento / Corporativo / Sazonal)
  - Formulários Corporativo e Sazonal na Central
  - Páginas públicas corporativo e sazonal
  - Rotas de mídia por proposta + duplicar proposta

## Próxima fase — 12B redesign (aprovado, não implementado)
Redesign completo da lógica de Corporativo/Sazonal:
- Nova tabela `proposal_options` (substitui cenários para corp/sazonal)
- `proposal_media` ganha coluna `option_id`
- Nova tabela `proposal_option_faixas`
- Campo "data comemorativa" no Sazonal com pré-preenchimento automático
- Galeria dentro de cada opção (não separada)
- Briefing corporativo: quantidade, orçamento máximo, data/hora entrega
- Máximo 5 opções por proposta corporativa/sazonal
- Layout foto + descrição + faixas na página pública
- **Template Evento NÃO muda**

## Ponto de retorno seguro
Tag git: v12B-baseline (commit b426272) — tudo funcional antes do redesign 12B

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- GitHub: https://github.com/oba-group-projects/cardapio

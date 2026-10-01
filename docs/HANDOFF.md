# HANDOFF

Atualizado: 2026-09-30

Branch: feature/gestao-online-segura
HEAD: 5fbff2a
Tag estável anterior: v12B-baseline (ded3c58)
Tag de marco atual: v12C-pre (5fbff2a)

## Última fase entregue
Melhorias de UX pós-12B — ordenação, cards ativos, toggle ativo/pausado na Edição Visual

## Commits recentes relevantes
| Commit   | O que fez |
|----------|-----------|
| 5fbff2a  | feat: toggle ativo/pausado para páginas fixas e seções extras na Edição Visual |
| f2d48ca  | feat: toggle ativo/pausado (antes do rebase) |
| db12b80  | feat: cards mostram ativos em destaque e total discreto |
| df3c81b  | feat: ordenação por coluna nas tabelas da Central (click no th) |
| 88224a4  | feat: ordenar categorias por grupo e número romano nos dropdowns |
| 0d5eeb3  | fix: remover minlength=12 do campo senha no login |

## O que está funcionando (5fbff2a)
- **Autenticação:** senha `Oba2026!`, sem campo Nome, sem distinção de usuário
- **Tabelas da Central:** ordenação por coluna (clique no `<th>`) com seta A→Z / Z→A; padrão Nome A→Z
- **Dropdowns de Categoria:** ordenados por grupo + número romano em todos os formulários
- **Cards de resumo:** número grande = ativos; "de X" = total (aparece só se houver inativos)
- **Toggle ativo/pausado:** checkbox em cada página/módulo fixo e em cada Seção Extra
  - Inativar oculta do cardápio público, preserva conteúdo na Central
  - pag-1 inativa → entra direto na pag-2 (ou pag-3 se ambas inativas)
  - pag-2 inativa → CTA da pag-1 vai direto para pag-3
  - Vitrine/Modais inativos → botões de acesso somem do cardápio
  - Seções Extras inativas → não renderizadas nem exibidas no menu

## Arquivos críticos
- `online/gestao/src/index.js` — Worker (autenticação, rotas, CSRF)
- `online/gestao/public/index.html` — Central de Gestão
- `online/gestao/public/ui-desenvolvimento/index.html` — Cardápio público
- `online/gestao/migrations/` — D1 migrations (0001 a 0015)
- `docs/CURRENT_STATE.md`
- `docs/HANDOFF.md`
- `docs/PLANO_EXECUCAO.md`

## Próxima implementação — Fase 12C
Catálogo de Festas — vitrine pública `/festas`:
- Rota pública sem autenticação
- Exibe categorias + doces finos para eventos
- Sem fluxo de pedido — CTA único WhatsApp
- **Pré-requisito:** homologar estado atual em produção

## Ponto de retorno seguro
Tag: `v12C-pre` = commit `5fbff2a` — estado atual estável, pré-fase 12C.

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

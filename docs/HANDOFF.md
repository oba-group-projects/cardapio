# HANDOFF

Atualizado: 2026-10-01

Branch: feature/gestao-online-segura
HEAD: baca909
Tag de marco atual: v12C-pre-3 (baca909)

## Última entrega
Dropdown "Catálogo" na barra de navegação da Central

## Commits recentes relevantes
| Commit   | O que fez |
|----------|-----------|
| baca909  | feat: dropdown Catálogo com classe própria (sem conflito com .tab) |
| ca5af6e  | revert: rollback para v12C-pre-2 durante debug do dropdown |
| 6755162  | docs: handoff sessão 01/10 parte 1 |
| c527348  | fix: páginas overflow herdam logo/subtítulo da pag-3 |

## O que está funcionando (baca909)
- **Dropdown Catálogo:** botão `oba-catalogo-btn` abre menu com Sabores, Categorias, Caixas, Produtos, Opcionais, Combos; animação suave; fecha ao clicar fora; botão fica marrom quando aba interna está ativa
- **Barra de navegação:** 5 itens — Catálogo ▾, Loja, Edição Visual, Mídia, Propostas
- Tudo da v12C-pre-2 continua funcionando (duplicar, toggle, ver mais, overflow)

## Detalhe técnico do dropdown
- Trigger usa classe `oba-catalogo-btn` — **nunca** `.tab` — evita conflito com handler de tabs
- Fechar: `mousedown` com `contains()` no wrap — mais confiável que `click` no document
- IDs: `oba-catalogo-wrap`, `oba-catalogo-btn`, `oba-catalogo-menu`

## Próxima implementação — Fase 12C
Catálogo de Festas — vitrine pública `/festas`.

## Ponto de retorno seguro
Tag: `v12C-pre-3` = commit `baca909`.

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

# CURRENT STATE

Atualizado: 2026-10-01

## Git
Branch: feature/gestao-online-segura
Commit HEAD: c527348
Tag de marco anterior: v12C-pre (2477185)
Tag de marco atual: v12C-pre-2 (c527348)

## Estado funcional
- Central privada autenticada e operacional (senha Oba2026!)
- Fluxo DRAFT → PUBLISHED em um clique ("Publicar após Preview")
- Cardápio público funcional
- Módulo de Propostas completo: Evento (12A) + Corporativo e Sazonal (12B + rev1–rev7)
- Melhorias de UX na Central (sessão 30/09 + sessão 01/10)

## Fases concluídas
- **12A completa:** proposals, scenarios, items, página pública /proposta/:id
- **12B completa:** proposal_options, faixas De-Até, mídia por opção, briefing corporativo
- **12B-rev1 a rev7:** ajustes visuais, textos aprovados, layout sazonal

## Melhorias sessão 30/09 (v12C-pre)
- Autenticação simplificada: senha única Oba2026!
- Ordenação por coluna nas tabelas da Central
- Dropdowns de Categoria ordenados por grupo + número romano
- Cards de resumo: ativos em destaque, total discreto
- Toggle ativo/pausado na Edição Visual (páginas fixas e seções extras)

## Melhorias sessão 01/10 (v12C-pre-2)
- **Duplicar botão do menu:** botão ⧉ no header de cada card; cópia inserida logo após o original
- **Duplicar Seção Extra:** botão ⧉ no header; cópia nasce com `ativo:false` e `linkMenu.ativo:false`
- **Toggle visibilidade no header do card de botão:** ícone 👁/🚫 sincronizado com checkbox interno
- **"Ver mais" compacto:** linha fina e discreta em vez do bloco largo — evita corte do cabeçalho
- **Páginas de overflow herdam layout da Pág 3:** logo com mesmo tamanho + subtítulo
- **Fix:** seção sem label/título não gera botão fantasma no menu

## Próxima fase — 12C (pendente)
Catálogo de Festas — vitrine pública `/festas` no Worker.
Iniciar somente após homologação completa em produção.

## Pontos de retorno seguros
- Tag `v12B-baseline` = commit `ded3c58` — antes do redesign 12B
- Tag `v12C-pre` = commit `2477185` — sessão 30/09
- Tag `v12C-pre-2` = commit `c527348` — sessão 01/10

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- GitHub: https://github.com/oba-group-projects/cardapio

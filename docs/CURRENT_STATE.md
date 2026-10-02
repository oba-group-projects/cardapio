# CURRENT STATE

Atualizado: 2026-10-01

## Git
Branch: feature/gestao-online-segura
Commit HEAD: baca909
Tag de marco anterior: v12C-pre-2 (6755162)
Tag de marco atual: v12C-pre-3 (baca909)

## Estado funcional
- Central privada autenticada e operacional (senha Oba2026!)
- Fluxo DRAFT → PUBLISHED em um clique ("Publicar após Preview")
- Cardápio público funcional
- Módulo de Propostas completo: Evento (12A) + Corporativo e Sazonal (12B + rev1–rev7)

## Melhorias acumuladas (sessões 30/09 e 01/10)

### Sessão 30/09 (v12C-pre)
- Autenticação simplificada: senha única Oba2026!
- Ordenação por coluna nas tabelas da Central
- Dropdowns de Categoria ordenados por grupo + número romano
- Cards de resumo: ativos em destaque, total discreto
- Toggle ativo/pausado na Edição Visual (páginas fixas e seções extras)

### Sessão 01/10 — parte 1 (v12C-pre-2)
- Duplicar botão do menu: ⧉ no header, cópia inserida logo após o original
- Duplicar Seção Extra: ⧉ no header, cópia nasce pausada
- Toggle visibilidade 👁/🚫 no header do card de botão
- "Ver mais" compacto: linha discreta, evita corte do cabeçalho
- Páginas overflow herdam logo e subtítulo da Pág 3

### Sessão 01/10 — parte 2 (v12C-pre-3)
- Dropdown "📦 Catálogo" agrupa Sabores, Categorias, Caixas, Produtos, Opcionais, Combos
- Barra de navegação reduzida de 10 para 5 itens
- Dropdown com animação, sombra e hover elegante
- Botão Catálogo fica marrom quando uma aba interna está ativa
- Fecha ao clicar fora (mousedown com contains)

## Próxima fase — 12C (pendente)
Catálogo de Festas — vitrine pública `/festas` no Worker.

## Pontos de retorno seguros
- Tag `v12B-baseline` = `ded3c58` — antes do redesign 12B
- Tag `v12C-pre` = `2477185` — sessão 30/09
- Tag `v12C-pre-2` = `6755162` — sessão 01/10 parte 1
- Tag `v12C-pre-3` = `baca909` — sessão 01/10 parte 2

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- GitHub: https://github.com/oba-group-projects/cardapio

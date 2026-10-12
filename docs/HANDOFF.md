# HANDOFF

Atualizado: 2026-10-12 (sessão 18)

Branch: feature/gestao-online-segura
HEAD: afa9536

## Última entrega
Achados UX 2 e 5 implementados e em produção. Verificação do fluxo de publicação (DRAFT→PREVIEW→PUBLISHED) — usuário confirmou que funcionou após orientação sobre a necessidade de criar Preview antes de Publicar.

## Commits desta sessão
| Commit   | O que fez |
|----------|-----------|
| afa9536  | feat(catalogo): float-bar Pg4 configurável — visibilidade e texto dos botões WPP e Montar Pedido via Ed. Visual |
| cf67f05  | fix(catalogo): catVoltarDe — botões Voltar respeitam estado de Pg2, bypass de grupo único |

## Estado atual — TUDO APROVADO E EM PRODUÇÃO

### Editor Visual do Catálogo — COMPLETO (sessões 12–14)

**Pg1:** textos, logo, cores, tipografia
**Pg2 — Seleção de Grupo:**
- Editor dinâmico de grupos: ↑↓, 👁/🚫, ⧉, ✕, "+ Novo grupo"
- Select de ID com grupos existentes + "+ Criar novo grupo..." (com separador)
- Modal inline de criação de categoria — dois modos:
  - *Aviso amarelo (grupo sem categorias):* campo ID bloqueado (disabled), visual cinza/cadeado
  - *"+ Criar novo grupo..." no select:* campo ID editável + sugestão automática a partir do label (slug normalizado), validação de formato
- Após salvar no modal: select atualizado, aviso some, card reflete novo ID
- `edGrupoCatalogo` no editor de Categorias: dinâmico (era hardcoded artesanais/finos)
**Pg3/4 — Grids de Sabores:**
- Editor dinâmico por grupo (sem hardcode artesanais/finos)
- `catEdRenderizarGruposPg34` gera blocos de ativo/inativo + titulo/subtitulo + cores + tipografia para cada grupo existente no catálogo
- `catEdLerGruposPg34` lê todos os valores do DOM
- Salvar Pg3/4 sem ter aberto Pg2: preserva grupos_ordem[] existente (fallback para dados em memória)
**Tema Global:** paleta, fonte, tipografia, arredondamento

**Schema v4 (theme-catalogo.json):**
- `pg2.grupos_ordem[]`: `[{ id, label, sublabel, icone, destaque, visivel }]`
- Retrocompatível com v3 via fallback nos campos legados
- `grupos{}` mantido para configurações de Pg4

**Catálogo público (ui-catalogo/index.html):**
- `catMontarPg3()`: itera `grupos_ordem[]` sem hardcode
- `catAbrirGrupo()`: título/subtítulo de `grupos{}` → `grupos_ordem[]` → fallback genérico
- `catNavegar()`: lógica de único grupo generalizada para N grupos

**Funções da Central (todas as novas):**
`catEdAdicionarCardGrupo`, `catEdAdicionarGrupo`, `catEdRestaurarGrupos`,
`catEdRemoverGrupo`, `catEdDuplicarGrupo`, `catEdToggleVisivel`,
`catEdMoverGrupo`, `catEdEscolherIcone`, `catEdAtualizarNumeracao`, `catEdLerGrupos`,
`catEdPopularSelectGrupo`, `catEdOnGrupoIdChange`, `catEdAtualizarGrupoId`,
`catEdIdsGruposDisponiveis`, `catAbrirModalCategoria`, `catFecharModalCategoria`,
`catSalvarModalCategoria`, `catModalGrupoIdInput`,
`catEdRenderizarGruposPg34`, `catEdLerGruposPg34`, `catEdGerarBlocoPg34`

### Módulo de Contratos — estado sessão 11 (sem alterações nesta sessão)
Ver HANDOFF sessão 11 para detalhes.

## REGRAS TÉCNICAS CRÍTICAS
1. Nunca usar Set-Content/Out-File do PowerShell — adiciona BOM
2. theme.json = cardápio. theme-catalogo.json = catálogo. NUNCA misturar.
3. theme-catalogo.json é schemaVersion 4 — `pg2.grupos_ordem[]` é o campo canônico
4. Ao ler grupos: checar `pg2.grupos_ordem` primeiro, fallback para campos legados
5. `grupos{}` = configurações de Pg4 (cores, tipografia). NÃO confundir com `pg2.grupos_ordem[]`
6. catAbrirGrupo recebe qualquer string como `grupo` — não assume artesanais/finos
7. Modal `cat-modal-nova-categoria`: `_cardOrigem` e `_modoNovoGrupo` são propriedades dinâmicas no elemento DOM
8. `catEdPopularSelectGrupo(card, valorAtual)` deve ser chamado após qualquer operação que muda o ID do grupo
9. cpf_cnpj está em contracts, NÃO em proposals
10. Rota /contrato/:token fica ANTES de validateSession — é pública por design

## Pendente — próximas sessões

### Achados UX restantes (sem código)
- **Achado 1** ✅ feito pelo usuário — subtítulo Pg2 "Encontre o seu favorito" publicado
- **Achado 4** — Cardápio Pg3 subtítulo "Escolha sua Experiência" em 11px: avaliar legibilidade via Ed. Visual Cardápio (sem código)

### Catálogo — melhorias menores
- "Encontre o seu favorito" na Pg4 (seção de sabores) — subtítulo já editável via editor Pg3/4
- Hardening: substituir querySelector frágil por getElementById em alguns pontos

### Contratos — fase 2 (itens restantes)
- Aditivos, templates de cláusulas, integração Autentique

## Pontos de retorno seguros
- HEAD atual = afa9536 (estável, deploy validado — sessão 18)
- Anterior = cf67f05

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

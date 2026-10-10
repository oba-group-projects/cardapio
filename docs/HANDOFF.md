# HANDOFF

Atualizado: 2026-10-09 (sessão 14)

Branch: feature/gestao-online-segura
HEAD: eba02a0

## Última entrega
Editor Visual do Catálogo — completo. Modal de criação de categoria inline com dois modos, Pg3/4 dinâmico, select de ID com "+ Criar novo grupo...", sugestão automática de ID.

## Commits desta sessão
| Commit   | O que fez |
|----------|-----------|
| eba02a0  | feat(catalogo): modal nova categoria — campo ID bloqueado/editável por contexto, select "+ Criar novo grupo...", sugestão automática de ID |
| 175584c  | feat(catalogo): modal criar categoria inline — sem sair do editor visual, atualiza select automaticamente |
| 2f97635  | fix(catalogo): salvar Pg3/4 sem abrir Pg2 não dispara erro de validação — fallback para dados em memória |
| c0c67e2  | feat(catalogo): Pg3/4 dinâmico — editor de grupos gerado por catEdRenderizarGruposPg34, sem hardcode artesanais/finos |
| dbeb0ea  | feat(catalogo): atalho Criar categorias no aviso, edGrupoCatalogo dinâmico, catEdIrParaCategorias |
| 99f9b71  | feat(catalogo): ID grupo como select dinâmico — opções do catálogo, aviso inline, opção personalizado |

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

### Catálogo — melhorias menores
- "Encontre o seu favorito" (Pg sabores) — texto/estilo da seção de sabores
- Hardening: substituir querySelector frágil por getElementById em alguns pontos

### Contratos — fase 2 (não urgente)
- Revisão jurídica das cláusulas (externo — cancelamento, condições financeiras, foro)
- Condições financeiras: valor do sinal, vencimentos, forma de pagamento
- Status no snapshot pós-aceite (hoje grava "Aguardando aceite")
- Aditivos, templates de cláusulas, integração Autentique

## Pontos de retorno seguros
- HEAD atual = eba02a0 (estável, deploy validado)
- Anterior = ea8f3a2 (handoff sessão 13)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

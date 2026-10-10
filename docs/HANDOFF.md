# HANDOFF

Atualizado: 2026-10-09 (sessão 12)

Branch: feature/gestao-online-segura
HEAD: 777a0d2

## Última entrega
Editor Visual do Catálogo P1+P2 — grupos dinâmicos, schema v4, catMontarPg3/catAbrirGrupo refatorados.

## Commits desta sessão
| Commit   | O que fez |
|----------|-----------|
| 777a0d2  | feat(catalogo): Editor Visual P1+P2 — grupos dinâmicos, schema v4, catMontarPg3/catAbrirGrupo refatorados |

## Estado atual — TUDO APROVADO E EM PRODUÇÃO

### Editor Visual do Catálogo — completo (P1+P2)

**Schema v4 (theme-catalogo.json):**
- `pg2.grupos_ordem[]` — array dinâmico substituindo campos legados `artesanais_label/sublabel/finos_label/sublabel`
- Cada item: `{ id, label, sublabel, icone, destaque, visivel }`
- `grupos{}` mantido para configurações de Pg4 (titulo, subtítulo, cores, tipografia)
- Retrocompatível com schema v3 via fallback nos campos legados

**Catálogo público (ui-catalogo/index.html):**
- `catMontarPg3()` — itera sobre `grupos_ordem[]` com fallback schema v3
- `catAbrirGrupo()` — título/subtítulo de `grupos{}` → `grupos_ordem[]` → fallback genérico (sem hardcode artesanais/finos)
- `catNavegar()` — lógica de "único grupo ativo" generalizada para N grupos

**Central — Ed. Visual Catálogo Pg2:**
- Editor de lista `#cat-pg2-grupos-lista` com cards `.oba-botao-card`
- Por card: ID (monospace), label, sublabel, ícone (12 emojis), destaque, visível
- ↑↓ reordenar, 👁/🚫 toggle visibilidade, ⧉ duplicar, ✕ excluir
- Validações: ID vazio, IDs duplicados, mínimo 1 grupo visível
- Botões: "+ Novo grupo" e "↺ Restaurar padrão"

**Funções novas na Central:**
`catEdAdicionarCardGrupo`, `catEdAdicionarGrupo`, `catEdRestaurarGrupos`,
`catEdRemoverGrupo`, `catEdDuplicarGrupo`, `catEdToggleVisivel`,
`catEdMoverGrupo`, `catEdEscolherIcone`, `catEdAtualizarNumeracao`, `catEdLerGrupos`

### Módulo de Contratos — estado sessão 11 (sem alterações nesta sessão)
Ver HANDOFF anterior para detalhes completos.

### Cardápio e Catálogo — intactos
Sem alterações visuais nesta sessão.

## REGRAS TÉCNICAS CRÍTICAS
1. Nunca usar Set-Content/Out-File do PowerShell — adiciona BOM
2. theme.json = cardápio. theme-catalogo.json = catálogo. NUNCA misturar.
3. theme-catalogo.json é schemaVersion 4 — `pg2.grupos_ordem[]` é o campo canônico
4. Ao ler grupos: checar `pg2.grupos_ordem` primeiro, fallback para campos legados `artesanais_label/sublabel`
5. `grupos{}` no theme-catalogo.json = configurações de Pg4 (cores, tipografia). NÃO confundir com `pg2.grupos_ordem[]`
6. catAbrirGrupo recebe qualquer string como `grupo` — não assume artesanais/finos
7. cpf_cnpj está em contracts, NÃO em proposals
8. Rota /contrato/:token fica ANTES de validateSession — é pública por design
9. obaGetCatalogPrecos retorna { catPM, saborPM, catNomes }
10. Itens com incluido=1 não somam no total — obaContractCenarioTotal e recalcularCenario

## Pendente — próximas sessões

### Contratos (fase 2 — não urgente)
- Revisão jurídica das cláusulas (externo — cancelamento, condições financeiras, foro)
- Condições financeiras: valor do sinal, vencimentos, forma de pagamento
- Status no snapshot pós-aceite (hoje grava "Aguardando aceite")
- Aditivos
- Templates de cláusulas editáveis na Central
- Integração Autentique (sandbox primeiro)

### Editor Visual do Catálogo — melhorias futuras
- Pg3/4 (grupos{}) no editor: o usuário hoje edita via `formCatalogoPg34` com campos fixos para artesanais/finos. Quando um terceiro grupo for criado via `grupos_ordem[]`, ele não terá campos de Pg4 correspondentes automaticamente — será necessário tornar o `formCatalogoPg34` dinâmico também (fase futura)
- Avisar na Central quando um grupo em `grupos_ordem[]` não tem categorias correspondentes no D1

### Catálogo — melhorias visuais
- "Encontre o seu favorito" (Pg sabores)
- Hardening: substituir querySelector frágil por getElementById

## Pontos de retorno seguros
- HEAD atual = 777a0d2 (estável, deploy validado)
- Anterior = 7fee08e (handoff sessão 11)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

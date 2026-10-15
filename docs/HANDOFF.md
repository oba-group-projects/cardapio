# HANDOFF

Atualizado: 2026-10-12 (sessão 20)

Branch: feature/gestao-online-segura
HEAD: 771fba5

## Última entrega
Catálogo Pg2 redesenhada (composição, botões, centralização), Pg1 proporção tablet, imagem de fundo por grupo implementada. Diagnóstico aprofundado revelou que o catálogo usa published-bootstrap.js que intercepta fetches e serve do /api/catalog — theme-catalogo.json não é lido diretamente.

## Commits desta sessão (selecionados)
| Commit   | O que fez |
|----------|-----------|
| 771fba5  | fix(sync): theme-catalogo.json reescrito sem BOM |
| 66ac5c2  | fix(sync): theme-catalogo.json sincronizado com D1 PUBLISHED |
| 21c2bf6  | fix(catalogo): bgDiv inserido após innerHTML |
| 8a084fc  | fix(catalogo): Pg2 pg3-inner — centralização vertical correta |
| a75576f  | feat(catalogo): Pg2 centralizada + botões maiores + imagem por grupo + Pg1 50/50 tablet + título sem br |

## Estado atual — TUDO APROVADO E EM PRODUÇÃO

### Destaque fotográfico Pg1 do Catálogo — COMPLETO (sessão 19)

**Mobile (<768px):**
- Imagem empilhada entre texto e CTA (`order: 2`)
- `aspect-ratio: 4/3` — responsivo para qualquer celular sem breakpoints por modelo
- Opção "Ocultar no celular" disponível na Central

**Desktop (≥768px):**
- Grid lateral: texto 40% / imagem 60% (padrão) ou 50/50
- Imagem `position: sticky` — gruda na tela enquanto texto rola
- Degradê de transição na borda esquerda da imagem
- `#pg-1` com `overflow-y: auto` para scroll quando conteúdo ultrapassa viewport

**Central — controles disponíveis:**
- Toggle ativar/desativar (preserva configuração ao desativar)
- Galeria de imagens
- Foco horizontal e vertical (sliders 0–100)
- Composição no computador: lateral-60 (recomendada) ou lateral-50
- Comportamento no celular: adaptar ou ocultar

**Schema (pg1):** `imagem_destaque`, `imagem_pos_x`, `imagem_pos_y`, `destaque_ativo`, `destaque_composicao`, `destaque_mobile`

**Retrocompatível:** sem `destaque_ativo` salvo → imagem não aparece (padrão seguro)

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

### Catálogo — imagem de fundo nos botões Pg2
- Funcionalidade implementada e funcionando (opacidade 15%)
- Imagens atuais são capturas de tela — trocar por fotos dos doces na Central quando disponíveis
- Para aumentar opacidade: CSS `.oba-cat-btn-bg { opacity: .15 }` → ajustar conforme visual

### Catálogo — Borda do botão Voltar
- Confirmada nos prints — regra `.oba-btn-voltar-dest` ainda aplica borda
- Uma linha de CSS para remover quando decidido

### Arquitetura importante descoberta nesta sessão
- O catálogo público usa `published-bootstrap.js` que intercepta todos os fetches de JSON
- Os dados vêm de `/api/catalog` (D1 PUBLISHED), não dos arquivos estáticos individuais
- `theme-catalogo.json` estático só serve de fallback quando o bootstrap não está presente
- O sync do GitHub via `obaGitHubSyncPublished` falha silenciosamente — dados no D1 podem divergir dos arquivos estáticos

### Contratos — fase 2 (itens restantes)
- Aditivos, templates de cláusulas, integração Autentique

## Pontos de retorno seguros
- HEAD atual = 771fba5 (estável, deploy validado — sessão 20)
- Anterior = 8a084fc (Pg2 composição consolidada)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

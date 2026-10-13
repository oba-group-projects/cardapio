# HANDOFF

Atualizado: 2026-10-12 (sessão 19)

Branch: feature/gestao-online-segura
HEAD: b1e89d0

## Última entrega
Destaque fotográfico Pg1 do catálogo — implementação completa em múltiplas iterações. Layout lateral 40/60 no desktop (≥768px) com imagem sticky, empilhado no mobile com aspect-ratio responsivo. Configurável via Central: toggle ativo/inativo, galeria, foco X/Y, composição, comportamento mobile.

## Commits desta sessão (destaque visual)
| Commit   | O que fez |
|----------|-----------|
| b1e89d0  | fix: imagem mobile responsiva — aspect-ratio 4/3 em vez de height fixa |
| d5f3081  | fix: mobile — order:2 na imagem, remover margin-top:auto que escondia CTA |
| 2c1df44  | fix: ocultar cópia mobile da imagem no desktop — dupla exibição |
| 32743db  | fix: sticky dentro de fixed com scroll no pg-1, align-self:start |
| ff90e65  | feat: destaque visual v2 — proporção 40/60, breakpoint 768px, degradê, toggle, composição e mobile |
| 06673f0  | fix: remover declaração duplicada de elPg1 — SyntaxError |
| 2c2f4e8  | feat: destaque fotográfico Pg1 — imagem lateral configurável, mobile-first, retrocompat |

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

### Destaque visual — Passo 2 (se necessário após validação)
- `imagem_pos_x_mobile` e `imagem_pos_y_mobile` — foco independente para mobile
- Só implementar se o foco único não servir para ambos os layouts

### Destaque visual — Cardápio (Etapa 2, decisão separada)
- `#pag-1` do cardápio tem `height: 100dvh; overflow: hidden` — requer abordagem diferente
- Não iniciar sem decisão explícita

### Achados UX restantes (sem código)
- Achado 4 — Cardápio Pg3 subtítulo "Escolha sua Experiência" em 11px: avaliar via Ed. Visual Cardápio

### Catálogo — melhorias menores
- Hardening: substituir querySelector frágil por getElementById em alguns pontos

### Contratos — fase 2 (itens restantes)
- Aditivos, templates de cláusulas, integração Autentique

## Pontos de retorno seguros
- HEAD atual = b1e89d0 (estável, deploy validado — sessão 19)
- Anterior = d5f3081

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

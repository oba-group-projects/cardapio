# HANDOFF

Atualizado: 2026-10-22 (sessão 23)

Branch: feature/gestao-online-segura
HEAD: 2884048
Sincronizado com origin: sim
Working tree: limpo

## Última entrega — Sessão 23
Simplificação do editor de capa do Cardápio na Central.

### Commits desta sessão (pós-sessão 22)
| Commit   | O que fez |
|----------|-----------|
| 2884048  | refactor(editor): simplificar editor de capa — controles nas prévias completas |
| 9bfb0ce  | fix(editor): recorte das prévias via posicionamento explícito fiel ao publicado |
| b35b3d6  | fix(editor): unificar recorte miniaturas com prévias completas via object-position |
| 24fbd5b  | fix(editor): restaurar miniaturas de recorte + criarDrag com 3 pontos de arraste |
| 8381e30  | fix(editor): drag fiel ao cardápio publicado via object-position |
| 5647b7a  | fix(cardápio): corrigir espaço em !important desktop + duas prévias completas |

### Entregas confirmadas em produção

**Editor de capa simplificado:**
- Controles de foco H/V, zoom e altura ficam diretamente abaixo de cada prévia completa
- Celular e desktop com configurações independentes
- Prévias usam `object-fit:cover + object-position + scale()` — mesma lógica do publicado
- Drag nas próprias prévias completas (sem miniaturas separadas)
- Miniaturas de recorte e código morto removidos
- 47 checks estáticos + sintaxe JS validada (vm.Script, 9 blocos, 324.758 chars)

**Version ID atual:** `9e8074d1-a0d2-4746-882c-3f4bcfe01d81`

## Pendência documentada — foco vertical da capa

**Situação:** o slider de foco vertical (Y) não produz deslocamento visível em fotos 4:3 com zoom=1.0.

**Causa confirmada:** limitação geométrica de `object-fit:cover`. Com foto 4:3 e contêiner landscape, o cover é escalado pela largura → a altura já ocupa 100% do contêiner → excedente Y = 0 → `object-position` Y não tem efeito. O comportamento é **idêntico ao cardápio publicado** — não é um bug do editor.

**Com zoom ≥ 1.2:** foco Y funciona normalmente em todos os contextos.

**Decisão:** documentado. Não será retomado nesta fase.

## Como retomar o desenvolvimento

1. Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md, ROADMAP.md
2. `git checkout feature/gestao-online-segura && git pull`
3. `cd online/gestao && npx wrangler dev`
4. Branch de trabalho: `feature/gestao-online-segura`
5. Fluxo obrigatório: DRAFT → PREVIEW → PUBLISHED

## Próximo passo recomendado
**Editor Visual do Catálogo — P1+P2**
- Editar textos existentes, mostrar/ocultar, reordenar botões
- Baseado nos mecanismos do Editor do Cardápio (~70% reaproveitamento)

## Pontos de retorno seguros
- HEAD = 2884048 (estável, deploy validado — sessão 23)
- Anterior = c7dc3ef (sessão 22 — redesenho Pg1 + editor imagem capa)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

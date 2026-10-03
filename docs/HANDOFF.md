# HANDOFF

Atualizado: 2026-10-02

Branch: feature/gestao-online-segura
HEAD: 9c011b3
Tag de marco atual: v12C-pre-4 (9c011b3)

## Última entrega
Fluxo DRAFT→PREVIEW→PUBLISHED separado + barra de contexto + validações de seção

## Commits recentes relevantes
| Commit   | O que fez |
|----------|-----------|
| 9c011b3  | feat: restaurar botão Visualizar cardápio público |
| 8ef441c  | feat: separar Visualizar Preview e Publicar após Preview |
| 1a62c4f  | feat: bloquear salvamento de seção ativa sem label |
| a31a180  | feat: aviso inline quando seção ativa sem label |
| 76267a2  | feat: barra de contexto alterações não salvas + fix ID seção |
| 4ffa5e7  | fix: substituir separador ⬢ por · (suporte universal) |
| baca909  | feat: dropdown Catálogo na barra de navegação |

## O que está funcionando (9c011b3)

### Fluxo de publicação
- **"Visualizar Preview":** gera PREVIEW e abre /__preview em nova aba
- **"Publicar após Preview":** desabilitado até Preview estar gerado; ao clicar confirma e publica DRAFT→PUBLISHED
- **"Visualizar cardápio":** abre /cardapio público — o que o cliente vê
- Badge de status: Rascunho aguardando Preview / Preview pronto para publicar / Sem alterações publicáveis

### Barra de contexto
- Aparece ao editar qualquer campo das páginas fixas da Edição Visual
- Mostra o nome da seção com alterações
- Botão Salvar: submete o formulário ativo
- Botão Descartar: restaura via obaPopularFormTema() + flag _ctxPronto

### Validação de Seção Extra
- Label vazio + seção ativa + botão marcado → bloqueia salvamento com mensagem clara
- Aviso inline reaparece ao marcar checkbox "Adicionar botão automático" sem label
- Seção pausada ou botão desmarcado: salva sem restrição

### Outros
- Separador · (U+00B7) em todo o cardápio público — suporte universal
- Mensagem de seção salva mostra "Nova seção" em vez do ID técnico
- Dropdown "Catálogo" na barra com Sabores, Categorias, Caixas, Produtos, Opcionais, Combos

## Próxima implementação — Fase 12C
Catálogo de Sabores — rota pública /catalogo

### Subfase 12C-1 (próxima)
- Migration D1: coluna grupo_catalogo na tabela categories
- Campo novo no editor de Categorias: "Grupo do Catálogo" (Doces Artesanais / Doces Finos / Não aparece)
- Você categoriza cada categoria na Central
- Nada público ainda

### Decisões técnicas aprovadas
- Slot isolado no D1 para configs do Catálogo
- Toggle global de preços
- URL: /catalogo
- Grupos: "Doces Artesanais" e "Doces Finos"
- Cards: foto + nome obrigatório + preço opcional

## Ponto de retorno seguro
Tag: v12C-pre-4 = commit 9c011b3

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

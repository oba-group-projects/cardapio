# CURRENT STATE

Atualizado: 2026-10-02

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 9c011b3
Tag de marco anterior: v12C-pre-3 (baca909)
Tag de marco atual: v12C-pre-4 (a criar)

## Estado funcional
- Central privada autenticada e operacional (senha Oba2026!)
- Fluxo DRAFT → PREVIEW → PUBLISHED separado e funcional
- Cardápio público funcional em /cardapio
- Módulo de Propostas completo (12A + 12B)

## Melhorias acumuladas — sessões recentes

### Separador visual no cardápio
- Substituído ⬢ (U+2B22, hexágono — falha em alguns celulares) por · (U+00B7, ponto mediano — suporte universal)
- 50 ocorrências corrigidas em ui-desenvolvimento/index.html

### Barra de contexto "alterações não salvas"
- Aparece automaticamente ao editar qualquer campo das páginas fixas (Pg1, Pg2, Pg3, Vitrine, Modais, Tema)
- Botão "Salvar" submete o formulário ativo
- Botão "Descartar" restaura todos os campos via obaPopularFormTema()
- Flag _ctxPronto evita disparos durante carga inicial

### Correção de ID na mensagem de seção
- `titulo || id` → `titulo || 'Nova seção'` — ID técnico nunca mais aparece para o usuário

### Validação de label ao salvar Seção Extra
- Aviso inline abaixo do campo Label quando seção ativa + botão marcado + label vazio
- Bloqueio de salvamento nesse mesmo cenário (Opção C aprovada)
- Seção pausada ou botão desmarcado: salva normalmente sem restrição

### Fluxo DRAFT → PREVIEW → PUBLISHED separado
- "Visualizar Preview" → gera PREVIEW e abre /__preview (rascunho privado)
- "Publicar após Preview" → só habilitado quando badge = "Preview pronto para publicar"
- "Visualizar cardápio" → abre /cardapio público (o que o cliente vê)
- publicarBtn conectado ao obaPublishPreview() já existente em oba-publish-8e9f

## Fase 12C — Catálogo de Sabores (planejada, não iniciada)
Estrutura aprovada:
- Rota pública /catalogo no Worker (sem autenticação)
- Pg 1: logo + título "Catálogo Oba Doceria"
- Pg 2: texto da Nossa Essência (editável independentemente depois)
- Pg 3: dois botões — "Doces Artesanais" e "Doces Finos"
- Pg 4: sabores do grupo escolhido com abas de categoria + cards (foto + nome + preço opcional)
- Botões flutuantes: WhatsApp + "Montar pedido online →"

Subfases aprovadas:
- 12C-1: Migration D1 + campo grupo_catalogo nas categorias + categorização na Central
- 12C-2: Rota /catalogo + HTML estático visual (sem dados ainda)
- 12C-3: Conectar dados reais (sabores, fotos, preços)
- 12C-4: Aba "Catálogo" na Central com configurações editáveis

Decisões técnicas aprovadas:
- Slot isolado no D1 para configs do Catálogo (Opção B)
- Toggle global de preços na Central
- URL: /catalogo
- Grupos: "Doces Artesanais" e "Doces Finos" + opção "Não aparece no Catálogo"

## Pontos de retorno seguros
- Tag v12B-baseline = ded3c58
- Tag v12C-pre = 2477185
- Tag v12C-pre-2 = 6755162
- Tag v12C-pre-3 = baca909
- Tag v12C-pre-4 = 9c011b3 (a criar)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- GitHub: https://github.com/oba-group-projects/cardapio

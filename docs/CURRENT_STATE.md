# CURRENT STATE

Atualizado: 2026-10-03

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 5cc7dad
Tag de marco anterior: v12C-pre-4 (9c011b3)
Tag de marco atual: v12C-pre-4 (base — sem nova tag, sessão de bugfix)

## Estado funcional
- Central privada autenticada e operacional (senha Oba2026!)
- Fluxo DRAFT → PREVIEW → PUBLISHED separado, funcional e aprovado
- Badge de status atualiza automaticamente após cada salvamento
- Cardápio público funcional em /cardapio
- Módulo de Propostas completo (12A + 12B)
- Rota /catalogo implementada (12C-2 parcial — HTML sem dados reais)

## Correções desta sessão (03/10)

### Fluxo de publicação — bug resolvido
- **Causa raiz:** badge de status não atualizava após salvar → botão Publicar permanecia `disabled` com conteúdo pendente
- **Solução:** `atualizarStatus()` adicionado em todos os 6 pontos de salvamento do catálogo/tema
- **Testado e aprovado** em produção

### Worker — melhorias de robustez
- Handler: `(request, env, ctx)` — ctx disponível para waitUntil
- Sync GitHub: fire-and-forget via `ctx.waitUntil(Promise.all([...]))` — não bloqueia resposta
- Gate pós-write: `obaCatalogSlotsState` protegido com try/catch
- Bloco `/api/`: try/catch global → retorna JSON 500 em vez de página de erro Cloudflare

## Melhorias acumuladas — sessões anteriores

### Separador visual no cardápio
- Substituído ⬢ por · (U+00B7) — suporte universal

### Barra de contexto "alterações não salvas"
- Aparece automaticamente ao editar campos das páginas fixas
- Botão "Salvar" submete o formulário ativo
- Botão "Descartar" restaura todos os campos

### Validação de label ao salvar Seção Extra
- Aviso inline + bloqueio quando seção ativa + botão marcado + label vazio

### Fluxo DRAFT → PREVIEW → PUBLISHED separado
- "Visualizar Preview" → gera PREVIEW e abre /__preview
- "Publicar após Preview" → só habilitado quando badge = "Preview pronto para publicar"
- "Visualizar cardápio" → abre /cardapio público

## Fase 12C — Catálogo de Sabores
Estrutura aprovada:
- Rota pública /catalogo no Worker (sem autenticação) — implementada
- HTML ui-catalogo/index.html — implementado (estático)
- Pendente: conectar dados reais (12C-3)

Subfases:
- ✅ 12C-1: Campo grupoCatalogo no editor de Categorias
- ✅ 12C-2: Rota /catalogo + HTML estático
- ⬜ 12C-3: Conectar dados reais (sabores, fotos, preços)
- ⬜ 12C-4: Aba "Catálogo" na Central com configurações

## Pontos de retorno seguros
- Tag v12C-pre-4 = 9c011b3 (estável anterior)
- HEAD atual = 5cc7dad (estável, aprovado em produção)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

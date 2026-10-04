# HANDOFF

Atualizado: 2026-10-03

Branch: feature/gestao-online-segura
HEAD: 5cc7dad
Tag de marco atual: v12C-pre-4 (base) — sem nova tag (sessão de bugfix)

## Última entrega
Correção do fluxo de publicação — badge de status atualiza após cada salvamento

## Commits recentes relevantes
| Commit   | O que fez |
|----------|-----------|
| 5cc7dad  | fix: badge de status atualiza após cada salvamento + remove logs de diagnóstico |
| 66970f1  | diag: logs PUB:0-5 no botão Publicar (temporário — já removido no 5cc7dad) |
| 79d9a14  | fix: ctx.waitUntil + try/catch /api/ + gate pós-write seguro no Worker |
| 6268b39  | fix: sync GitHub fire-and-forget no publish |
| d5aba24  | fix: remover window.confirm() do fluxo de publicação |

## O que está funcionando (5cc7dad)

### Fluxo de publicação — CORRIGIDO E APROVADO
- Causa raiz identificada: badge de status ficava desatualizado após salvar, deixando o botão Publicar como `disabled` mesmo com conteúdo pendente
- `atualizarStatus()` agora é chamado automaticamente após cada salvamento
- Fluxo completo testado e aprovado: editar → salvar → badge atualiza → Preview → Publicar

### Pontos de salvamento com atualização automática de badge
- `salvarEditor()` — sabores, caixas, produtos, opcionais, combos, categorias
- `obaToggleStatus()` — toggle ativo/inativo na tabela
- Form loja (`onsubmit`) — configurações da loja
- `obaSalvarPaginaDoTema()` — Pg1, Pg2, Pg3, Vitrine, Modal Personalizados, Modal Eventos, Tema Global
- Remover seção extra
- `obaFecharSalvarSecao()` — salvar seção extra

### Worker melhorias desta sessão
- Handler principal: `(request, env, ctx)` — ctx disponível
- `ctx.waitUntil()` para sync GitHub (fire-and-forget seguro)
- Gate pós-write `obaCatalogSlotsState` protegido com try/catch
- Bloco `/api/` com try/catch global → retorna JSON 500 em vez de página de erro Cloudflare

### Estado do fluxo de publicação
- **"Visualizar Preview":** gera PREVIEW e abre /__preview em nova aba
- **"Publicar após Preview":** habilitado quando badge = "Preview pronto para publicar"
- **Badge:** atualiza automaticamente após qualquer salvamento
- **"Visualizar cardápio":** abre /cardapio público

## Próxima implementação — Fase 12C (pendente)
Catálogo de Sabores — rota pública /catalogo

### Subfase 12C-1 (próxima)
- Migration D1: coluna grupo_catalogo na tabela categories
- Campo novo no editor de Categorias: "Grupo do Catálogo"
- Nada público ainda

### Subfase 12C-2 (iniciada)
- Rota `/catalogo` no Worker — implementada
- HTML ui-catalogo/index.html — implementado
- Pendente: conectar dados reais

## Ponto de retorno seguro
Tag: v12C-pre-4 = commit 9c011b3 (anterior a esta sessão)
HEAD atual: 5cc7dad (estável, aprovado)

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

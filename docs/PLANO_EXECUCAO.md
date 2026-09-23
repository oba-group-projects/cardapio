# Plano de Execução — Oba Doceria Digital
*Versão: 20/09/2026 — Aprovado antes da execução*
*Atualizar este arquivo ao concluir cada passo.*

---

## Por que este plano existe

O cardápio existe em dois lugares hoje:
- **GitHub Pages** (`oba-group-projects.github.io/cardapio/`) — lê arquivos JSON estáticos do GitHub
- **Worker** (`oba-cardapio-gestao.obadoceria.workers.dev/`) — lê dados do banco D1

Isso criou sincronização instável, divergência de versões e complexidade desnecessária.
A decisão aprovada é unificar tudo no Worker e eliminar o GitHub Pages como cardápio público.

---

## ETAPA 0 — Fundação estável
*Executar antes de qualquer feature nova.*
*Cada passo só inicia após o anterior ser validado e aprovado.*

---

### Passo 1 — Unificar o cardápio no Worker
**Status: [x] Concluído — 20/09/2026**

**O que é:**
Criar uma rota pública no Worker que serve o cardápio diretamente,
sem depender do GitHub Pages.

**Por que fazer:**
- Elimina a sincronização que causou todos os problemas
- Publicar na Central → cardápio atualiza instantaneamente
- Uma única fonte de verdade: o D1
- Zero risco de divergência entre versões

**O que faz:**
- Cria rota pública `GET /cardapio` no Worker
- Serve o `ui-desenvolvimento/index.html` sem autenticação
- Os dados (sabores, preços, tema) já são lidos pelo cardápio dos arquivos
  `../data/catalog-v1/` que o Worker serve via Static Assets
- Nenhuma mudança no fluxo de compras, no HTML, nos dados

**O que NÃO muda:**
- O GitHub Pages continua existindo como backup (não deletamos)
- A Central de Gestão continua igual
- O D1 continua sendo a fonte dos dados

**Resultado esperado:**
- URL do cardápio público: `https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio`
- Publicar na Central → cardápio atualiza instantaneamente
- Zero sincronização com GitHub necessária

**Como validar:**
1. Abrir `https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio`
2. Confirmar que o cardápio carrega corretamente
3. Fazer uma alteração na Central → publicar → verificar que aparece

---

### Passo 2 — Corrigir chars corrompidos no fluxo de compras
**Status: [x] Concluído — 20/09/2026**

**O que é:**
Eliminar os símbolos quebrados (`◆🔲`, `←🔲`) que aparecem no fluxo
de compras enquanto o cliente monta o pedido.

**Por que fazer:**
O cliente vê esses símbolos no celular. Passa imagem de produto inacabado.
O arquivo HTML tem encoding corrompido desde o início — precisa ser resolvido
para ter um produto profissional.

**O que faz:**
- Cria `.scripts/fix-encoding.js` com mapeamento declarativo completo
  de todas as strings corrompidas → corretas
- Aplica substituições em cópia do arquivo (não sobrescreve o original)
- Cria `.scripts/validate-cardapio.js` que verifica:
  zero chars corrompidos visíveis, todas as seções presentes, JS sem erros
- Só após validação 100% o original é substituído

**O que NÃO muda:**
- Estrutura HTML do cardápio
- Fluxo de compras
- Dados do catálogo

**Resultado esperado:**
- `·` em vez de `◆🔲` nos títulos de caixa
- `←` em vez de `←🔲` nos botões de voltar
- `✅` em vez de `🔲S` nos status de mínimo atingido
- `−` em vez de `←🔲` no botão de diminuir quantidade
- `→` em vez de `◆🔲` nos botões de avançar

**Como validar:**
1. Script `.scripts/validate-cardapio.js` passa 100%
2. Percorrer todo o fluxo de compras no celular
3. Confirmar que nenhum char quebrado aparece

---

### Passo 3 — Corrigir scroll nas páginas 1, 2 e 3
**Status: [x] Concluído — 22/09/2026**

**O que é:**
As páginas de boas-vindas, nossa essência e menu principal permitem
scroll, mas não deveriam — todo o conteúdo cabe na tela.

**Por que fazer:**
A página parece incompleta. Em um cardápio profissional, essas telas
são fixas — o usuário clica para avançar, não rola.

**O que faz:**
- Identifica o elemento exato que causa o estouro de altura
- Adiciona CSS mínimo no `<head>` nos IDs `#pag-1`, `#pag-2`, `#pag-3`
- Não altera nenhuma classe Tailwind existente

**O que NÃO muda:**
- Fluxo de compras (pág 4+) — continua com scroll, é necessário
- Nenhuma outra página ou componente

**Resultado esperado:**
- Página 1 (Boas-vindas): não rola
- Página 2 (Nossa Essência): não rola
- Página 3 (Menu): não rola
- Página 4+ (fluxo de compras): continua com scroll normal

**Como validar:**
1. Abrir no celular e tentar rolar as páginas 1, 2 e 3
2. Confirmar que o botão CTA e os botões do menu estão visíveis sem rolar
3. Confirmar que o fluxo de compras completo ainda funciona

---

## ETAPA 1 — Features novas
*Iniciar somente após Etapa 0 completa e aprovada.*

---

### Fase 12A — Módulo de Propostas de Orçamento
**Status: [ ] Pendente**

**O que é:**
Gerador profissional de propostas com 3 cenários, PDF e link compartilhável.
Substitui o caderno manual.

**O que inclui:**
- Nova aba "Propostas" na Central
- Editor: dados do evento + 3 cenários + adicionais por proposta + descontos
- Cálculo automático usando preços do catálogo
- 3 cenários lado a lado (como no caderno)
- Adicionais configuráveis por proposta (cada proposta tem os seus)
- Desconto individual por cenário
- Geração de PDF no browser (sem dependência externa)
- Link público: `/proposta/:id` (cliente abre no celular)
- Histórico no D1 com status: Rascunho / Enviada / Aceita / Recusada
- Envio via WhatsApp com resumo formatado

**O que NÃO muda:**
- Cardápio público
- Fluxo de compras do cliente

---

### Fase 12B — Cardápio de Consulta (sem valores)
**Status: [ ] Pendente**

**O que é:**
URL do cardápio que exibe todos os sabores sem preços,
para compartilhar com clientes antes do orçamento.

**O que inclui:**
- Parâmetro `?modo=consulta` na URL que oculta preços automaticamente
- Botão "Copiar link de consulta" na Central

---

### Fase 12C — Melhorias na Central
**Status: [ ] Pendente**

**O que inclui:**
- Inativos aparecem no final da lista de sabores
- Indicador visual mais claro quando há publicação pendente
- Duplicar proposta de orçamento como base para nova

---

## Regras de execução

1. **Uma fase por vez** — nunca iniciar a próxima sem validar a anterior
2. **Perguntar antes de fazer** — qualquer dúvida é discutida antes de tocar no código
3. **Validar antes de publicar** — cada mudança passa por script antes do deploy
4. **Commit único por mudança** — cada passo gera um commit descritivo e auditável
5. **Nunca sobrescrever sem cópia** — scripts operam em cópia antes de substituir
6. **Zero mudança no fluxo de compras** durante os passos de estabilização

---

## Links do projeto

| O que é | URL |
|---|---|
| Central de Gestão | https://oba-cardapio-gestao.obadoceria.workers.dev/ |
| Cardápio (Worker — novo) | https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio |
| Cardápio (Pages — backup) | https://oba-group-projects.github.io/cardapio/ |
| GitHub | https://github.com/oba-group-projects/cardapio |
| Branch de trabalho | `feature/gestao-online-segura` |

---

## Histórico de execução

| Data | Passo | Resultado |
|---|---|---|
| 20/09/2026 | Plano criado e aprovado | — |
| 20/09/2026 | Passo 1 concluído | GET /cardapio no Worker funcionando. Status 200, 623KB. /api/catalog público retorna 55 sabores, 6 categorias. |
| 20/09/2026 | Passo 2 concluído | 40 -> 3 U+FFFD. Scripts em .scripts/. 13/13 validações OK. Commit a8b7284. |
| 22/09/2026 | Fix divergência preview/cardápio | /api/catalog conectado ao slot PUBLISHED do D1. Commit 09169c4. |
| 22/09/2026 | Passo 3 concluído | #pag-1/2/3 fixas em 100dvh, overflow:hidden. Commit 77c05a8. Deploy 2cf0ef7f. |

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
**Status: [x] Concluído — 25/09/2026**

Todas as subfases entregues:
- **12A-1:** D1 migrations (proposals, scenarios, items) + rotas Worker
- **12A-2:** Aba Propostas na Central — editor completo, cenários, estimativa financeira
- **12A-3:** Página pública `/proposta/:id` — 4 páginas, texto emocional, cards delicados, PDF
- **12A-4:** Status inline editável, botão Excluir, campo Abertura, migration 0007

HEAD atual: `e828a73`

---

### Fase 12B — Propostas Corporativas + Sazonais
**Status: [ ] Em andamento — 25/09/2026**

#### Decisões aprovadas

| Decisão | Definição |
|---|---|
| Templates | Separados: Evento / Corporativo / Sazonal |
| Modelo sazonal | Individual com duplicação |
| Calculadora de pedido | Não |
| Desconto por cliente | Não |
| Galeria de imagens | Até 8 fotos por proposta |
| Campos sazonais | Prazo pedido, prazo entrega, condições pagamento, pedido mínimo |
| Campos corporativos | Empresa, demanda, frequência, observações/briefing |

#### Subfase 12B-1 — Migrations
**Status: [ ] Pendente**

- **0008:** campos `template`, `empresa`, `demanda`, `frequencia`, `orcamento_ref`, `observacoes`, `prazo_pedido`, `prazo_entrega`, `cond_pagamento`, `pedido_minimo` na tabela `proposals`
- **0009:** tabela `proposal_media` (upload Base64 por proposta, CASCADE)
- **0010:** campo `faixas` (JSON) na tabela `proposal_items` (tabela de preços por volume)

#### Subfase 12B-2 — Worker (rotas de mídia + duplicar)
**Status: [ ] Pendente**

- `POST /api/proposals/:id/media` — upload de imagem
- `DELETE /api/proposals/:id/media/:media_id` — remover imagem
- `GET /api/proposals/:id/media` — listar imagens
- `POST /api/proposals/:id/duplicate` — duplicar proposta (copia dados + cenários + imagens)

#### Subfase 12B-3a — Central: seleção de template + formulário Corporativo
**Status: [ ] Pendente**

- Modal de seleção ao criar (Evento / Corporativo / Sazonal)
- Formulário Corporativo: empresa, WhatsApp, tipo de demanda, frequência, observações, validade, texto abertura, galeria de imagens, cenários sem "doces por convidado"

#### Subfase 12B-3b — Central: formulário Sazonal
**Status: [ ] Pendente**

- Formulário Sazonal: empresa (ou geral), prazo pedido, prazo entrega, condições pagamento, pedido mínimo, validade, texto abertura, galeria de imagens
- Produtos com faixas de preço: nome, descrição, foto, tabela (até/acima de X → preço Y)

#### Subfase 12B-4a — Página pública Corporativo
**Status: [ ] Pendente**

- Pg0: abertura com nome da empresa
- Pg1: galeria de imagens + descrição do projeto
- Pg2/3: cenários com itens livres
- CTA WhatsApp adaptado

#### Subfase 12B-4b — Página pública Sazonal
**Status: [ ] Pendente**

- Pg0: abertura com data comemorativa + empresa
- Pg1: condições (prazo, entrega, pagamento, mínimo) + galeria
- Pg2/3/4: produtos com tabela de faixas de preço
- CTA: "Olá, Oba Doceria! Tenho interesse no catálogo. Quais os próximos passos?"

---

### Fase 12C — Catálogo de Festas (vitrine pública)
**Status: [ ] Pendente — após 12B homologada**

**O que é:**
Página de vitrine pública para clientes de eventos, sem fluxo de pedido.
URL própria, disparada para quem solicita orçamento de festa.

**O que inclui:**
- Rota `/festas` no Worker (sem autenticação)
- Todas as categorias do catálogo + categoria de Doces Finos para Eventos
- Sem fluxo de pedido — só visualização
- CTA único: "Quero um orçamento" → WhatsApp
- Identidade visual da Oba Doceria

**O que NÃO inclui (decisão):**
- Catálogo de consulta paralelo para o dia a dia — desnecessário.
  O cardápio atual (`/cardapio`) já serve esse propósito.
  Se o atrito do fluxo de pedido for identificado como problema real,
  resolve-se simplificando o cardápio existente, não criando URL paralela.

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
| 20/09/2026 | Passo 1 concluído | GET /cardapio no Worker funcionando. |
| 20/09/2026 | Passo 2 concluído | Chars corrompidos corrigidos. |
| 22/09/2026 | Fix divergência preview/cardápio | /api/catalog conectado ao slot PUBLISHED do D1. |
| 22/09/2026 | Passo 3 concluído | #pag-1/2/3 fixas em 100dvh. |
| 22/09/2026 | Planejamento 12A | Estrutura de propostas definida. |
| 23/09/2026 | 12A-1 concluída | D1 migrations + rotas Worker. |
| 23/09/2026 | 12A-2 concluída | Aba Propostas na Central completa. |
| 24/09/2026 | 12A-3 concluída | Página pública /proposta/:id — 4 páginas, texto emocional. HEAD: d2e1eff |
| 25/09/2026 | 12A-3 refinamentos | Caps → caixa mista, res-sub removido. HEAD: ff10cda |
| 25/09/2026 | 12A-4 concluída | Status inline, Excluir, campo Abertura, migration 0007. HEAD: ecbc167 |
| 25/09/2026 | Fix mensagem WhatsApp | "Olá, Oba Doceria! Gostei do Cenário X. E agora, quais os próximos passos?" HEAD: 85525cf |
| 25/09/2026 | 12B aprovada | Templates separados, sazonal individual com duplicação, galeria 8 fotos. |

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
Substitui o caderno manual e o áudio explicativo no WhatsApp.

**Estrutura de uma proposta:**
```
Proposta
├── Dados do evento
│   ├── Nome do cliente
│   ├── Data do evento
│   ├── Número de convidados
│   └── Tipo de evento (campo livre)
│
├── Resumo geral  ← substitui o áudio explicativo
│   └── Texto livre contextualizando a proposta
│
├── Cenário 1 / 2 / 3  (nome padrão editável pela Oba Doceria)
│   ├── Nome do cenário (padrão: "Cenário 1", editável)
│   ├── Descrição curta do cenário
│   ├── Itens do catálogo (produto + quantidade + preço unit. + subtotal)
│   ├── Adicionais livres (descrição + valor — variam por proposta)
│   ├── Subtotal calculado automaticamente
│   ├── Desconto (R$ ou %, avaliado caso a caso)
│   └── Total final
│
└── Rodapé
    ├── Validade da proposta
    └── Contato / WhatsApp
```

**Fluxo na Central:**
1. Nova Proposta → dados do evento + resumo geral
2. Para cada cenário: seleciona itens do catálogo, adiciona linhas livres, aplica desconto
3. Gerar → sistema cria link público + PDF
4. Revisar/editar antes de enviar (pode regenerar)
5. Copiar link ou baixar PDF → WhatsApp

**Link público `/proposta/:id`:**
- Página otimizada para celular
- 3 cenários navegáveis
- CTA "Quero este cenário" → WhatsApp com mensagem pré-formatada
- Sem login, sem formulário — só leitura e contato

**Histórico no D1:**
- Rascunho / Enviada / Aceita / Recusada

**O que NÃO muda:**
- Cardápio público
- Fluxo de compras do cliente

---

#### Subfase 12A-1 — Infraestrutura D1 + rota Worker
**Status: [ ] Pendente**

- Tabela `proposals` no D1 (id, cliente, data_evento, convidados, tipo_evento, resumo, validade, status, criado_em)
- Tabela `proposal_scenarios` (id, proposal_id, nome, descricao, desconto_tipo, desconto_valor, ordem)
- Tabela `proposal_items` (id, scenario_id, tipo: catálogo|livre, ref_id, descricao, qtd, preco_unit)
- Rotas no Worker:
  - `POST /api/proposals` — criar/salvar rascunho
  - `GET /api/proposals` — listar (autenticado)
  - `GET /api/proposals/:id` — carregar proposta (autenticado)
  - `PUT /api/proposals/:id` — atualizar
  - `PATCH /api/proposals/:id/status` — atualizar status
  - `GET /proposta/:id` — página pública (sem auth)

---

#### Subfase 12A-2 — Editor na Central (aba Propostas)
**Status: [ ] Pendente**

- Nova aba "Propostas" na Central
- Listagem com status visual (Rascunho / Enviada / Aceita / Recusada)
- Editor completo: dados do evento, resumo geral, 3 cenários
- Seletor de itens do catálogo com busca e quantidade editável
- Linhas livres (adicionais): adicionar/remover, descrição + valor
- Desconto por cenário (toggle R$ / %)
- Cálculo automático em tempo real
- Salvar rascunho a qualquer momento

---

#### Subfase 12A-3 — Página pública `/proposta/:id`
**Status: [ ] Pendente**

- Layout mobile-first, identidade visual da Oba Doceria
- Dados do evento + resumo geral no topo
- Cenários em abas (navegação por toque)
- Itens com quantidade e subtotal por linha
- Adicionais e desconto destacados
- Total final em destaque
- CTA "Quero este cenário" → WhatsApp com texto pré-formatado
- Validade visível

---

#### Subfase 12A-4 — Geração de PDF
**Status: [ ] Pendente**

- Geração no browser (sem dependência de servidor externo, zero custo)
- Usa a mesma estrutura visual da página pública
- Botão "Baixar PDF" na Central, na tela de revisão
- Revisão antes de enviar: pode editar e regenerar

---

#### Subfase 12A-5 — Testes e homologação
**Status: [ ] Pendente**

- Criar proposta completa com 3 cenários, adicionais e desconto
- Verificar cálculos automáticos
- Abrir link público no celular e confirmar layout
- Testar CTA WhatsApp
- Baixar PDF e conferir fidelidade visual
- Alterar status e confirmar histórico

---

### Fase 12B — Categoria "Doces Finos para Eventos" no catálogo
**Status: [ ] Pendente — após 12A homologada**

**O que é:**
Nova categoria no catálogo gerenciada pela Central, exclusiva para eventos/festas.
Sabores desta categoria não aparecem no cardápio do dia a dia.

**O que inclui:**
- Flag `exclusivo_eventos: true` por categoria no catálogo
- Categoria gerenciada na Central como qualquer outra (adicionar/editar/inativar sabores)
- Itens disponíveis para seleção nas propostas de orçamento (Fase 12A)
- Não aparecem no cardápio público (`/cardapio`)

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
| 20/09/2026 | Passo 1 concluído | GET /cardapio no Worker funcionando. Status 200, 623KB. /api/catalog público retorna 55 sabores, 6 categorias. |
| 20/09/2026 | Passo 2 concluído | 40 -> 3 U+FFFD. Scripts em .scripts/. 13/13 validações OK. Commit a8b7284. |
| 22/09/2026 | Fix divergência preview/cardápio | /api/catalog conectado ao slot PUBLISHED do D1. Commit 09169c4. |
| 22/09/2026 | Passo 3 concluído | #pag-1/2/3 fixas em 100dvh, overflow:hidden. Commit 77c05a8. Deploy 2cf0ef7f. |
| 22/09/2026 | fix(scroll) body | body.oba-pagina-fixa reforça bloqueio no body. Commit a242ed6. Deploy pendente. |
| 22/09/2026 | Planejamento 12A-12C | Estrutura de propostas definida. 12A dividida em 5 subfases. 12B/12C planejadas. PLANO_EXECUCAO.md atualizado. |

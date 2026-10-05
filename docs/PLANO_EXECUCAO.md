# Plano de Execução — Oba Doceria Digital
*Versão: 20/09/2026 — Aprovado antes da execução*
*Atualizar este arquivo ao concluir cada passo.*

---

## Por que este plano existe

O cardápio existe em dois lugares hoje:
- **GitHub Pages** (`oba-group-projects.github.io/cardapio/`) — lê arquivos JSON estáticos do GitHub
- **Worker** (`oba-cardapio-gestao.obadoceria.workers.dev/`) —+ lê dados do banco D1

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
**Status: [x] Concluído — 27/09/2026**

#### Decisões aprovadas e implementadas

| Decisão | Definição |
|---|---|
| Templates | Separados: Evento / Corporativo / Sazonal |
| Modelo de opções | `proposal_options` — substitui cenários para Corp/Sazonal |
| Galeria | Até 5 fotos por opção (vinculadas à opção, não à proposta global) |
| Briefing Corporativo | `qtd_solicitada`, `orcamento_max`, `data_entrega` |
| Data comemorativa | Select + pré-preenchimento automático de prazo/abertura |
| Máximo de opções | 5 por proposta Corp/Sazonal |
| Duplicar proposta | Copia dados + options + faixas + imagens por opção |
| Template Evento | NÃO mudou |

#### Subfase 12B-1 — Migrations
**Status: [x] Concluído**

- **0011:** tabela `proposal_options` (option_id, proposal_id, nome, descricao, valor_unit, ordem)
- **0012:** coluna `option_id` em `proposal_media` (vincula imagem à opção)
- **0013:** tabela `proposal_option_faixas` (faixa_id, option_id, ate, preco, ordem)
- **0014:** colunas `qtd_solicitada`, `orcamento_max`, `data_entrega`, `data_comemorativa` em `proposals`

#### Subfase 12B-2 — Worker (rotas de options + mídia + duplicar)
**Status: [x] Concluído**

- `POST/PUT/DELETE /api/proposals/:id/options` — CRUD de opções
- `POST/DELETE /api/proposals/:id/options/:oid/media` — imagens por opção
- `POST /api/proposals/:id/duplicate` — copia options + faixas + imagens
- `obaLoadProposal` carrega options + faixas + medias em cascata

#### Subfase 12B-3 — Central: formulários Corporativo e Sazonal
**Status: [x] Concluído**

- Modal de seleção de template (Evento / Corporativo / Sazonal)
- `obaAdicionarOpcao(tipo, dadosExistentes)` — renderiza card de opção com foto, faixas
- `obaOpcaoProcessarImagem` — comprime e faz preview de foto por opção
- `obaPreencherCamposSazonais` — pré-preenche prazo/abertura por data comemorativa
- `obaColetarOptions` — coleta opções do DOM para salvar via API
- Formulário Corporativo: campos base + briefing (qtd, orçamento, data entrega)
- Formulário Sazonal: data comemorativa + condições + opções com faixas
- Cenários ocultos para Corp/Sazonal; exibidos apenas para Evento
- Salvar sincroniza options via `POST/PUT /options` após salvar proposta

#### Subfase 12B-4 — Páginas públicas Corporativo e Sazonal
**Status: [x] Concluído**

- Corporativo: Pg0 (abertura + briefing), Pg1 (resumo de opções), Pg2..N (detalhe por opção com fotos + faixas + CTA WhatsApp)
- Sazonal: Pg0 (abertura + condições), Pg1 (opções com foto principal + tabela de faixas + CTA)
- Ambas usam `proposal.options` em vez de cenários

HEAD: `a8d7312`

---

### Melhorias de UX pós-12B
**Status: [x] Concluído — 30/09/2026**

Conjunto de melhorias aprovadas e implementadas após homologação da 12B:

- **Autenticação simplificada:** senha única `Oba2026!` para todos os acessos; campo Nome removido; `minlength` removido do HTML
- **Ordenação nas tabelas:** clique no `<th>` ordena A→Z / Z→A com seta indicadora; padrão Nome A→Z ao carregar
- **Dropdowns de Categoria:** ordenados por grupo + número romano (Clássicos I→II, Especiais I→II→III, Tradicionais I→II)
- **Cards de resumo:** número grande = ativos; "de X" discreto = total (só se houver inativos)
- **Toggle ativo/pausado na Edição Visual:** checkbox por página/módulo fixo e por Seção Extra; inativar oculta do cardápio público preservando conteúdo na Central

HEAD: `5fbff2a`

---

### Fase 12C — Catálogo de Festas (vitrine pública)
**Status: [ ] Pendente — após homologação do estado atual**

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
| 27/09/2026 | 12B-rev1 | Fix validação template, faixas dinâmicas, frequência corp, observações sazonal. HEAD: 943df8e |
| 27/09/2026 | 12B-rev2 | Redesign visual Corporativo (esmeralda+cobre) e Sazonal (paletas temáticas). Faixas De-Até. Migration 0015. HEAD: f2c7809 |
| 30/09/2026 | Autenticação simplificada | Senha Oba2026!, campo Nome removido, minlength removido. |
| 30/09/2026 | Ordenação tabelas Central | Clique no th ordena colunas A→Z/Z→A. Dropdowns Categoria ordenados por grupo+romano. |
| 30/09/2026 | Cards de resumo | Ativos em destaque, total discreto. |
| 30/09/2026 | Toggle ativo/pausado | Edição Visual: checkbox por página/módulo e Seção Extra. HEAD: 5fbff2a |
| 30/09/2026 | Fechamento de sessão | Docs atualizados, tag v12C-pre criada, bundle de backup gerado. |
| 01/10/2026 | Duplicar botão/seção | ⧉ no header de cards; seção duplicada nasce pausada. |
| 01/10/2026 | Toggle visibilidade | 👁/🚫 no header do card de botão do menu. |
| 01/10/2026 | Ver mais compacto | Linha discreta, sem bloco largo; overflow herda layout pag-3. |
| 01/10/2026 | Fechamento de sessão | Docs atualizados, tag v12C-pre-2, bundle de backup gerado. |
| 01/10/2026 | Dropdown Catálogo | Agrupa 6 abas em menu suspenso; barra reduzida de 10 para 5 itens. HEAD: baca909 |
| 01/10/2026 | Fechamento de sessão | Docs atualizados, tag v12C-pre-3, bundle de backup gerado. |
| 02/10/2026 | Separador visual | ⬢ → · em 50 ocorrências no cardápio público. |
| 02/10/2026 | Barra de contexto | Alterações não salvas nas páginas fixas da Edição Visual. |
| 02/10/2026 | Validação seção extra | Bloqueio de salvamento sem label quando seção ativa + botão marcado. |
| 02/10/2026 | Fluxo Preview/Publicar | Separado em 3 botões: Visualizar Preview / Publicar após Preview / Visualizar cardápio. |
| 02/10/2026 | Planejamento 12C | Estrutura aprovada: /catalogo, 4 subfases, slot isolado D1, grupos Doces Artesanais/Finos. |
| 02/10/2026 | Fechamento de sessão | Docs atualizados, tag v12C-pre-4, bundle de backup gerado. |
| 03/10/2026 | fix: badge publicação | atualizarStatus() em 6 pontos de salvamento. Causa raiz: badge desatualizado deixava publicarBtn disabled. Testado e aprovado. |
| 03/10/2026 | fix: Worker robustez | ctx.waitUntil para sync GitHub, try/catch /api/, gate pós-write protegido. HEAD: 5cc7dad |
| 04/10/2026 | 12C-3 melhorias catálogo | abas agrupadas, lightbox, ?start=3, float-bar, redesign Rosa Creme, layout editorial Pg1+Pg2 unificadas. HEAD: 8da620d |
| 04/10/2026 | Paleta Verde Sálvia | #6B9E7A aprovada. Fix encoding BOM. HEAD: 48dd22c |
| 04/10/2026 | Cardápio B+ Parte 1 | Textos Pg1/Pg2 via theme.json. HEAD: 4ff4c3f |
| 04/10/2026 | Cardápio B+ Parte 2 | CSS tipografia Pg1/Pg2 aprovado. HEAD: 7d8f120 |

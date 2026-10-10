# CHANGELOG

Formato inspirado em Keep a Changelog.

## [Sessão 13] — 2026-10-09 — commit dbeb0ea

### Added
- Select dinâmico para ID de grupo no editor de Pg2 do catálogo — populado de `catalogo.categories.grupoCatalogo`
- Opção "Personalizado..." com input de texto para IDs novos
- Aviso inline ⚠️ quando ID não tem categorias correspondentes
- Link "→ Criar categorias para este grupo" no aviso — `catEdIrParaCategorias(link)`
- `catEdPopularSelectGrupo`, `catEdOnGrupoIdChange`, `catEdAtualizarGrupoId`, `catEdIdsGruposDisponiveis`, `catEdIrParaCategorias`

### Changed
- `edGrupoCatalogo` no editor de Categorias: dinâmico (era hardcoded artesanais/finos)
- Leituras de `.cat-grupo-id` atualizadas para seletor `[type="hidden"]` prioritário



### Added
- Editor Visual Catálogo P1+P2: editor dinâmico de grupos `#cat-pg2-grupos-lista` na Central
- Schema `theme-catalogo.json` v4: `pg2.grupos_ordem[]` — array dinâmico de botões de grupo
- Funções: `catEdAdicionarCardGrupo`, `catEdAdicionarGrupo`, `catEdRestaurarGrupos`, `catEdRemoverGrupo`, `catEdDuplicarGrupo`, `catEdToggleVisivel`, `catEdMoverGrupo`, `catEdEscolherIcone`, `catEdAtualizarNumeracao`, `catEdLerGrupos`
- Cards com: ID (monospace), label, sublabel, ícone (12 emojis), destaque, visível, ↑↓, 👁/🚫, ⧉, ✕
- Validações em `_salvarCatalogo`: ID vazio, IDs duplicados, mínimo 1 grupo visível

### Changed
- `catMontarPg3()`: refatorado para iterar `grupos_ordem[]` com fallback v3
- `catAbrirGrupo()`: sem hardcode artesanais/finos — usa `grupos{}` → `grupos_ordem[]` → fallback genérico
- `catNavegar()`: lógica de único grupo generalizada para N grupos
- `obaPopularFormCatalogo()`: popula editor via `catEdRenderizarGrupos()` com fallback v3
- `obaLerFormCatalogo()`: grava `grupos_ordem` via `catEdLerGrupos()`
- `_salvarCatalogo()`: validação dinâmica substituindo hardcode artesanais/finos



### Added
- Pós-envio de contrato: scroll automático para caixa de link após confirmação
- Botão "📱 Enviar pelo WhatsApp" em destaque (verde, largura total) com mensagem personalizada (nome, tipo evento, data, nº contrato, link)
- Função `obaContractEnviarWppAtivo()` — usa dados em memória, sem fetch extra
- Flag `incluido` em `proposal_items` (migration 0020): item marcado como cortesia exibe valor riscado + "Incluído", não entra no total
- Checkbox "incluído" no editor de itens livres da Central — preservado na cópia de cenário
- Tabela de produtos profissional: categorias `__total__` em destaque, sabores individuais suprimidos quando categoria tem total, nota descritiva do desconto, nota vinculando sabores à proposta
- Referência da proposta no cabeçalho do contrato (cliente · tipo · data)
- `obaGetCatalogPrecos` retorna `catNomes` (mapa cid → nome)
- PDF via `window.print()` com CSS `@media print` na página pública do contrato
- Link permanente copiável pós-aceite (Clipboard API + fallback execCommand)
- Caixa de link permanente funciona em ambos os cenários: pós-aceite imediato e contrato já aceito

### Fixed
- Link permanente estava vazio no bloco "já aceito" — script global movido para fora do ternário
- `obaContractConfirmarEnvio` substituiu `alert()` por scroll suave até a caixa de link

### Changed
- `obaGerarContratoHTML` aceita 6º parâmetro `catNomes`
- `obaContractCenarioTotal` exclui itens com `incluido=1` do subtotal
- Label do campo descrição de item livre: "Nome do produto ou serviço (ex: Montagem da mesa)"
- `obaUpsertScenarios` persiste campo `incluido`
- `livreLinhas` na proposta pública exibe "Incluído" quando `incluido=1`

## [Unreleased]

### Added

- Governança portátil entre agentes/IDEs.
- AGENTS.md.
- PROJECT_BRIEF.md.
- CURRENT_STATE.md.
- DECISIONS.md.
- ROADMAP.md.
- HANDOFF.md.
- Script .scripts/PROJECT-handoff.ps1.

### Changed

- O repositório passa a ser a memória operacional oficial do projeto.
- Scripts persistentes são preferidos a grandes blocos colados no PSReadLine.

## [12B-rev2] — 2026-09-27 — commit f2c7809

### Added
- Migration 0015: coluna `de` em `proposal_option_faixas` (formato "De X a Até Y")
- Corporativo: paleta esmeralda escuro (`#1C3B2E`) + cobre (`#C8922A`); pg0 com fundo escuro, chips de briefing, texto contextualizado; pg1 lista de opções; pg2+ detalhe com foto, faixas, CTA
- Sazonal: paletas temáticas por data (Natal/Páscoa/Mães/Pais/Namorados/Crianças); pg0 emocional sem condições; condições no rodapé de pg1; hero foto grande em pg2+
- Faixas formato "De X a Até Y un." com dois campos editáveis na Central
- `obaAdicionarFaixa` e `obaColetarOptions` suportam campo `de`

### Changed
- Worker: INSERT/UPDATE faixas inclui campo `de`
- Sazonal: condições (prazos, pagamento) movidas de pg0 para rodapé de pg1

## [12B-rev1] — 2026-09-27 — commit 943df8e

### Fixed
- Validação "Nome do cliente obrigatório" bifurca por template
- Campo frequência corporativo restaurado

### Added
- Faixas de preço dinâmicas com + Adicionar / ✕ Remover (Sazonal)
- Campo "Observações / instruções de pedido" no Sazonal
- Observações exibidas na página pública sazonal

### Changed
- Corporativo: card de opção sem faixas (só valor unitário)

## [12B] — 2026-09-27 — commit a8d7312

### Added
- `proposal_options`: tabela de opções para propostas Corporativo e Sazonal (máx. 5)
- `proposal_option_faixas`: preços por volume por opção (ate, preco, ordem)
- `proposal_media.option_id`: vincula imagem a uma opção específica
- `proposals`: campos `qtd_solicitada`, `orcamento_max`, `data_entrega`, `data_comemorativa`
- Worker: rotas `POST/PUT/DELETE /api/proposals/:id/options`
- Worker: rotas `POST/DELETE /api/proposals/:id/options/:oid/media`
- Worker: `duplicate` copia options + faixas + imagens por opção
- Worker: `obaLoadProposal` carrega options + faixas + medias em cascata
- Central: `obaAdicionarOpcao(tipo, dadosExistentes)` — card de opção com foto e faixas
- Central: `obaOpcaoProcessarImagem` — comprime e envia foto por opção
- Central: `obaPreencherCamposSazonais` — pré-preenchimento automático por data comemorativa
- Central: `obaColetarOptions` — coleta DOM → API ao salvar
- Página pública Corporativo: opções com foto, faixas, briefing, CTA por opção
- Página pública Sazonal: opções com foto principal, tabela de faixas, CTA

### Changed
- `obaAplicarTemplate`: cenários ocultos para Corp/Sazonal; visíveis só para Evento
- `obaProposalEditar`: Corp/Sazonal carregam `p.options` em vez de galeria global
- `obaProposalSalvar`: Corp coleta briefing; Sazonal coleta data comemorativa; ambos sincronizam options via API
- `obaLimparFormulario`: limpa containers de options em vez de produtos sazonais

## [12A] — 2026-09-25 — commit ecbc167

## Estado técnico anterior

Última fase funcional homologada:
8E.9D-A — Rascunho Online.

Baseline anterior:
c4d4c2d.

## 2026-09-01 Ã¢â‚¬â€ 8E.9D-B + 8E.9E

### Added
- Central integrada ao DRAFT.
- API PREVIEW.
- Preview privado autenticado.
- E2E remoto de Preview.

### Security
- PUBLISHED preservado.
- CSRF exigido no Preview.
- Preview anonimo bloqueado.

# HANDOFF

Atualizado: 2026-09-14 00:00:00

Projeto: Oba Doceria - Cardapio Virtual + Central de Gestao.
Branch: feature/gestao-online-segura
Commit HEAD: 1a2afd6

## Ultima fase aprovada
9A — Infraestrutura de Tema Visual.

### O que foi implementado
- `online/gestao/public/data/catalog-v1/theme.json` (novo):
  Arquivo JSON com os textos editáveis de todas as páginas do cardápio e os tokens
  do tema visual (cores e fonte). É a fonte canônica das configurações visuais.

- `online/gestao/src/index.js` (alterado):
  `"tema": "theme.json"` adicionado a `OBA_CATALOG_FILES`.
  Aliases `tema`/`theme` adicionados a `OBA_CATALOG_ALIASES`.
  `obaCatalogSnapshot()` inclui `theme.json` automaticamente no payload
  gravado no DRAFT e promovido para PREVIEW/PUBLISHED.

- `online/gestao/public/preview-bootstrap.js` (alterado):
  `'theme.json': 'tema'` adicionado ao mapa de interceptação de `window.fetch`.
  O preview privado (/__preview) entrega o tema do slot PREVIEW do D1.

- `online/gestao/public/ui-desenvolvimento/index.html` (alterado):
  `<style id="oba-tema-vars">` adicionado no `<head>` para receber CSS variables.
  31 IDs `oba-*` adicionados nos elementos editáveis das páginas 1, 2, 3,
  fluxo-principal, secao-kits, modal personalizados e modal eventos.
  Função `hidratarTemaDoModeloMestre()` adicionada após `hidratarCatalogoDoModeloMestre()`:
  carrega `theme.json`, aplica textos nos IDs e injeta variáveis CSS.
  Fallback preservado: se o fetch falhar, HTML original é mantido intacto.

### Estado do ciclo DRAFT/PREVIEW/PUBLISHED
- theme.json está nos assets estáticos com os valores originais do cardápio.
- O slot DRAFT do D1 ainda não foi atualizado com tema (será feito na 9B via Central).
- O cardápio público já carrega e aplica theme.json — comportamento transparente
  (valores idênticos ao hardcoded original enquanto não houver edição).

## Fases concluídas
- 8E.10 — Homologação Geral do Sistema (Gestão Ponta a Ponta, Cardápio, Mídia, Segurança e WhatsApp).
- 8E.11 — Encerramento da Migração, Tag Oficial e Sincronização no GitHub.
- 9A — Infraestrutura de Tema Visual (commit 1a2afd6).

## Proximo passo
9B — Aba de Edição Visual na Central de Gestão:
  - Nova aba "Edição Visual" na Central privada.
  - Sub-aba "Páginas": formulários estruturados por página (textos + imagens via galeria).
  - Sub-aba "Tema Global": color pickers para as 5 cores + seletor de fonte.
  - Salva no DRAFT (debounced) via POST /api/draft.
  - Confirmar que o DRAFT inclui o tema antes de prosseguir para PREVIEW.

Leia AGENTS.md, docs/CURRENT_STATE.md, docs/DECISIONS.md e docs/ROADMAP.md antes de alterar codigo.

# CURRENT STATE

Atualizado: 2026-09-14 00:00:00

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 2ad4329

## Estado funcional
- Central privada autenticada e 100% isolada da exposição pública.
- D1 operacional com schemas 0001_catalog_states.sql e 0002_catalog_media.sql.
- Fluxo DRAFT → PREVIEW → PUBLISHED operacional com rollback e histórico de versões.
- Pipeline de mídia online operacional (upload, D1, servimento com cache imutável).
- Slot PUBLISHED preservado e intacto (baseline pub_c3b7ee083866bb26a7a0b881).

## Fase 9A (commit 1a2afd6) — Infraestrutura de Tema Visual
- catalog-v1/theme.json: textos de 6 páginas + tokens de cor e tipografia.
- Worker: "tema":"theme.json" em OBA_CATALOG_FILES, aliases tema/theme.
- preview-bootstrap.js: theme.json interceptado para o slot PREVIEW do D1.
- Cardápio: 31 IDs oba-*, hidratarTemaDoModeloMestre(), style#oba-tema-vars.

## Fase 9B (commit 79bf902) — Aba de Edição Visual na Central
- Nova aba "✏️ Edição Visual" na Central com sub-abas Páginas e Tema Global.
- 6 formulários colapsáveis por página/modal com edição de textos e logo.
- obaNormalizeCatalog e obaDraftPayload incluem campo tema.

## Fase 9B-fix + expansão (commit 4b073c3) — Bug fix + Tipografia + Variantes
- Corrigido bug tela branca: sub-abas internas usam class vtab/vtab-active.
- Sub-aba Tema Global expandida: 6 variantes visuais (swatches clicáveis),
  sliders de tamanho de fonte (título 18–40px, corpo 11–18px), peso do título
  e do texto, slider de arredondamento (0–40px), seletor de espaçamento,
  10 fontes disponíveis, preview ao vivo refletindo todos os controles.
- theme.json schemaVersion 2: tokens tamanhoTitulo, tamanhoCorpo, pesoTitulo,
  pesoCorpo, arredondamento, espacamento, variante.
- hidratarTemaDoModeloMestre() injeta --oba-tam-titulo, --oba-tam-corpo,
  --oba-peso-titulo, --oba-peso-corpo, --oba-radius, --oba-espacamento.

## Fase 9C (commit 2ad4329) — Controles visuais por página
- Formulários pag1/pag2/pag3 expandidos com 4 seções cada:
  Textos | Imagem | Cores desta página | Visibilidade
- Pag1: tamanhoLogo, corFundo, corTitulo, toggle exibirSubtitulo, toggle exibirCTA
- Pag2: tamanhoLogo, corFundo (card), corTitulo, toggle exibirCitacao, toggle exibirSeparador
- Pag3: tamanhoLogo, corFundo, corSubtitulo, 4 toggles de visibilidade de botões
- Botão "✕ Limpar" por cor de página (volta ao tema global)
- theme.json schemaVersion 3: todos os novos campos por página com defaults seguros
- hidratarTemaDoModeloMestre() aplica tamanho de logo (mapa px), cores por seção
  via element.style, e visibilidade via display none/'' para todos os elementos.

## Ultima fase aprovada
9C — Controles visuais por página (commit 2ad4329).

## Próximo passo recomendado
Homologar ao vivo na Central:
  1. Abrir aba Edição Visual → sub-aba Páginas
  2. Alterar cor de fundo da Página 1, salvar
  3. Visualizar cardápio (Preview) → confirmar cor aplicada
  4. Publicar

Fase 9D (futura): Preview ao vivo com iframe simulando celular dentro da Central.

## Estado atual do ciclo
Produção Estável & Central de Edição Visual Completa.
- Central Privada Online: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Repositório Oficial: https://github.com/oba-group-projects/cardapio
- Cardápio Público: https://oba-group-projects.github.io/cardapio/

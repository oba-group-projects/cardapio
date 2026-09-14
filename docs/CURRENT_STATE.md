# CURRENT STATE

Atualizado: 2026-09-14 00:00:00

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 1a2afd6

## Estado funcional
- Central privada autenticada e 100% isolada da exposição pública.
- D1 operacional com schemas 0001_catalog_states.sql e 0002_catalog_media.sql.
- GET/POST /api/draft homologados (Central carrega DRAFT, edições gravam DRAFT).
- GET/POST /api/preview homologados (DRAFT -> PREVIEW).
- /__preview privado autenticado com headers estritos de segurança (CSP, noindex).
- POST /api/publish homologado (promoção atômica PREVIEW -> PUBLISHED).
- POST /api/publish/rollback homologado (reversão segura de revisão).
- GET /api/publish/history homologado (listagem de revisões e status ativo).
- Interface de Histórico de Versões e Rollback homologada na Central (modal, listagem e restauração instantânea com confirmação).
- Upload e gestão de mídia online homologados (POST /api/media/upload) com compressão client-side HTML5 Canvas.
- Servimento público de imagens homologado (GET /api/media/:id) com cache imutável (max-age=31536000, immutable) e suporte a ETag (HTTP 304).
- Galeria de imagens homologada (GET /api/media).
- Proteção contra preview_stale homologada (HTTP 409).
- Idempotência de publicação e rollback homologadas.
- Integridade do log catalog_promotions e tabela catalog_media no D1 confirmada.
- Slot PUBLISHED preservado e intacto (baseline pub_c3b7ee083866bb26a7a0b881).
- Suíte completa de Homologação Geral ponta a ponta 100% aprovada (.scripts/8E9/EXECUTAR_8E10_HOMOLOGACAO.ps1).

## Fase 9A — Infraestrutura de Tema Visual (concluída em 2026-09-14)
- Novo arquivo catalog-v1/theme.json: contém textos editáveis de todas as páginas do cardápio
  (boas_vindas, nossa_essencia, menu_principal, vitrine_presentes, personalizados_modal, eventos_modal)
  e tokens do tema visual (corPrimaria, corFundo, corBorda, corTexto, corFundoCard, fonte).
- Worker (OBA_CATALOG_FILES): "tema":"theme.json" adicionado — theme.json entra automaticamente
  no snapshot do DRAFT/PREVIEW/PUBLISHED via obaCatalogSnapshot().
- Worker (OBA_CATALOG_ALIASES): aliases tema/theme adicionados.
- preview-bootstrap.js: 'theme.json':'tema' adicionado ao mapa de interceptação de fetch —
  o preview privado (/__preview) serve o theme.json do slot PREVIEW do D1.
- index.html: IDs oba-pag1/2/3/fluxo-logo/vitrine/pers/eventos adicionados (31 marcadores).
  Função hidratarTemaDoModeloMestre() carrega theme.json, aplica textos via IDs e injeta
  CSS variables em <style id="oba-tema-vars">. Fallback preservado se fetch falhar.
- Cardápio público e preview privado prontos para receber edições de tema via Central.

## Ultima fase aprovada
9A — Infraestrutura de Tema Visual (commit 1a2afd6).

## Próximo passo
9B — Aba de Edição Visual na Central:
  formulários por página + painel de Tema Global (color pickers, fonte) + save no DRAFT.

## Estado atual do ciclo
Produção Estável & Desenvolvimento da Central de Edição Visual.
- Central Privada Online: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Repositório Oficial: https://github.com/oba-group-projects/cardapio
- Cardápio Público: https://oba-group-projects.github.io/cardapio/

# CURRENT STATE

Atualizado: 2026-09-03 12:47:00

## Git
Branch: feature/gestao-online-segura
Baseline anterior da fase: d519493

## Estado funcional
- Central privada autenticada e 100% isolada da exposiÃ§Ã£o pÃºblica.
- D1 operacional com schemas 0001_catalog_states.sql e 0002_catalog_media.sql.
- GET/POST /api/draft homologados (Central carrega DRAFT, ediÃ§Ãµes gravam DRAFT).
- GET/POST /api/preview homologados (DRAFT -> PREVIEW).
- /__preview privado autenticado com headers estritos de seguranÃ§a (CSP, noindex).
- POST /api/publish homologado (promoÃ§Ã£o atÃ´mica PREVIEW -> PUBLISHED).
- POST /api/publish/rollback homologado (reversÃ£o segura de revisÃ£o).
- GET /api/publish/history homologado (listagem de revisÃµes e status ativo).
- Interface de HistÃ³rico de VersÃµes e Rollback homologada na Central (modal, listagem e restauraÃ§Ã£o instantÃ¢nea com confirmaÃ§Ã£o).
- Upload e gestÃ£o de mÃ­dia online homologados (POST /api/media/upload) com compressÃ£o client-side HTML5 Canvas.
- Servimento pÃºblico de imagens homologado (GET /api/media/:id) com cache imutÃ¡vel (max-age=31536000, immutable) e suporte a ETag (HTTP 304).
- Galeria de imagens homologada (GET /api/media).
- ProteÃ§Ã£o contra preview_stale homologada (HTTP 409).
- IdempotÃªncia de publicaÃ§Ã£o e rollback homologadas.
- Integridade do log catalog_promotions e tabela catalog_media no D1 confirmada.
- Slot PUBLISHED preservado e intacto (baseline pub_c3b7ee083866bb26a7a0b881).
- SuÃ­te completa de HomologaÃ§Ã£o Geral ponta a ponta 100% aprovada (.scripts/8E9/EXECUTAR_8E10_HOMOLOGACAO.ps1).

## Ultima fase aprovada
8E.10 / 8E.11 â€” HomologaÃ§Ã£o Geral do Sistema e Encerramento Oficial da MigraÃ§Ã£o (Tag `gestao-online-homologada-20260903`).

## Estado atual do ciclo
ProduÃ§Ã£o EstÃ¡vel & OperaÃ§Ã£o ContÃ­nua da Oba Doceria.
- Central Privada Online: https://oba-cardapio-gestao.obadoceria.workers.dev/
- RepositÃ³rio Oficial: https://github.com/oba-group-projects/cardapio
- CardÃ¡pio PÃºblico: https://oba-group-projects.github.io/cardapio/

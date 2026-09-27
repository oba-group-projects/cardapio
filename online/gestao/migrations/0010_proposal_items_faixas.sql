-- ============================================================
-- OBA DOCERIA - FASE 12B
-- Faixas de preco por volume nos itens (template sazonal)
-- Formato JSON: [{"ate":9,"preco":45.00},{"ate":49,"preco":40.00},
--               {"ate":99,"preco":36.00},{"ate":null,"preco":32.00}]
-- "ate": null significa "acima de X" (ultima faixa, sem limite)
-- ============================================================

ALTER TABLE proposal_items ADD COLUMN faixas TEXT;

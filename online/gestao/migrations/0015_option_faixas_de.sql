-- ============================================================
-- OBA DOCERIA - FASE 12B-rev2
-- Adiciona coluna 'de' em proposal_option_faixas
-- para o formato "De X a Y unidades" nas faixas de preco
-- NULL = começa do 1 (padrão implícito)
-- ============================================================

ALTER TABLE proposal_option_faixas ADD COLUMN de INTEGER;

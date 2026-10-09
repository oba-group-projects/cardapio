-- Migration 0020: campo incluido em proposal_items
-- Indica item incluído sem cobrança (cortesia/bônus)
-- Quando incluido = 1: exibe valor de tabela riscado + "Incluído", não soma no subtotal

ALTER TABLE proposal_items ADD COLUMN incluido INTEGER DEFAULT 0;

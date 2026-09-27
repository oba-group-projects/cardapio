-- ============================================================
-- OBA DOCERIA - FASE 12B
-- Novos campos para templates Corporativo e Sazonal
-- ============================================================

-- template: 'evento' (default) | 'corporativo' | 'sazonal'
ALTER TABLE proposals ADD COLUMN template TEXT NOT NULL DEFAULT 'evento';

-- Campos Corporativo
ALTER TABLE proposals ADD COLUMN empresa TEXT;
ALTER TABLE proposals ADD COLUMN demanda TEXT;
ALTER TABLE proposals ADD COLUMN frequencia TEXT;
ALTER TABLE proposals ADD COLUMN orcamento_ref REAL;
ALTER TABLE proposals ADD COLUMN observacoes TEXT;

-- Campos Sazonal
ALTER TABLE proposals ADD COLUMN prazo_pedido TEXT;
ALTER TABLE proposals ADD COLUMN prazo_entrega TEXT;
ALTER TABLE proposals ADD COLUMN cond_pagamento TEXT;
ALTER TABLE proposals ADD COLUMN pedido_minimo INTEGER;

-- Indice por template para listagem filtrada
CREATE INDEX IF NOT EXISTS idx_proposals_template
ON proposals(template);

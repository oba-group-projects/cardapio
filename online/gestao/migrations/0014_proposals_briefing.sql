-- ============================================================
-- OBA DOCERIA - FASE 12B redesign
-- Campos de briefing para proposta Corporativa
-- qtd_solicitada: quantidade pedida pela empresa
-- orcamento_max: teto de investimento informado
-- data_entrega: data e hora desejada para entrega
-- data_comemorativa: para sazonais (Natal, Pascoa etc)
-- ============================================================

ALTER TABLE proposals ADD COLUMN qtd_solicitada INTEGER;
ALTER TABLE proposals ADD COLUMN orcamento_max  REAL;
ALTER TABLE proposals ADD COLUMN data_entrega   TEXT;
ALTER TABLE proposals ADD COLUMN data_comemorativa TEXT;

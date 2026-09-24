PRAGMA foreign_keys = ON;

-- ============================================================
-- OBA DOCERIA - PROPOSTAS: adicionar campo whatsapp do cliente
-- ============================================================

ALTER TABLE proposals ADD COLUMN whatsapp TEXT;

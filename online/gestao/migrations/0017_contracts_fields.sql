-- ============================================================
-- OBA DOCERIA - CONTRATOS: campos complementares v2
-- nome_completo substitui email_cliente como campo principal
-- novos: email_cliente (secundario), horario_entrega, responsavel_recebimento
-- ============================================================

ALTER TABLE contracts ADD COLUMN nome_completo TEXT;
ALTER TABLE contracts ADD COLUMN horario_entrega TEXT;
ALTER TABLE contracts ADD COLUMN responsavel_recebimento TEXT;

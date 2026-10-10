-- Migration 0021: snapshot do contrato pós-aceite
-- snapshot_aceite_html: gerado no momento do aceite eletrônico
-- Contém o mesmo conteúdo do snapshot_html mas com status e dados do aceite incorporados
-- O snapshot_html original permanece imutável (prova de integridade do documento enviado)

ALTER TABLE contracts ADD COLUMN snapshot_aceite_html TEXT;

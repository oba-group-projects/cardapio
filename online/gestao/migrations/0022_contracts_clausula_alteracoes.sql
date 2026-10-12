-- Migration 0022: cláusula de alterações de pedido
-- clausula_alteracoes: texto editável no rascunho, congelado no snapshot ao enviar
-- Inserida entre clausula_cancelamento e clausula_responsabilidades

ALTER TABLE contracts ADD COLUMN clausula_alteracoes TEXT;

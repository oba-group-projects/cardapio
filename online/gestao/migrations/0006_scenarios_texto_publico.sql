PRAGMA foreign_keys = ON;

-- Adiciona campo de introducao publica do cenario (separado da descricao interna)
ALTER TABLE proposal_scenarios ADD COLUMN texto_publico TEXT;

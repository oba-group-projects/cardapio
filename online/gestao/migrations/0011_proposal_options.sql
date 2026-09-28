-- ============================================================
-- OBA DOCERIA - FASE 12B redesign
-- Opcoes de produto para propostas Corporativo e Sazonal
-- Substitui a logica de cenarios para esses templates
-- Maximo 5 opcoes por proposta
-- ============================================================

CREATE TABLE IF NOT EXISTS proposal_options (
    option_id   TEXT PRIMARY KEY,
    proposal_id TEXT NOT NULL,
    nome        TEXT NOT NULL DEFAULT 'Opção 1',
    descricao   TEXT,
    valor_unit  REAL,
    ordem       INTEGER NOT NULL DEFAULT 1,
    criado_em   TEXT NOT NULL,
    FOREIGN KEY (proposal_id)
        REFERENCES proposals(proposal_id)
        ON DELETE CASCADE,
    CHECK (length(option_id) >= 8)
);

CREATE INDEX IF NOT EXISTS idx_proposal_options_proposal
ON proposal_options(proposal_id, ordem);

-- ============================================================
-- OBA DOCERIA - FASE 12B redesign
-- Faixas de preco por volume para opcoes sazonais
-- ate NULL = sem limite superior ("acima de X unidades")
-- Exemplo: ate=9 preco=58 / ate=49 preco=52 / ate=NULL preco=47
-- ============================================================

CREATE TABLE IF NOT EXISTS proposal_option_faixas (
    faixa_id  TEXT PRIMARY KEY,
    option_id TEXT NOT NULL,
    ate       INTEGER,
    preco     REAL NOT NULL DEFAULT 0,
    ordem     INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (option_id)
        REFERENCES proposal_options(option_id)
        ON DELETE CASCADE,
    CHECK (length(faixa_id) >= 8),
    CHECK (preco >= 0)
);

CREATE INDEX IF NOT EXISTS idx_option_faixas_option
ON proposal_option_faixas(option_id, ordem);

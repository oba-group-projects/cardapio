-- ============================================================
-- OBA DOCERIA - FASE 12B
-- Galeria de imagens por proposta (ate 8 por proposta)
-- Mesmo mecanismo do catalog_media: Base64 no D1, zero custo
-- ============================================================

CREATE TABLE IF NOT EXISTS proposal_media (
    media_id    TEXT PRIMARY KEY,
    proposal_id TEXT NOT NULL,
    dados       TEXT NOT NULL,
    mime        TEXT NOT NULL DEFAULT 'image/jpeg',
    tamanho     INTEGER NOT NULL DEFAULT 0,
    legenda     TEXT,
    ordem       INTEGER NOT NULL DEFAULT 1,
    criado_em   TEXT NOT NULL,
    FOREIGN KEY (proposal_id)
        REFERENCES proposals(proposal_id)
        ON DELETE CASCADE,
    CHECK (length(media_id) >= 8),
    CHECK (tamanho > 0)
);

CREATE INDEX IF NOT EXISTS idx_proposal_media_proposal
ON proposal_media(proposal_id, ordem);

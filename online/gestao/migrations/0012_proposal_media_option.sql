-- ============================================================
-- OBA DOCERIA - FASE 12B redesign
-- Adiciona option_id em proposal_media para vincular imagem
-- a uma opcao especifica (em vez de proposta inteira)
-- NULL = imagem da proposta geral (nao usada no redesign)
-- ============================================================

ALTER TABLE proposal_media ADD COLUMN option_id TEXT;

CREATE INDEX IF NOT EXISTS idx_proposal_media_option
ON proposal_media(option_id);

-- ============================================================
-- OBA DOCERIA - FASE 12A-4
-- Adiciona coluna abertura (texto livre de abertura da proposta)
-- Expande CHECK de status para incluir em_negociacao e arquivada
-- ============================================================

-- Coluna abertura: texto personalizado que substitui o gerado automaticamente
ALTER TABLE proposals ADD COLUMN abertura TEXT;

-- Coluna whatsapp: ja foi adicionada em 0004, mas pode nao existir em todos os ambientes
-- (ignorar erro se ja existir)

-- Novos status: em_negociacao, arquivada
-- SQLite nao suporta ALTER CHECK — recriamos o indice e o trigger via VIEW nao e possivel.
-- A validacao de status sera feita no Worker (nao via CHECK do SQLite).
-- O CHECK original (rascunho|enviada|aceita|recusada) continua existindo mas nao bloqueia
-- os novos valores porque o SQLite nao revalida CHECK em ALTER TABLE.
-- Para garantir consistencia, o Worker valida a lista completa de status permitidos.

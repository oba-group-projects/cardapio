-- ============================================================
-- OBA DOCERIA - MODULO DE CONTRATOS (MVP)
-- Fase 13A — Contrato de evento com aceite eletronico proprio
-- ============================================================

-- Contrato principal
-- Imutavel apos status = 'enviado'
CREATE TABLE IF NOT EXISTS contracts (
  contract_id              TEXT PRIMARY KEY,
  proposal_id              TEXT NOT NULL,
  scenario_id              TEXT NOT NULL,
  numero                   TEXT NOT NULL,

  status                   TEXT NOT NULL DEFAULT 'rascunho',

  -- Dados complementares coletados na criacao
  email_cliente            TEXT,
  cpf_cnpj                 TEXT,
  local_evento             TEXT,
  cond_pagamento           TEXT,

  -- Clausulas editaveis (no rascunho)
  clausula_cancelamento    TEXT,
  clausula_responsabilidades TEXT,
  clausula_foro            TEXT,

  -- Snapshot imutavel (gerado ao enviar)
  snapshot_html            TEXT,
  snapshot_hash            TEXT,

  -- Token publico para link do cliente
  token_publico            TEXT UNIQUE,

  criado_em                TEXT NOT NULL,
  atualizado_em            TEXT NOT NULL,

  CHECK (status IN ('rascunho', 'enviado', 'aceito', 'recusado'))
);

CREATE INDEX IF NOT EXISTS idx_contracts_proposal
ON contracts(proposal_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_numero
ON contracts(numero);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_token
ON contracts(token_publico);

-- Registro imutavel do aceite do cliente
CREATE TABLE IF NOT EXISTS contract_aceites (
  aceite_id           TEXT PRIMARY KEY,
  contract_id         TEXT NOT NULL,
  data_hora           TEXT NOT NULL,
  ip                  TEXT,
  user_agent          TEXT,
  whatsapp_confirmado TEXT,
  snapshot_hash       TEXT,
  criado_em           TEXT NOT NULL,

  FOREIGN KEY (contract_id) REFERENCES contracts(contract_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_aceites_contract
ON contract_aceites(contract_id);

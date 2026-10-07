-- ============================================================
-- OBA DOCERIA - CONTRATOS: adiciona status 'cancelado'
-- Recria tabela contracts com CHECK atualizado
-- ============================================================

PRAGMA foreign_keys = OFF;

CREATE TABLE contracts_new (
  contract_id                TEXT PRIMARY KEY,
  proposal_id                TEXT NOT NULL,
  scenario_id                TEXT NOT NULL,
  numero                     TEXT NOT NULL,
  status                     TEXT NOT NULL DEFAULT 'rascunho',
  email_cliente              TEXT,
  cpf_cnpj                   TEXT,
  local_evento               TEXT,
  cond_pagamento             TEXT,
  clausula_cancelamento      TEXT,
  clausula_responsabilidades TEXT,
  clausula_foro              TEXT,
  snapshot_html              TEXT,
  snapshot_hash              TEXT,
  token_publico              TEXT UNIQUE,
  criado_em                  TEXT NOT NULL,
  atualizado_em              TEXT NOT NULL,
  nome_completo              TEXT,
  horario_entrega            TEXT,
  responsavel_recebimento    TEXT,
  CHECK (status IN ('rascunho', 'enviado', 'aceito', 'recusado', 'cancelado'))
);

INSERT INTO contracts_new SELECT
  contract_id, proposal_id, scenario_id, numero, status,
  email_cliente, cpf_cnpj, local_evento, cond_pagamento,
  clausula_cancelamento, clausula_responsabilidades, clausula_foro,
  snapshot_html, snapshot_hash, token_publico,
  criado_em, atualizado_em, nome_completo, horario_entrega, responsavel_recebimento
FROM contracts;

DROP TABLE contracts;

ALTER TABLE contracts_new RENAME TO contracts;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_numero   ON contracts(numero);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_token    ON contracts(token_publico);
CREATE        INDEX IF NOT EXISTS idx_contracts_proposal ON contracts(proposal_id);

PRAGMA foreign_keys = ON;

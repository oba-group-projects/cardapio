PRAGMA foreign_keys = ON;

-- ============================================================
-- OBA DOCERIA - PROPOSTAS DE ORCAMENTO
-- Fase 12A — Modulo de propostas com 3 cenarios
-- ============================================================

-- ------------------------------------------------------------
-- Proposta principal
-- Dados do evento + resumo geral
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposals (
    proposal_id   TEXT PRIMARY KEY,
    cliente       TEXT NOT NULL,
    data_evento   TEXT,
    convidados    INTEGER,
    tipo_evento   TEXT,
    resumo        TEXT,
    validade      TEXT,
    status        TEXT NOT NULL DEFAULT 'rascunho',
    criado_em     TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,

    CHECK (length(proposal_id) >= 8),
    CHECK (status IN ('rascunho', 'enviada', 'aceita', 'recusada'))
);

CREATE INDEX IF NOT EXISTS idx_proposals_status
ON proposals(status);

CREATE INDEX IF NOT EXISTS idx_proposals_criado_em
ON proposals(criado_em DESC);

-- ------------------------------------------------------------
-- Cenários de cada proposta (até 3, mas sem limite forçado)
-- Nome editável, descricao, desconto por cenário
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposal_scenarios (
    scenario_id      TEXT PRIMARY KEY,
    proposal_id      TEXT NOT NULL,
    nome             TEXT NOT NULL DEFAULT 'Cenário 1',
    descricao        TEXT,
    desconto_tipo    TEXT NOT NULL DEFAULT 'none',
    desconto_valor   REAL NOT NULL DEFAULT 0,
    ordem            INTEGER NOT NULL DEFAULT 1,

    FOREIGN KEY (proposal_id)
        REFERENCES proposals(proposal_id)
        ON DELETE CASCADE,

    CHECK (length(scenario_id) >= 8),
    CHECK (desconto_tipo IN ('none', 'reais', 'percentual')),
    CHECK (desconto_valor >= 0)
);

CREATE INDEX IF NOT EXISTS idx_proposal_scenarios_proposal
ON proposal_scenarios(proposal_id, ordem);

-- ------------------------------------------------------------
-- Itens de cada cenário
-- tipo 'catalogo': ref_id aponta para item do catálogo
-- tipo 'livre':    descricao e preco_unit preenchidos manualmente
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposal_items (
    item_id       TEXT PRIMARY KEY,
    scenario_id   TEXT NOT NULL,
    tipo          TEXT NOT NULL DEFAULT 'livre',
    ref_id        TEXT,
    descricao     TEXT NOT NULL,
    qtd           REAL NOT NULL DEFAULT 1,
    preco_unit    REAL NOT NULL DEFAULT 0,
    ordem         INTEGER NOT NULL DEFAULT 1,

    FOREIGN KEY (scenario_id)
        REFERENCES proposal_scenarios(scenario_id)
        ON DELETE CASCADE,

    CHECK (length(item_id) >= 8),
    CHECK (tipo IN ('catalogo', 'livre')),
    CHECK (qtd > 0),
    CHECK (preco_unit >= 0)
);

CREATE INDEX IF NOT EXISTS idx_proposal_items_scenario
ON proposal_items(scenario_id, ordem);

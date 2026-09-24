PRAGMA foreign_keys = ON;

-- Adiciona campo doces_por_convidado nos cenários de proposta
ALTER TABLE proposal_scenarios ADD COLUMN doces_por_convidado REAL;

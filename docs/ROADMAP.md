## Concluído
- Cardápio público funcional.
- Central de Gestão construída.
- Central privada online.
- Autenticação e segurança.
- Catálogo online em leitura.
- Imagens existentes disponíveis.
- D1.
- Modelo de revisões e slots.
- Baseline PUBLISHED.
- Backend DRAFT.
- 8E.9D-B — Central -> DRAFT.
- 8E.9E — Preview privado (/__preview).
- 8E.9F — Publicação segura (PREVIEW -> PUBLISHED) + Rollback automatizado.
- 8E.9G — Rollback operacional na Central (Histórico de versões + UI de restauração).
- 8E.9H — Pipeline de Mídia Online (Upload, D1, Servimento público com cache imutável e zero custo).
- 8E.10 — Homologação Geral do Sistema.
- 8E.11 — Encerramento da Migração, Tag Oficial e Sincronização no GitHub.
- 9A — Infraestrutura de Tema Visual: theme.json, hidratarTemaDoModeloMestre(), IDs no HTML, Worker e preview-bootstrap.
- 9B — Aba de Edição Visual na Central: sub-aba Páginas (6 formulários), sub-aba Tema Global (5 color pickers + fonte + preview + reset), save no DRAFT.

## Próximo passo obrigatório
- Deploy 9A+9B: `wrangler deploy` em online/gestao/ + homologação ao vivo.

## Planejado
- 9C — Preview ao vivo: iframe simulando tela de celular dentro da Central,
  carrega /__preview com dados do DRAFT atual, atualiza ao salvar.

## Estado Operacional
- Produção Estável & Aguardando Deploy das Fases 9A+9B.
- Monitoramento contínuo da Central e Cardápio.

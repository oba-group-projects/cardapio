# CURRENT STATE

Atualizado: 2026-09-22

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 1c86173 (fix(ux): secao-kit-detalhe scroll suave + imagem 35dvh)
Branch main: 5913078 (fix encoding JSONs + cardapio publico)

## Estado funcional
- Central privada autenticada e operacional.
- Fluxo DRAFT → PREVIEW → PUBLISHED com rollback e histórico.
- Sync automático GitHub Pages após publicação (obaGitHubSyncPublished, requer GITHUB_PAT).
- Cardápio público funcional com edição visual completa.

## Fases concluídas (resumo)
- 9A-9C: Infraestrutura de tema, aba Edição Visual, controles por página
- 9D: Sync automático GitHub Pages
- 10A: Menu dinâmico (botões configuráveis, 7 ações, preview ao vivo, preços Personalizados editáveis)
- 10B: Overflow automático de botões (máx 4/tela → páginas 3B, 3C...) + polish
- 11D-11H: Galeria unificada, tipografia completa, aba Mídia, toggle status, sync Actions
- UX: Transição páginas 1/2/3 sem translateY (fade puro 0.25s)
- Fix-Enc: Corrigido double-encoded UTF-8 no cardápio
- Fix-Chars: Botões fechar/voltar corrigidos
- Fix-Preco: oba-preco adicionado ao preço/un dos cards de sabores
- fix(scroll): body.oba-pagina-fixa bloqueia overflow no body nas pág 1/2/3
- fix(scroll): body.oba-passo1-ativa bloqueia scroll na tela de tamanho de caixa
- UX-Presenteaveis: vitrine compacta (lista de botões), retorno correto da Degustação
- UX-Presenteaveis: tela de detalhe de kit (scroll suave, imagem 35dvh, 3 botões de ação)
- UX-Degustacao: movida para Presenteáveis/Especiais; retorno correto por fluxoAtivo

## Cardápio público — estado atual (validado em celular)
- Páginas 1/2/3: não rolam (body.oba-pagina-fixa + #pag-1/2/3 overflow:hidden)
- Passo 1 tamanho de caixa: não rola (body.oba-passo1-ativa)
- Presenteáveis: lista compacta (Tábua, Caixa Clássica, Caixa Degustação)
- Tela de detalhe dos kits: logo + cabeçalho + imagem 35dvh + scroll suave para opcionais/botões
- Caixa Degustação: acessível via Presenteáveis, retorno correto após "Salvar e Continuar"
- Fluxo de compras (pág 4+): scroll livre, sem regressão

## Próxima feature
Fase 12A-1 — Infraestrutura D1 + rotas Worker para módulo de propostas de orçamento.

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio Worker: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- GitHub: https://github.com/oba-group-projects/cardapio
- Cardápio Pages (backup): https://oba-group-projects.github.io/cardapio/

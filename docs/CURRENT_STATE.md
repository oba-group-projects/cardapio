# CURRENT STATE

Atualizado: 2026-09-22

## Git
Branch: feature/gestao-online-segura
Commit HEAD: a242ed6 (fix(scroll): bloquear scroll body nas pag 1/2/3 via oba-pagina-fixa)
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
- 11D: Seletores de tamanho nomeados (pg1/pg2/pg3) + botão Galeria nos campos de logo
- 11E: Galeria unificada GitHub+D1 com abas + tipografia completa por elemento
- 11F: Aba Mídia na Central (upload drag&drop, listagem, exclusão, copiar URL)
- 11G: Toggle status inline em todas as tabelas + galeria integrada no editor de itens
- 11H: Workflow GitHub Actions sync-cardapio.yml — sincronização automática feature → main → Pages
- UX: Transição páginas 1/2/3 sem translateY (fade puro 0.25s) (subtítulo pag1, texto e citação pag2)
- fix(scroll): body.oba-pagina-fixa bloqueia overflow no body nas pág 1/2/3 (reforça #pag-1/2/3); navegarPara() faz toggle; pág 4+ libera (commit a242ed6)

## Fases concluídas (resumo)
- 9A-9C: Infraestrutura de tema, aba Edição Visual, controles por página
- 9D: Sync automático GitHub Pages
- 10A: Menu dinâmico (botões configuráveis, 7 ações, preview ao vivo, preços Personalizados editáveis)
- 10B: Overflow automático de botões (máx 4/tela → páginas 3B, 3C...) + polish
- 11D-11H: Galeria unificada, tipografia completa, aba Mídia, toggle status, sync Actions
- UX: Transição páginas 1/2/3 sem translateY (fade puro 0.25s)
- Fix-Enc: Corrigido double-encoded UTF-8 no cardápio (Nossa Essência, Feito à mão, etc.)
- Fix-Sync: obaGitHubSyncPublished sincroniza JSONs para feature E main simultaneamente
- Fix-Chars: Botões fechar/voltar corrigidos (&#x2715;, VOLTAR ÀS OPÇÕES)
- Fix-Preco: oba-preco adicionado ao preço/un dos cards de sabores

## Estado do sync GitHub Pages
- data/catalog-v1/*.json: sincronizados para main a cada publicação via Worker
- ui-desenvolvimento/index.html: sincronizado para main via auto-sync do Worker
- PROBLEMA PENDENTE: putFileToBranch("main") no Worker falha silenciosamente
  quando há commit recente no main (SHA desatualizado). Precisar verificar logs
  do Worker após próxima publicação para confirmar se está funcionando.
- WORKAROUND ATIVO: commit manual no main com os JSONs corretos (5913078)

## Estado do cardápio público
- Encoding: UTF-8 correto (fix aplicado)
- Preços ocultos: toggle cfgExibirPrecos funciona (exibirPrecos=false no config.json do main)
- PROBLEMA: preços dos cards de sabores (R$ X,XX / un) precisam de publicação
  nova para ocultar — elemento agora tem classe oba-preco (commit ae60298)
- Página 3 (Menu): array dinâmico de botões, overflow automático com paginação
- Vitrine Presenteáveis: sem scroll — investigar overflow da seção

## Próxima feature
PRIORIDADE URGENTE: Verificar scroll da vitrine de Presenteáveis (sem scroll, itens cortados).
Confirmar que publicação nova propaga Cappuccino inativo e preços ocultos para o cardápio público.

Candidatos para próximas features:
- Fase 10C: Preview ao vivo com iframe de celular dentro da Central
- Fix definitivo do sync main via Worker (investigar falha silenciosa do putFileToBranch)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- GitHub: https://github.com/oba-group-projects/cardapio
- Cardápio: https://oba-group-projects.github.io/cardapio/

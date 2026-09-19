# CURRENT STATE

Atualizado: 2026-09-15

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 21258ff

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
- 11E: Galeria unificada GitHub+D1 com abas + tipografia completa por elemento (subtítulo pag1, texto e citação pag2)

## Estado do cardápio público
- Página 3 (Menu): array dinâmico de botões, overflow automático com paginação
- "Ver mais (N opções) →": fundo âmbar, borda sólida, contagem de itens
- Páginas de overflow (3B, 3C...): mesmo layout, botão ← Voltar
- pb-28 garante que botão WhatsApp não sobrepõe o último item

## Próxima feature
A definir — candidatos:
- Fase 10C: Preview ao vivo com iframe de celular dentro da Central
- Fase 10D: Templates de nova seção/página
- Melhorias na UX da Central (notificações, status de deploy, etc.)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- GitHub: https://github.com/oba-group-projects/cardapio
- Cardápio: https://oba-group-projects.github.io/cardapio/

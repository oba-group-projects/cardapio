# CURRENT STATE

Atualizado: 2026-09-15

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 1c860e5

## Fases concluídas nesta sessão

### 9A (1a2afd6) — Infraestrutura de Tema Visual
- theme.json, hidratarTemaDoModeloMestre(), IDs no cardápio, Worker, preview-bootstrap

### 9B (79bf902) + 9B-fix (4b073c3) — Aba Edição Visual
- Sub-aba Páginas: 6 formulários colapsáveis (textos + logo)
- Sub-aba Tema Global: 6 variantes, 5 cores, 10 fontes, sliders, preview ao vivo
- Fix: bug vtab/vtab-active corrigido

### 9C (2ad4329) — Controles visuais por página
- corFundo, corTítulo, tamanhoLogo, toggles de visibilidade por página

### 9D (418512f + eeef5a3 + 9d5ff30) — Sync GitHub Pages
- Worker: obaGitHubSyncPublished() — após publicação, atualiza JSONs no GitHub
- Branch correto: feature/gestao-online-segura, paths: data/catalog-v1/*.json
- EXECUTAR-9D-CONFIGURAR-PAT.cmd para configurar o secret GITHUB_PAT

### 10A (108a5fc + ccd96fc + 1c860e5) — Menu dinâmico Página 3
- theme.json v4: menu_principal.botoes[] (array) substitui opcoes{}
- Cardápio renderiza botões dinamicamente a partir do array
- Central: editor dinâmico com cards — adicionar, remover, reordenar
- 8 ações: caixas, presenteaveis, personalizados, eventos, degustacao, whatsapp, historia, url
- 15 ícones Font Awesome selecionáveis com clique visual
- Preview ao vivo por botão: label, sublabel, ícone, destaque, visibilidade
- Preços dos pacotes de Personalizados editáveis (3 campos + theme.json + cardápio)
- Fix: template literal CSS não fechado no style9B

## Estado funcional atual
- Central online e operacional: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Aba Edição Visual completa (Páginas + Tema Global + Menu dinâmico)
- Fluxo DRAFT → PREVIEW → PUBLISHED com rollback e histórico
- Sync automático GitHub Pages na publicação (requer GITHUB_PAT configurado)
- Cardápio público: https://oba-group-projects.github.io/cardapio/

## Próximos candidatos
- Homologar sync GitHub Pages ao vivo (confirmar GITHUB_PAT funcionando)
- Fase 10B: templates de nova seção/página
- Preview ao vivo com iframe de celular dentro da Central (9D planejado)

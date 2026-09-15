# HANDOFF

Atualizado: 2026-09-15

Branch: feature/gestao-online-segura
HEAD: 1c860e5

## Ultima fase entregue
10A — Menu dinâmico + complementos (botões configuráveis, novas ações, preços editáveis, preview ao vivo)

## Commits desta sessão (mais recente primeiro)
| Commit   | Fase     | O que fez |
|----------|----------|-----------|
| 1c860e5  | 10A-fix  | Corrige template literal CSS não fechado (SyntaxError no browser) |
| ccd96fc  | 10A-comp | +3 ações (whatsapp/degustacao/historia), preços Personalizados editáveis, preview ao vivo |
| 108a5fc  | 10A      | Menu dinâmico: array botoes[], editor de cards na Central |
| 9d5ff30  | 9D-fix2  | Corrige encoding do script CONFIGURAR_PAT |
| eeef5a3  | 9D-fix1  | Corrige branch e caminhos dos JSONs no sync |
| 418512f  | 9D       | Sync automático GitHub Pages após publicação |
| 6a68445  | docs     | Handoff 9B-fix + 9C |
| 2ad4329  | 9C       | Controles visuais por página |

## O que está funcionando
- Central privada: autenticada, operacional, deploy automático via EXECUTAR-9AB-DEPLOY.cmd
- Aba Edição Visual completa:
  - Páginas: 6 formulários com textos, logo, cores por página, visibilidade
  - Tema Global: 6 variantes, tipografia, layout, preview ao vivo
  - Menu Principal (Página 3): editor dinâmico de botões (adicionar/remover/reordenar)
- Preços dos pacotes de Personalizados editáveis na Central
- 8 ações disponíveis para botões do menu
- Preview ao vivo por botão no editor
- Sync GitHub Pages via obaGitHubSyncPublished() — requer GITHUB_PAT no Worker

## O que precisa de atenção
- Confirmar se GITHUB_PAT foi configurado e sync está funcionando
- Homologar: publicar algo → aguardar ~1min → verificar no cardápio público

## Arquivos críticos alterados nesta sessão
- online/gestao/public/data/catalog-v1/theme.json (schemaVersion 4)
- online/gestao/public/index.html (Central — editor dinâmico de botões)
- online/gestao/public/ui-desenvolvimento/index.html (cardápio — renderização dinâmica)
- online/gestao/src/index.js (Worker — obaGitHubSyncPublished)
- .scripts/8E9/EXECUTAR_9D_CONFIGURAR_PAT.ps1
- EXECUTAR-9D-CONFIGURAR-PAT.cmd

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md e ROADMAP.md antes de alterar código.

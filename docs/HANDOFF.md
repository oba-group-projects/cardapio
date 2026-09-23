# HANDOFF

Atualizado: 2026-09-22

Branch: feature/gestao-online-segura
HEAD: a242ed6

## Ultima fase entregue
fix(scroll) — body.oba-pagina-fixa: overflow:hidden no body durante pág 1/2/3, liberado na pág 4+

## Commits desta sessão (mais recente primeiro)
| Commit   | Fase       | O que fez |
|----------|------------|-----------|
| a242ed6  | fix(scroll)| body.oba-pagina-fixa: CSS + init + toggle em navegarPara() |
| 77c05a8  | fix(scroll)| #pag-1/2/3 fixas em 100dvh overflow:hidden (Passo 3) |
| 6666f09  | docs       | Marca Passo 3 como concluído no PLANO_EXECUCAO |

## O que está funcionando
- Cardápio público: pág 1/2/3 fixas sem scroll (body.oba-pagina-fixa + #pag-1/2/3)
- navegarPara() faz toggle correto: pág < 4 bloqueia body, pág >= 4 libera
- Modais fixed não são afetados (imunes a overflow do body pai)
- Fluxo de compras (pág 4+) sem nenhuma alteração
- Central privada: autenticada e operacional
- Pipeline DRAFT → PREVIEW → PUBLISHED com rollback e histórico
- Sync automático GitHub Pages via obaGitHubSyncPublished (requer GITHUB_PAT)

## O que precisa de atenção
- Deploy do Worker pendente: fazer `EXECUTAR-9AB-DEPLOY.cmd` para levar o fix ao Cloudflare
- Confirmar no celular após deploy: pág 1/2/3 não rolam, fluxo de compras funciona normal

## Arquivos críticos alterados nesta sessão
- online/gestao/public/ui-desenvolvimento/index.html (+5 linhas: CSS L25, init L4141, toggle L4180)

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md e ROADMAP.md antes de alterar código.

# HANDOFF

Atualizado: 2026-09-24

Branch: feature/gestao-online-segura
HEAD: ac87851

## Ultima fase entregue
12A-3 — Página pública /proposta/:id com 4 páginas de navegação (completo)

## Commits desta sessão (mais recente primeiro)
| Commit   | O que fez |
|----------|-----------|
| ac87851  | feat(12A-3): pagina de abertura personalizada + 4 paginas de navegacao |
| be5f388  | docs: handoff 12A-3 — pagina resumo + navegacao + copy profissional |
| 7f8d230  | feat(12A-3): pagina resumo + navegacao por cenario + copy profissional |
| db3197b  | feat: campo texto_publico por cenario (Opcao C definitiva) |

## O que está funcionando
- Aba Propostas: criar, editar, salvar, listar
- Página pública /proposta/:id com experiência de 4 etapas:
  - PG0: abertura com texto dinâmico personalizado por cliente/evento
  - PG1: resumo compacto dos 3 cenários com valor e botão "Ver detalhes"
  - PG2/3/4: detalhe completo com tabela, topbar sticky, navegação entre cenários
  - CTA: "Escolhi este cenário — vamos conversar"
  - WhatsApp: "Oba! Recebi a proposta e quero seguir com o Cenário X – Nome (R$ X). Vamos fechar os detalhes?"
  - PDF: capa elegante (pg0) + resumo + cenários individuais por página
- Gates estáticos: AUTH_GATE_STATIC_OK

## O que precisa de atenção
- Deploy pendente: executar EXECUTAR-9AB-DEPLOY.cmd para levar ac87851 ao Cloudflare
- Homologação ao vivo: testar fluxo Central → Enviar Proposta → Link público → CTA WhatsApp

## Nota técnica importante
- A função obaHandlePropostaPublica usa strings JS concatenadas (não template literals aninhados)
  para evitar corrupção silenciosa em edições futuras via str_replace

## Arquivos críticos alterados nesta sessão
- online/gestao/src/index.js (função obaHandlePropostaPublica — reescrita completa)
- docs/CURRENT_STATE.md
- docs/HANDOFF.md

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md e ROADMAP.md antes de alterar código.

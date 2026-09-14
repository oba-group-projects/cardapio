# HANDOFF

Atualizado: 2026-09-14 00:00:00

Projeto: Oba Doceria - Cardapio Virtual + Central de Gestao.
Branch: feature/gestao-online-segura
Commit HEAD: 79bf902

## Ultima fase aprovada
9B — Aba de Edição Visual na Central de Gestão.

### Histórico recente
- 9A (commit 1a2afd6): Infraestrutura de tema visual — theme.json, hidratação
  do cardápio, preview-bootstrap, Worker.
- 9B (commit 79bf902): Aba "Edição Visual" na Central — formulários por página,
  Tema Global com color pickers, lógica de save no DRAFT.

### O que foi implementado na 9B
**Arquivo:** `online/gestao/public/index.html`

Correções em funções existentes:
- `obaNormalizeCatalog`: campo `tema: s.tema||s.theme||{}` adicionado.
- `obaDraftPayload`: campo `tema: state.tema||{}` adicionado.
- `carregar()`: chamada a `obaPopularFormTema()` inserida após popular campos de config.

Nova aba HTML:
- Botão `<button class="tab" data-tab="visual">✏️ Edição Visual</button>` na `div.tabs`.
- `<section id="panel-visual">` com duas sub-abas internas (#vpanel-paginas / #vpanel-tema).
- 6 formulários colapsáveis (details/summary) para todas as páginas e modais do cardápio.
- Formulário de Tema Global com 5 color pickers (picker+hex sincronizados), seletor de
  fonte, preview inline de cores em tempo real e botão de reset.

Nova lógica JS (IIFE no final do script, após formConfig.onsubmit):
- `obaPopularFormTema()`: popula todos os campos a partir de `catalogo.tema`.
- `obaLerFormTema()`: lê todos os campos e monta o objeto tema completo.
- `obaVisualSubtab(id)`: controla troca entre sub-abas Páginas/Tema.
- `obaSalvarPaginaDoTema(nome)`: chama `obaSaveDraftWith('tema', tema)`, registra
  pendência e exibe mensagem de backup.
- Handlers `onsubmit` para os 7 forms (formPg1..formEventos + formTema).
- `obaBindCorPair(baseId)`: sincroniza color picker ↔ hex input em tempo real.
- `obaAtualizarPreviewCores()`: atualiza o preview inline ao mudar qualquer cor/fonte.
- CSS inline (`style#oba-central-9b-css`): estilos dos details colapsáveis.

### Estado do ciclo DRAFT/PREVIEW/PUBLISHED
- theme.json nos assets estáticos com valores originais do cardápio.
- As fases 9A e 9B estão commitadas mas NÃO deployadas ainda.
- Deploy necessário: `wrangler deploy` na pasta `online/gestao/`.
- Após deploy, homologar conforme fluxo descrito em CURRENT_STATE.md.

## Fases concluídas
- 8E.10 — Homologação Geral do Sistema.
- 8E.11 — Encerramento da Migração e Tag Oficial.
- 9A — Infraestrutura de Tema Visual (commit 1a2afd6).
- 9B — Aba de Edição Visual na Central (commit 79bf902).

## Proximo passo obrigatório
**Deploy das fases 9A + 9B:**
```
cd online/gestao
npx wrangler deploy
```
Depois homologar ao vivo conforme checklist no CURRENT_STATE.md.

Opcional pós-homologação:
- 9C — Preview ao vivo: iframe simulando celular dentro da Central,
  carrega /__preview e atualiza ao salvar no DRAFT.

Leia AGENTS.md, docs/CURRENT_STATE.md, docs/DECISIONS.md e docs/ROADMAP.md antes de alterar codigo.

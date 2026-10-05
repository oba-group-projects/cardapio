# HANDOFF

Atualizado: 2026-10-04 (sessão 3)

Branch: feature/gestao-online-segura
HEAD: 7d8f120

## Última entrega
Cardápio B+ — Evolução visual Pg1 e Pg2 — aprovada e deployada

## Commits recentes relevantes
| Commit   | O que fez |
|----------|-----------|
| 7d8f120  | feat: Parte 2 — CSS tipografia Pg1 e Pg2 |
| 4ff4c3f  | feat: Parte 1 — textos editoriais via theme.json |
| fbc4afe  | docs: handoff anterior |
| 48dd22c  | feat: catálogo paleta Verde Sálvia médio #6B9E7A |

## O que está funcionando (7d8f120)

### Cardápio (/cardapio) — Evolução B+ APROVADA

**Pg1:**
- Título: "Seu momento começa aqui." — caixa mista, 2.5rem/600, sem uppercase
- Subtítulo: "Doces artesanais feitos à mão, com amor e precisão." — 0.9rem/300
- CTA: "ESCOLHER MINHA EXPERIÊNCIA →"

**Pg2:**
- Título: "NOSSA ESSÊNCIA" — mantido
- Texto condensado: dois parágrafos em um, linha-height 1.9
- Citação: "Feito à mão, com amor e precisão." — itálico/500

**O que NÃO foi alterado:**
- Zero JS funcional
- Zero fluxo de compra
- Zero paleta de cores
- querySelector frágil intacto (hardening futuro)
- glass-card intacto
- bg-orange-200/60 intacto
- Todos os IDs funcionais intactos

### Como foi implementado
- **Parte 1:** `theme.json` — textos via str_replace (sem PowerShell)
- **Parte 2:** `ui-desenvolvimento/index.html` — CSS adicionado no `<style id="oba-tipografia-vars">` após linha 134
- D1 PUBLISHED atualizado manualmente via Central (Edição Visual → Salvar → Publicar)

### Catálogo (/catalogo) — APROVADO
- Paleta Verde Sálvia médio #6B9E7A
- Layout editorial Pg1 unificada
- Float-bar 3 botões flutuantes

## REGRA DE ENCODING — CRÍTICA
Nunca usar Set-Content ou Out-File do PowerShell para salvar HTML/JSON.
Sempre usar str_replace ou fs_write que preservam UTF-8 sem BOM.

## Pendente — próximas sessões

### Parte 3 — Validação completa (sem código)
- Percorrer fluxo completo: Pg1 → Pg2 → Pg3 → caixa → sabores → carrinho → WhatsApp
- Confirmar que Edição Visual na Central ainda controla os campos
- Confirmar que alterações da Central prevalecem sobre defaults

### Refinamentos futuros do Catálogo
- "Escolha o tipo de doce" → "Encontre o seu favorito" (Pg3)
- Encurtar ligeiramente o segundo parágrafo da Pg1

### Hardening técnico (fase futura)
- Substituir querySelector frágil por getElementById
- Edição Visual do Catálogo na Central (12C-4)

## Pontos de retorno seguros
- HEAD atual = 7d8f120 (estável, aprovado)
- Tag anterior = v12C-pre-4 = 9c011b3

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

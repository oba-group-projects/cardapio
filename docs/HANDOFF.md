# HANDOFF

Atualizado: 2026-10-04 (sessão 4)

Branch: feature/gestao-online-segura
HEAD: c48eb9c

## Última entrega
Cardápio B+ completo — Partes 1, 2 e 3 aprovadas. Fix ícone ← quebrado. Título Pg1 centralizado.

## Commits recentes relevantes
| Commit   | O que fez |
|----------|-----------|
| c48eb9c  | fix: byte ctrl 0x19 removido dos botões ← + título Pg1 centralizado |
| f17255f  | docs: handoff anterior |
| 7d8f120  | feat: Parte 2 — CSS tipografia Pg1 e Pg2 |
| 4ff4c3f  | feat: Parte 1 — textos editoriais via theme.json |

## Estado atual — TUDO APROVADO

### Cardápio (/cardapio) — Evolução B+ COMPLETA

**Pg1:**
- Título: "Seu momento começa aqui." — 2.5rem/600, caixa mista, centralizado
- Subtítulo: "Doces artesanais feitos à mão, com amor e precisão."
- CTA: "Escolher minha experiência"
- Ícone ← dos botões corrigido (byte 0x19 removido)

**Pg2:**
- Título: "Nossa Essência"
- Texto condensado em parágrafo único, line-height 1.9
- Citação: "Feito à mão, com amor e precisão." — itálico/500

**Pg3, fluxo de compra, Vitrine, Orçamentos:** intactos e validados

### Catálogo (/catalogo) — APROVADO
- Paleta Verde Sálvia médio (#6B9E7A, #F4F8F4)
- Layout editorial, Pg1 unificada, float-bar 3 botões, lightbox

### Validação completa (Parte 3) — PASSOU
- Pg1 → Pg2 → Pg3: navegação correta
- Fluxo de caixas: funcional
- Vitrine de Presentes: funcional
- Modal Orçamentos de Eventos: funcional
- WhatsApp flutuante: aparece da Pg3 em diante

## REGRAS TÉCNICAS CRÍTICAS
1. Nunca usar Set-Content/Out-File do PowerShell para HTML/JSON — adiciona BOM
2. Sempre usar str_replace/fs_write para edições de texto
3. Para remover bytes de controle: usar [System.IO.File]::ReadAllBytes + Replace direto de string
4. theme.json local = fallback; D1 PUBLISHED = prevalece. Para atualizar textos: editar na Central e publicar
5. querySelector('#pag-1 button[onclick="navegarPara(2)"]') — NÃO alterar o onclick
6. .glass-card e .bg-orange-200/60 — NÃO remover essas classes

## Pendente — próximas sessões

### Refinamentos do Catálogo
- "Escolha o tipo de doce" → "Encontre o seu favorito" (Pg3 do catálogo)
- Segundo parágrafo da Pg1 do catálogo levemente encurtado

### Hardening técnico (fase futura)
- Substituir querySelector frágil por getElementById
- Edição Visual do Catálogo na Central (12C-4)

## Pontos de retorno seguros
- HEAD atual = c48eb9c (estável, validado)
- Tag anterior = v12C-pre-4 = 9c011b3

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

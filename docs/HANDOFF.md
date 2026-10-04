# HANDOFF

Atualizado: 2026-10-04 (sessão 2)

Branch: feature/gestao-online-segura
HEAD: 48dd22c

## Última entrega
Catálogo — paleta Verde Sálvia médio #6B9E7A aprovada e deployada

## Commits recentes relevantes
| Commit   | O que fez |
|----------|-----------|
| 48dd22c  | feat: paleta Verde Sálvia médio #6B9E7A — aprovada |
| 10fb167  | fix: paleta Verde Sálvia sem BOM — encoding limpo |
| 2b4e0b3  | feat: paleta Verde Sálvia escuro #4E7A5C (substituída) |
| 009caa2  | docs: handoff anterior |
| 8da620d  | fix: botão Montar pedido ícone + duas linhas |

## Estado atual do Catálogo (/catalogo) — APROVADO

### Paleta Verde Sálvia médio
- `--brand: #6B9E7A`
- `--brand-dark: #5A8C6A`
- `--brand-light: #DDF0E4`
- `--text: #1E2E24`
- `--muted: #85AE92`
- `--bg: #F4F8F4`
- `--line: #C8DCC8`

### Layout e funcionalidades
- Pg1: logo vertical, rótulo "CATÁLOGO —", título "Descubra a Oba" 48px/600, dois parágrafos, CTA → Pg3
- Pg3: logo horizontal, "ESCOLHA O TIPO DE DOCE" 15px, botões Artesanais/Finos, Voltar pill
- Pg4: título 32px, abas por nome base, grid 2 colunas, scroll ok
- Float-bar: [← Voltar] [Pedir via WhatsApp] [Montar pedido ícone+2 linhas]
- Lightbox: card branco + foto + nome + ×

### REGRA DE ENCODING — CRÍTICA
Nunca usar `Set-Content` do PowerShell para salvar o index.html do catálogo.
O PowerShell adiciona BOM (Byte Order Mark) que corrompe acentos no browser.
Usar sempre as ferramentas de edição (str_replace, fs_write) que preservam UTF-8 sem BOM.

## Pendente — próximas sessões

### Refinamentos de texto no Catálogo
- Encurtar ligeiramente o segundo parágrafo
- "Escolha o tipo de doce" → "Encontre o seu favorito" (Pg3)

### Evolução visual do Cardápio (/cardapio)
Abordagem aprovada: B+ (evolução visual, não reconstrução)
- Pg1: título default "Seu momento começa aqui." + subtítulo curto
- Pg2: texto condensado conforme especificação + assinatura "Feito à mão, com amor e precisão."
- SOMENTE CSS + alteração de textos default no HTML
- NÃO alterar querySelector frágil (#pag-1 button[onclick="navegarPara(2)"])
- NÃO alterar glass-card, bg-orange-200/60, IDs funcionais
- NÃO alterar paleta do cardápio nesta fase

### Hardening técnico (fase futura)
- Substituir querySelector frágil por getElementById
- Edição Visual do Catálogo na Central (12C-4)

## Pontos de retorno seguros
- HEAD atual = 48dd22c (estável, aprovado)
- Tag anterior = v12C-pre-4 = 9c011b3

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

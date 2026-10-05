# CURRENT STATE

Atualizado: 2026-10-04 (sessão 4)

## Git
Branch: feature/gestao-online-segura
Commit HEAD: c48eb9c

## Estado funcional
- Central privada autenticada e operacional (senha Oba2026!)
- Fluxo DRAFT → PREVIEW → PUBLISHED funcional e aprovado
- Cardápio público funcional em /cardapio — evolução B+ completa e validada
- Catálogo público funcional em /catalogo — paleta Verde Sálvia aprovada

## Cardápio — estado final aprovado e validado

### Pg1
- Título: "Seu momento começa aqui." — 2.5rem/600, centralizado, sem uppercase
- Subtítulo: "Doces artesanais feitos à mão, com amor e precisão."
- CTA: "Escolher minha experiência"

### Pg2
- Título: "Nossa Essência"
- Texto condensado, dois parágrafos em um
- Citação em itálico

### Bugs corrigidos nesta sessão
- Ícone ← quebrado (←🔲): byte de controle 0x19 removido de 4 locais
- Título Pg1 centralizado

### Como textos chegam ao cardápio
1. theme.json local → Static Asset (fallback)
2. D1 PUBLISHED → prevalece sobre o HTML
3. Para atualizar: Central → Edição Visual → Salvar → Publicar

## Catálogo — estado aprovado
- Paleta Verde Sálvia médio (#6B9E7A, #F4F8F4)
- Layout editorial Pg1 unificada
- Float-bar 3 botões: Voltar / WhatsApp / Montar pedido
- Lightbox card branco

## Pontos de retorno seguros
- HEAD atual = c48eb9c (aprovado, validado)
- Tag = v12C-pre-4 = 9c011b3 (anterior)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

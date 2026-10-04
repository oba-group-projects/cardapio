# CURRENT STATE

Atualizado: 2026-10-04 (sessão 2)

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 48dd22c

## Estado funcional
- Central privada autenticada e operacional (senha Oba2026!)
- Fluxo DRAFT → PREVIEW → PUBLISHED funcional e aprovado
- Badge atualiza automaticamente após cada salvamento
- Cardápio público funcional em /cardapio
- Catálogo público funcional em /catalogo — APROVADO, paleta fechada

## Catálogo — estado final aprovado

Paleta: Verde Sálvia médio (#6B9E7A, #F4F8F4)
Layout: editorial, Pg1 unificada, float-bar 3 botões, lightbox card branco
Encoding: UTF-8 sem BOM — usar apenas str_replace/fs_write para editar

## Cardápio — pendente evolução visual

Abordagem: B+ (evolução CSS + textos, sem reconstrução)
- Pg1: "Seu momento começa aqui." como título default
- Pg2: texto condensado, assinatura "Feito à mão, com amor e precisão."
- Preservar: querySelector, glass-card, bg-orange-200/60, todos os IDs
- NÃO alterar paleta nem fluxo de compra

## Pontos de retorno seguros
- HEAD atual = 48dd22c (aprovado)
- Tag = v12C-pre-4 = 9c011b3 (anterior)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

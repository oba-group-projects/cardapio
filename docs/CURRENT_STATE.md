# CURRENT STATE

Atualizado: 2026-10-04 (sessão 3)

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 7d8f120

## Estado funcional
- Central privada autenticada e operacional (senha Oba2026!)
- Fluxo DRAFT → PREVIEW → PUBLISHED funcional e aprovado
- Badge atualiza automaticamente após cada salvamento
- Cardápio público funcional em /cardapio — evolução B+ aprovada
- Catálogo público funcional em /catalogo — paleta Verde Sálvia aprovada

## Cardápio — evolução B+ concluída e aprovada

### Pg1
- Título: "Seu momento começa aqui." — 2.5rem/600, caixa mista
- Subtítulo: "Doces artesanais feitos à mão, com amor e precisão."
- CTA: "Escolher minha experiência"

### Pg2
- Texto condensado em parágrafo único
- Citação em itálico destacada
- Sem alteração na estrutura ou no JS

### Como os textos chegam ao cardápio
1. theme.json local (Static Asset) → fallback
2. D1 PUBLISHED (slot) → prevalece sobre o HTML
3. Para atualizar: Central → Edição Visual → Salvar → Publicar

## Catálogo — estado aprovado
- Paleta Verde Sálvia médio (#6B9E7A, #F4F8F4)
- Layout editorial, Pg1 unificada, float-bar 3 botões, lightbox

## Pontos de retorno seguros
- HEAD atual = 7d8f120 (aprovado)
- Tag = v12C-pre-4 = 9c011b3 (anterior)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

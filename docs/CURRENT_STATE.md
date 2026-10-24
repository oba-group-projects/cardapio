# CURRENT STATE

Atualizado: 2026-10-22 (sessão 23)

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 2884048
Sincronizado com origin: sim (HEAD == origin/feature/gestao-online-segura)
Working tree: limpo (nenhuma alteração pendente)

## Versão publicada
Commit: 2884048
Cloudflare Version ID: 9e8074d1-a0d2-4746-882c-3f4bcfe01d81
Deploy: OK (sessão 23 — 2026-10-22)

## Estado funcional
- Central privada autenticada e operacional ✅
- Fluxo DRAFT → PREVIEW → PUBLISHED funcional ✅
- Cardápio público funcional em /cardapio ✅
- Catálogo público funcional em /catalogo ✅
- Módulo de Contratos completo e em uso real ✅

## Cardápio — estado atual (sessão 23)

### Pg1 — Redesenho + Editor de capa simplificado
- Título: "Cardápio Oba Doceria" — Cormorant Garamond, weight 400, uppercase
- Parágrafo e CTA revisados (sessão 22)
- Checkboxes: Exibir assinatura / Exibir rótulo (opt-in)
- **Editor de capa (sessão 23):**
  - Controles de foco H/V, zoom e altura diretamente abaixo de cada prévia completa
  - Prévias celular e desktop usam `object-fit:cover + object-position + scale()` — idêntico ao publicado
  - Drag nas prévias completas (celular e desktop independentes)
  - Miniaturas de recorte separadas removidas

### Pg3
- Labels .oba-btn-label: 15px/500, subtítulo 13px, ícones 1.5rem/.35

### Fluxo
- Categorias: grid 3 colunas

## Módulo de Contratos — estado atual (sessão 11)
- Fluxo completo validado: Proposta aceita → Editor → Snapshot → Link → Aceite eletrônico
- Verificação dupla: WhatsApp OU CPF/CNPJ
- Snapshot imutável: HTML + SHA-256
- Pós-aceite: botão PDF + link permanente

## Catálogo — estado atual (sessão 12)
- Paleta Verde Sálvia (#6B9E7A, #F4F8F4)
- Ed. Visual completo: Pg1/Pg2/Pg3/4 + Tema Global
- Schema v4: `pg2.grupos_ordem[]` dinâmico

## Pendências conhecidas

### Foco vertical da capa (não será retomado nesta fase)
- O slider de foco vertical da capa não produz deslocamento visível em fotos 4:3 com zoom=1.0
- Causa: limitação geométrica de `object-fit:cover` em contêiner landscape — sem excedente Y
- O comportamento é **idêntico ao cardápio publicado** (não é bug do editor)
- Com zoom ≥ 1.2 o foco vertical funciona normalmente
- Decisão: documentado, não será retomado nesta fase

### Outras pendências
- Validação no smartphone real (comportamento visual da Pg1 redesenhada)
- Borda botão Voltar no Catálogo (uma linha de CSS)
- Editor Visual do Catálogo — P1+P2 (aprovado para implementação futura)

## REGRAS TÉCNICAS CRÍTICAS
1. Nunca usar Set-Content/Out-File do PowerShell — adiciona BOM
2. theme.json = cardápio. theme-catalogo.json = catálogo. NUNCA misturar.
3. cpf_cnpj está em contracts, NÃO em proposals
4. valor_total calculado pelo Worker via obaCalcularValorContrato() — não recalcular no frontend
5. Rota /contrato/:token fica ANTES de validateSession — é pública por design
6. Status permitidos em contracts: rascunho, enviado, aceito, recusado, cancelado
7. scenario_aceito_id em proposals — gravado no PATCH de status quando = aceita
8. obaGetCatalogPrecos retorna { catPM, saborPM, catNomes }
9. obaGerarContratoHTML recebe 6 parâmetros
10. Itens com incluido=1 não somam no total
11. Assets públicos (bootstraps) devem ter rota explícita ANTES de validateSession

## Pontos de retorno seguros
- HEAD atual = 2884048 (estável, deploy validado — sessão 23)
- Anterior = 9bfb0ce (fix recorte prévias)
- Anterior = c7dc3ef (handoff sessão 22)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

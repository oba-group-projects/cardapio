# CURRENT STATE

Atualizado: 2026-10-20 (sessão 22)

## Git
Branch: feature/gestao-online-segura
Commit HEAD: e3232ed

## Estado funcional
- Central privada autenticada e operacional
- Fluxo DRAFT → PREVIEW → PUBLISHED funcional
- Cardápio público funcional em /cardapio — Pg1 redesenhada (sessão 22)
- Catálogo público funcional em /catalogo — Verde Sálvia + Ed. Visual Etapa A
- Módulo de Contratos completo e em uso real
- Bug crítico resolvido (sessão 21): Catálogo e Cardápio funcionam para usuários anônimos em smartphones

## Cardápio — estado atual (sessão 22)

### Pg1 — Redesenho completo
- Título: "Cardápio Oba Doceria" — Cormorant Garamond, weight 400, uppercase (classe Tailwind)
- Parágrafo: "Brigadeiros gourmet artesanais, com cremosidade envolvente, sabores marcantes e doçura equilibrada — um acabamento que encanta antes mesmo da primeira mordida."
- CTA: "DESCUBRA NOSSOS SABORES"
- Tipografia: clamp(1.7rem,5.5vw,2rem) mobile · clamp(2.0rem,2.8vw,2.4rem) desktop com foto · weight:400
- Gap tablet 768–1023px com foto: corrigido (CTA position:static + margin-top:clamp)
- Checkboxes no editor: "Exibir assinatura abaixo do botão" e "Exibir rótulo da página" (ambos opt-in)
- Assinatura e rótulo ocultos por padrão, controláveis via editor

### Editor de imagem de capa
- Arraste X e Y funcionando nos dois recortes (celular e desktop)
- Zoom 1×–3× com aviso acima de 2×
- Enquadramento independente celular/desktop
- Controles inline abaixo de cada recorte (layout sem abas)
- Prévia completa usa object-position + scale() — mesma lógica do cardápio publicado
- Recortes (thumbnails) usam position:absolute + FATOR=1.5 — leve divergência visual em posições não-centrais (não afeta dados salvos nem cardápio publicado)

### Pg3
- Labels .oba-btn-label: 15px/500, subtítulo 13px, ícones 1.5rem/.35
### Fluxo
- Categorias: grid 3 colunas

## Módulo de Contratos — estado atual (sessão 11)

### Fluxo completo validado em produção:
1. Proposta aceita → botão 📄 Contrato
2. Editor: nome completo, CPF/CNPJ, condições de pagamento, campos opcionais
3. Resumo financeiro calculado no Worker com preços reais
4. Modal de confirmação → "Confirmar envio" → snapshot imutável + token
5. Pós-envio: caixa verde com link + botão 📱 Enviar pelo WhatsApp (mensagem personalizada)
6. Página pública /contrato/:token — verificação WhatsApp OU CPF
7. Aceite registra IP, data/hora, hash
8. Pós-aceite: botão "Salvar como PDF" + link permanente copiável

### Migrations aplicadas em produção:
- 0016–0020: contracts, contract_aceites, campos extras, status cancelado, scenario_aceito_id, incluido

## Catálogo — estado atual (sessão 12)
- Paleta Verde Sálvia (#6B9E7A, #F4F8F4)
- Ed. Visual completo: Pg1/Pg2/Pg3/4 + Tema Global
- Schema v4: `pg2.grupos_ordem[]` dinâmico
- Editor de grupos: ↑↓, 👁/🚫, ⧉, ✕, validações
- `catMontarPg3` e `catAbrirGrupo` sem hardcode — suportam N grupos

## Pendente — próximas sessões

### Cardápio
- Validação no smartphone real (comportamento visual da Pg1 redesenhada)
- Divergência residual nos thumbnails de recorte (não crítico — prévia completa é fiel)
- Borda botão Voltar no Catálogo (uma linha de CSS)

### Contratos (fase 2 — itens restantes)
- Aditivos, templates de cláusulas, integração Autentique

### Editor Visual do Catálogo (aprovado para implementação)
- P1: editar textos existentes, mostrar/ocultar, reordenar botões e seções
- P2: criar/duplicar/excluir botões com destinos válidos
- P3 (fase futura): criar/remover seções

### Outras melhorias
- Catálogo: "Encontre o seu favorito" (Pg sabores)
- Hardening: substituir querySelector frágil por getElementById

## REGRAS TÉCNICAS CRÍTICAS
1. Nunca usar Set-Content/Out-File do PowerShell — adiciona BOM
2. theme.json = cardápio. theme-catalogo.json = catálogo. NUNCA misturar.
3. cpf_cnpj está em contracts, NÃO em proposals
4. valor_total calculado pelo Worker via obaCalcularValorContrato() — não recalcular no frontend
5. Rota /contrato/:token fica ANTES de validateSession — é pública por design
6. Status permitidos em contracts: rascunho, enviado, aceito, recusado, cancelado
7. scenario_aceito_id em proposals — gravado no PATCH de status quando = aceita
8. obaGetCatalogPrecos retorna { catPM, saborPM, catNomes }
9. obaGerarContratoHTML recebe 6 parâmetros: contract, proposal, scenario, catPM, saborPM, catNomes
10. Itens com incluido=1 não somam no total (obaContractCenarioTotal e recalcularCenario)
11. Assets públicos (bootstraps) devem ter rota explícita ANTES de validateSession

## Pontos de retorno seguros
- HEAD atual = e3232ed (estável, deploy validado — sessão 22)
- Anterior = e2c9028 (fix arraste X/Y recortes)
- Anterior = 5c408ce (redesenho Pg1 + checkboxes + gap tablet)
- Anterior = 12b1a5e (sessão 21 — fix bootstrap público)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

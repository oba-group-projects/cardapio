# CURRENT STATE

Atualizado: 2026-10-09 (sessão 12)

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 777a0d2

## Estado funcional
- Central privada autenticada e operacional
- Fluxo DRAFT → PREVIEW → PUBLISHED funcional
- Cardápio público funcional em /cardapio — Pg1 Interpretação B + refinamentos
- Catálogo público funcional em /catalogo — Verde Sálvia + Ed. Visual Etapa A
- Módulo de Contratos completo e em uso real

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

### Tabela de produtos no contrato:
- Categorias __total__: exibe nome da categoria + qtd + preço referência
- Sabores específicos: suprimidos quando categoria tem __total__ (aparecem na proposta)
- Itens livres: descrição + qtd + preço
- Flag incluido: valor riscado + "Incluído" (não entra no total)
- Nota de desconto descritiva abaixo da tabela (tipo + valor + percentual)
- Nota vinculando sabores à proposta comercial
- Referência da proposta no cabeçalho (cliente · tipo · data)

### PDF e link permanente:
- Botão "Salvar como PDF" via window.print() com CSS @media print
- Link permanente copiável (Clipboard API com fallback)
- Funciona em ambos os cenários: pós-aceite e contrato já aceito

### Migrations aplicadas em produção:
- 0016: tabelas contracts + contract_aceites
- 0017: campos nome_completo, horario_entrega, responsavel_recebimento
- 0018: status cancelado no CHECK constraint
- 0019: scenario_aceito_id na tabela proposals
- ALTER manual: valor_total REAL em contracts
- 0020: incluido INTEGER DEFAULT 0 em proposal_items

### Itens livres na Central:
- Campo: "Nome do produto ou serviço (ex: Montagem da mesa)"
- Checkbox "incluído" com tooltip — não entra no subtotal quando marcado
- Preservado na cópia de cenário

## Cardápio — estado atual
### Pg1 — Interpretação B
- Título/subtítulo originais: ocultos. Título "Nossa Essência": Cormorant Garamond 3rem/500
- 2 parágrafos (D1) + citação + CTA
### Pg3
- Labels .oba-btn-label: 15px/500, subtítulo 13px, ícones 1.5rem/.35
### Fluxo
- Categorias: grid 3 colunas

## Catálogo — estado atual (sessão 12)
- Paleta Verde Sálvia (#6B9E7A, #F4F8F4)
- Ed. Visual completo: Pg1/Pg2/Pg3/4 + Tema Global
- **Schema v4**: `pg2.grupos_ordem[]` dinâmico — `[{ id, label, sublabel, icone, destaque, visivel }]`
- Editor de grupos na Central: ↑↓, 👁/🚫, ⧉, ✕, validações
- `catMontarPg3` e `catAbrirGrupo` sem hardcode — suportam N grupos
- Ed. Visual Pg3/4 profissional: ativo/inativo, corSubtitulo, corFundo, tipografia granular

## Pendente — próximas sessões

### Contratos (fase 2 — não urgente)
- Revisão jurídica das cláusulas antes de uso em produção real (externo — não é código)
- Aditivos
- Templates de cláusulas editáveis na Central
- Integração Autentique (sandbox primeiro)

### Editor Visual do Catálogo (aprovado para implementação)
- P1: editar textos existentes, mostrar/ocultar, reordenar botões e seções
- P2: criar/duplicar/excluir botões com destinos válidos
- P3 (fase futura): criar/remover seções — requer decisão de produto

### Outras melhorias visuais
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

## Pontos de retorno seguros
- HEAD atual = 777a0d2 (estável, deploy validado)
- Anterior = 7fee08e

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

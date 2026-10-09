# HANDOFF

Atualizado: 2026-10-09 (sessão 11)

Branch: feature/gestao-online-segura
HEAD: babaeb4

## Última entrega
Módulo de Contratos refinado e em uso real — tabela de produtos profissional, flag incluido,
pós-envio com botão WhatsApp personalizado, PDF + link permanente pós-aceite.

## Commits desta sessão
| Commit   | O que fez |
|----------|-----------|
| babaeb4  | feat(contratos): pós-envio — scroll para link-box, botão WhatsApp com mensagem personalizada |
| 652ad8f  | feat(contratos): tabela limpa — categorias em destaque, sabores suprimidos, nota desconto, ref proposta |
| 5f1bb1b  | feat(contratos): tabela produtos completa — 3 tipos de item, flag incluido, label corrigida |
| 2ec19fc  | fix(contratos): link permanente visível em ambos os cenários — script global fora do ternário |
| 79d18d7  | feat(contratos): PDF + link permanente pós-aceite — botão Salvar PDF, link copiável, CSS print |

## Estado atual — TUDO APROVADO E EM PRODUÇÃO

### Módulo de Contratos — completo
**Fluxo end-to-end funcional:**
1. Proposta aceita → botão 📄 Contrato aparece
2. Editor: nome completo, CPF/CNPJ (com máscara), condições de pagamento (select + livre)
3. Resumo financeiro calculado no Worker com preços reais do catálogo
4. Modal confirmação → "Confirmar envio" → snapshot imutável (HTML + SHA-256) + token público
5. Pós-envio: caixa verde aparece com scroll automático → link copiável + botão 📱 WhatsApp
6. Mensagem WhatsApp personalizada: nome, tipo evento, data, nº contrato, link
7. Página pública /contrato/:token — verificação dupla: WhatsApp OU CPF/CNPJ
8. Aceite registra IP, data/hora, hash, método de verificação
9. Pós-aceite: botão "📄 Salvar como PDF" (window.print()) + link permanente copiável
10. Contrato já aceito: mesmos botões visíveis acima do iframe

**Tabela de produtos:**
- Categorias __total__: nome da categoria + qtd + preço referência (sem listar sabores)
- Sabores individuais: suprimidos quando categoria tem __total__ (aparecem na proposta)
- Itens livres: descrição + qtd + preço
- Flag incluido: exibe valor de tabela riscado + "Incluído", não soma no total
- Nota descritiva do desconto (tipo + percentual + valor)
- Nota vinculando sabores à proposta comercial
- Referência da proposta no cabeçalho (cliente · tipo · data)

**Migrations aplicadas em produção:**
- 0016–0019: tabelas contracts, contract_aceites, campos, status, scenario_aceito_id
- ALTER manual: valor_total REAL em contracts
- 0020: incluido INTEGER DEFAULT 0 em proposal_items

**Central — itens livres:**
- Placeholder: "Nome do produto ou serviço (ex: Montagem da mesa)"
- Checkbox "incluído" — não entra no subtotal, exibe "Incluído" na proposta pública e no contrato

### Cardápio e Catálogo — intactos
Sem alterações nesta sessão.

## Pendente — próximas sessões

### Contratos (fase 2)
- Revisão jurídica das cláusulas (externo — não é código)
  - Cancelamento: retenção 100% com <15 dias pode ser contestada pelo CDC
  - Condições financeiras: falta valor do sinal, vencimentos, forma de pagamento
  - Aceite eletrônico no snapshot: hoje grava "Aguardando aceite" — corrigir status pós-aceite
- Aditivos
- Templates de cláusulas editáveis na Central
- Integração Autentique (sandbox primeiro)

### Editor Visual do Catálogo (aprovado, aguarda implementação)
- P1: editar textos, mostrar/ocultar, reordenar
- P2: criar/duplicar/excluir botões com destinos válidos
- P3 (fase futura): criar/remover seções

## REGRAS TÉCNICAS CRÍTICAS
1. Nunca usar Set-Content/Out-File do PowerShell — adiciona BOM
2. theme.json = cardápio. theme-catalogo.json = catálogo. NUNCA misturar.
3. cpf_cnpj está em contracts, NÃO em proposals
4. valor_total calculado pelo Worker via obaCalcularValorContrato() — não recalcular no frontend
5. Rota /contrato/:token fica ANTES de validateSession — é pública por design
6. Status permitidos em contracts: rascunho, enviado, aceito, recusado, cancelado
7. scenario_aceito_id em proposals — gravado no PATCH de status quando = aceita
8. obaGetCatalogPrecos retorna { catPM, saborPM, catNomes }
9. obaGerarContratoHTML: 6 parâmetros (contract, proposal, scenario, catPM, saborPM, catNomes)
10. Itens com incluido=1 não somam no total — obaContractCenarioTotal e recalcularCenario

## Pontos de retorno seguros
- HEAD atual = babaeb4 (estável, deploy validado)
- Anterior = 652ad8f

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

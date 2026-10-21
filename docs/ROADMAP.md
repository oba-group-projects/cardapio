# ROADMAP

Atualizado: 2026-10-20 (sessão 22)

## Concluído

### Infraestrutura
- Cardápio público funcional (GitHub Pages + Worker)
- Central de Gestão privada com autenticação no Worker
- D1, modelo de revisões e slots (DRAFT/PREVIEW/PUBLISHED)
- Pipeline DRAFT → PREVIEW → PUBLISHED + Rollback + Histórico
- Pipeline de Mídia Online (Upload, D1, cache imutável, zero custo)
- Homologação Geral e Encerramento da Migração

### Cardápio
- Pg1 redesenhada (sessão 22): novo texto, tipografia calibrada, checkboxes de visibilidade
- Editor de imagem de capa: arraste X/Y, zoom 3×, enquadramento independente celular/desktop
- Pg3 refinamento visual (labels, ícones, subtítulo)
- Fluxo de montagem (grid 3 colunas, resumo caixa)
- Editor Visual completo: Pg1/Pg2/Pg3 + Tema Global

### Catálogo
- Paleta Verde Sálvia (#6B9E7A, #F4F8F4)
- Layout editorial, Pg1 unificada, float-bar, lightbox
- Editor Visual Etapa A: Pg1/Pg3 cores + logo + tipografia
- Editor Visual Pg3/4 profissional: ativo/inativo, corSubtítulo, corFundo, tipografia granular

### Módulo de Contratos (MVP completo — sessões 9–11)
- Fluxo Proposta aceita → Editor → Snapshot → Link → Aceite eletrônico
- Verificação dupla: WhatsApp OU CPF/CNPJ
- Tabela de produtos profissional: categorias, sabores suprimidos, itens livres, flag incluido
- Nota descritiva do desconto e referência à proposta
- Pós-envio: scroll automático + botão WhatsApp com mensagem personalizada
- Pós-aceite: botão PDF + link permanente copiável
- Cancelar/excluir contratos
- Avisos: data passada, cenário sem produtos, campos obrigatórios

### Contratos — Fase 2 parcial (sessões 15–16)
- Condições financeiras estruturadas: sinal, vencimentos, forma de pagamento
- Snapshot pós-aceite com dados do aceite incorporados
- Cláusulas jurídicas v2: direito de arrependimento (CDC art. 49), 70% para <15 dias, cláusula de alterações de pedido, recebimento por qualquer meio comprobatório
- Migration 0022 (clausula_alteracoes)

## Próximo passo recomendado

**Editor Visual do Catálogo — P1+P2**
- Editar textos existentes, mostrar/ocultar, reordenar
- Criar/duplicar/excluir botões com destinos válidos
- Baseado nos mecanismos do Editor do Cardápio (reaproveitamento ~70%)
- Aguarda início de implementação

## Planejado

### Contratos — Fase 2 (itens restantes)
- Aditivos
- Templates de cláusulas editáveis na Central
- Integração Autentique (sandbox primeiro)
- ~~Revisão jurídica das cláusulas~~ ✅
- ~~Condições financeiras~~ ✅
- ~~Status no snapshot pós-aceite~~ ✅

### Editor Visual do Catálogo — P3 (fase futura)
- Criar/remover seções (requer decisão de produto)
- Somente após necessidade demonstrada com uso real

### Melhorias visuais
- Catálogo: "Encontre o seu favorito" (Pg sabores)
- Hardening: substituir querySelector frágil por getElementById

### Não planejado / fora de escopo atual
- E-mail automático pós-aceite (requer serviço pago: Resend, Sendgrid)
- Assinatura digital com certificado (fase 2 Autentique)
- Construtor de sites / criação dinâmica de grupos no catálogo

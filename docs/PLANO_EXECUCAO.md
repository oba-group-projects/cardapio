# Plano de Execução — Oba Doceria Digital
*Atualizado: 08/10/2026 — Sessão 10*

---

## Estado atual do sistema

### Publicado e funcional

| Ambiente | URL | Estado |
|---|---|---|
| Central de Gestão | https://oba-cardapio-gestao.obadoceria.workers.dev/ | ✅ Ativo |
| Cardápio público | https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio | ✅ Ativo |
| Catálogo público | https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo | ✅ Ativo |
| GitHub (código) | https://github.com/oba-group-projects/cardapio | ✅ Ativo |

Branch de trabalho: `feature/gestao-online-segura`

### Módulos da Central

| Módulo | Estado |
|---|---|
| Sabores, Categorias, Caixas, Produtos, Opcionais, Combos | ✅ Funcional |
| Loja (WhatsApp, pagamentos, visibilidade de preços) | ✅ Funcional |
| Ed. Visual Cardápio (Pg1/Pg2/Pg3 + Tema Global) | ✅ Funcional |
| Ed. Visual Catálogo (Pg1/Pg2/Pg3-4 + Tema Global) | ✅ Funcional |
| Mídia (galeria de imagens) | ✅ Funcional |
| Propostas (Evento / Corporativo / Sazonal) | ✅ Funcional |
| Contratos (MVP — Evento) | ✅ Funcional |

### Contratos — estado do MVP

- Fluxo: Proposta aceita → Criar contrato → Rascunho → Gerar link → Aceite eletrônico
- Verificação: WhatsApp OU CPF/CNPJ
- Snapshot imutável: HTML + SHA-256 ao enviar
- `valor_total` calculado pelo Worker com preços reais do catálogo
- Status: `rascunho` → `enviado` → `aceito` / `recusado` / `cancelado`
- Aceite registra: IP, data/hora, hash, método de verificação

### Migrations D1 aplicadas em produção

| # | O que fez |
|---|---|
| 0001–0010 | Catálogo base: estados, mídia, caixas, categorias |
| 0011–0015 | Propostas corporativas/sazonais: options, faixas, mídias |
| 0016 | Contratos: tabelas `contracts` + `contract_aceites` |
| 0017 | Contratos: campos `nome_completo`, `horario_entrega`, `responsavel_recebimento` |
| 0018 | Contratos: status `cancelado` no CHECK constraint |
| 0019 | Propostas: campo `scenario_aceito_id` |
| ALTER manual | Contratos: coluna `valor_total REAL` |

---

## Arquitetura atual

```
Central de Gestão (privada, autenticada)
        │
        ├── DRAFT → PREVIEW → PUBLISHED
        │
        ├── Dados: Cloudflare D1 (SQLite)
        ├── Assets: Cloudflare Static Assets
        └── Worker: Cloudflare Workers
                │
                ├── /cardapio  → cardápio público
                ├── /catalogo  → catálogo público
                ├── /proposta/:id → proposta pública
                └── /contrato/:token → contrato público (aceite)
```

**Fonte canônica de código:** GitHub (`feature/gestao-online-segura`)
**Fonte canônica de dados:** Cloudflare D1 slot PUBLISHED

---

## O que está congelado — não alterar sem decisão explícita

### Cardápio público
- Motor de compra (fluxo caixas, sabores, carrinho, checkout)
- Integração WhatsApp do pedido
- IDs de elementos HTML (`#pag-1`, `#pag-2`, `#pag-3`, `#oba-menu-botoes`, etc.)
- Botões estáticos de fallback no HTML
- `entFluxoCaixas()`, `entFluxoPresenteaveis()`, `abrirModalEspecial()`

### Catálogo público
- Estrutura das páginas (Pg1 editorial, Pg2 seleção de grupo, Pg3 seleção, Pg4 grade de sabores)
- Grupos de sabores derivados dos dados do D1
- Fluxo de descoberta (pg1 → pg2 → pg3 → pg4)
- Identidade visual Verde Sálvia (#6B9E7A, #F4F8F4)

### Contratos
- Contrato imutável após status `enviado`
- Snapshot como fonte de verdade do documento
- `valor_total` calculado pelo Worker via `obaCalcularValorContrato()`
- Rota `/contrato/:token` pública (antes de `validateSession`)

### Pipeline de publicação
- Fluxo DRAFT → PREVIEW → PUBLISHED obrigatório
- GitHub como fonte canônica — push antes de deploy

---

## Próximos passos

### Agora
1. ~~Atualizar documentação~~ ← você está aqui
2. Dois textos do catálogo via Central (sem código):
   - Pg1: segundo parágrafo → "Explore nossos sabores, descubra seus favoritos e deixe-se levar pela experiência Oba."
   - Pg2: subtítulo "Escolha o tipo de doce" → "Encontre o seu favorito"
3. Validação visual do catálogo após os textos

### Em seguida
4. Ed. Visual Catálogo — Camada 1:
   - Pg2 ativo/inativo
   - Grupos (Artesanais/Finos) ocultar/mostrar
   - Validação: impedir Pg2 sem grupo ativo
5. Contratos — cláusula de alterações da contratação
6. Teste completo do fluxo de contrato com proposta real (não de teste)

### Futuro — só com necessidade demonstrada
- Seções extras no catálogo
- Grupos dinâmicos no catálogo
- Integração Autentique (sandbox primeiro)
- Contratos Corporativo e Sazonal
- Aditivos de contrato
- Fotografias de produtos

---

## Regras de execução

1. Um assunto por commit — nunca misturar documentação + feature + fix no mesmo commit
2. Checkpoint Git antes de qualquer mudança crítica
3. Não alterar motor do cardápio sem decisão explícita
4. Não buscar paridade entre Ed. Visual Cardápio e Ed. Visual Catálogo
5. Não implementar no Catálogo o que não tem caso de uso real demonstrado
6. DRAFT → PREVIEW → PUBLISHED sempre
7. Nunca versionar secrets, tokens ou `.dev.vars`

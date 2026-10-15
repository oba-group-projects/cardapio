# HANDOFF

Atualizado: 2026-10-15 (sessão 21)

Branch: feature/gestao-online-segura
HEAD: 12b1a5e

## Última entrega
Diagnóstico definitivo e correção da causa raiz do bug no Catálogo/Cardápio em smartphones. O problema não era CSP (como diagnosticado na sessão anterior) — era o `/published-bootstrap.js` retornando HTTP 303 para usuários anônimos porque o script caía no catch-all do Worker, que está atrás do gate de autenticação. Correção mínima aplicada, testada e deployada.

## Commits desta sessão
| Commit   | O que fez |
|----------|-----------|
| 12b1a5e  | fix(gate): CATALOGO-gate-headers.ps1 reescrito sem caracteres especiais |
| b609189  | fix(worker): published-bootstrap.js exposto como rota pública — causa raiz corrigida |
| e1117ae  | fix(catalogo): CSP na rota /catalogo (sessão anterior — não era a causa raiz) |

## Estado atual — TUDO APROVADO E EM PRODUÇÃO

### Bug crítico resolvido — sessão 21

**Causa raiz comprovada:**
- `/published-bootstrap.js` caia no catch-all `env.ASSETS.fetch(request)`, que está **após** o gate de autenticação (`validateSession`)
- Usuários anônimos (smartphones sem sessão ativa) recebiam HTTP 303 → redirect para login
- O bootstrap nunca executava → `window.fetch` não era interceptado → `catIniciar()` falhava com erro de rede
- O mesmo problema afetava `/cardapio` para usuários anônimos (mesma causa, mesma correção)

**Evidência concreta:**
```
GET /published-bootstrap.js  →  HTTP 303 (antes do fix)
GET /published-bootstrap.js  →  HTTP 200 conteúdo válido (após fix)
```

**Correção aplicada (Worker src/index.js):**
- Adicionada rota pública explícita para `/published-bootstrap.js`, `/preview-bootstrap.js` e `/cardapio-bootstrap.js`
- Inserida **antes** de `validateSession()`, junto com `/api/catalog` e `/api/media/`
- Headers corretos: `Content-Type`, `Cache-Control: public, max-age=60, stale-while-revalidate=300`, `X-Content-Type-Options: nosniff`

**Por que o desktop funcionava:**
- Usuário do desktop tinha sessão ativa (usava a Central) → passava pelo gate → bootstrap era servido normalmente

**Testes (9/9 passaram):**
- T1: /catalogo HTTP 200 ✓
- T2: /catalogo CSP presente ✓
- T3: CSP connect-src correto ✓
- T4: /cardapio HTTP 200 ✓
- T5: /api/catalog ok:true ✓
- T6: bootstrap injetado no HTML ✓
- T7: grupos_ordem e imagem presentes ✓
- T8: **/published-bootstrap.js HTTP 200 sem auth** ✓ ← prova a correção
- T9: /cardapio bootstrap presente ✓

**Version ID atual:** `89d2f393-cbbf-4cf8-bd0c-a5a7e81bd49f`

### Trabalho das sessões anteriores (preservado)
Ver HANDOFF sessão 20 para:
- Catálogo Pg2 redesenhada (composição, botões, centralização)
- Pg1 proporção tablet, imagem de fundo por grupo
- Destaque fotográfico Pg1 completo
- Editor Visual do Catálogo completo (sessões 12–14)
- Módulo de Contratos (sessões 9–11, 15–16)

## REGRAS TÉCNICAS CRÍTICAS
1. Nunca usar Set-Content/Out-File do PowerShell — adiciona BOM
2. theme.json = cardápio. theme-catalogo.json = catálogo. NUNCA misturar.
3. theme-catalogo.json é schemaVersion 4 — `pg2.grupos_ordem[]` é o campo canônico
4. Ao ler grupos: checar `pg2.grupos_ordem` primeiro, fallback para campos legados
5. `grupos{}` = configurações de Pg4 (cores, tipografia). NÃO confundir com `pg2.grupos_ordem[]`
6. catAbrirGrupo recebe qualquer string como `grupo` — não assume artesanais/finos
7. Modal `cat-modal-nova-categoria`: `_cardOrigem` e `_modoNovoGrupo` são propriedades dinâmicas no elemento DOM
8. `catEdPopularSelectGrupo(card, valorAtual)` deve ser chamado após qualquer operação que muda o ID do grupo
9. cpf_cnpj está em contracts, NÃO em proposals
10. Rota /contrato/:token fica ANTES de validateSession — é pública por design
11. **Assets públicos (bootstraps) devem ter rota explícita ANTES de validateSession — não confiar no catch-all**

## Pendente — próximas sessões

### Validação no smartphone real
- O fix resolve a causa raiz comprovada automaticamente
- Validação final no aparelho real ainda é recomendada para confirmar o comportamento visual

### Catálogo — imagem de fundo nos botões Pg2
- Funcionalidade implementada e funcionando (opacidade 15%)
- Imagens atuais são capturas de tela — trocar por fotos dos doces na Central quando disponíveis

### Catálogo — Borda do botão Voltar
- Confirmada nos prints — regra `.oba-btn-voltar-dest` ainda aplica borda
- Uma linha de CSS para remover quando decidido

### Contratos — fase 2 (itens restantes)
- Aditivos, templates de cláusulas, integração Autentique

## Pontos de retorno seguros
- HEAD atual = 12b1a5e (estável, deploy validado — sessão 21)
- Anterior = b609189 (fix causa raiz)
- Anterior = e1117ae (fix CSP — não era a causa raiz, mas não faz mal)

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- Catálogo: https://oba-cardapio-gestao.obadoceria.workers.dev/catalogo
- GitHub: https://github.com/oba-group-projects/cardapio

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

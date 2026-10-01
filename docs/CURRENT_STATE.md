# CURRENT STATE

Atualizado: 2026-09-30

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 5fbff2a
Tag de marco: v12C-pre (a criar)
Branch main: atualizado via sync automático da Central

## Estado funcional
- Central privada autenticada e operacional (senha Oba2026!, sem campo Nome)
- Fluxo DRAFT → PREVIEW → PUBLISHED com rollback e histórico
- Cardápio público funcional
- Módulo de Propostas completo: Evento (12A) + Corporativo e Sazonal (12B + rev1–rev7)
- Melhorias de UX na Central (esta sessão)

## Fases concluídas
- **12A completa:** proposals, scenarios, items, página pública /proposta/:id
- **12B completa:** proposal_options, faixas De-Até, mídia por opção, briefing corporativo
- **12B-rev1 a rev7:** ajustes visuais, textos aprovados, layout sazonal

## Melhorias desta sessão (pós-12B)

### Autenticação
- Senha simplificada: `Oba2026!` (sem campo Nome, sem distinção de usuário)
- `minlength` removido do campo senha
- Secret `AUTH_PASSWORD` atualizado no Worker

### Ordenação nas tabelas da Central
- Clicar no cabeçalho de qualquer coluna ordena A→Z / Z→A (seta indicadora)
- Ordenação padrão ao carregar: Nome A→Z em todas as abas
- Dropdowns de Categoria ordenados por grupo + número romano (Clássicos I, II → Especiais I, II, III → Tradicionais I, II)

### Cards de resumo (topo da Central)
- Número grande = itens **ativos**
- "de X" discreto abaixo = total (só aparece se houver inativos)

### Toggle ativo/pausado — Edição Visual
- Cada página/módulo fixo tem checkbox "Página ativa no cardápio"
  (Boas-vindas, Nossa Essência, Menu Principal, Vitrine, Modal Personalizados, Modal Eventos)
- Seções Extras têm checkbox "Seção ativa" individual
- Páginas inativas são ocultadas no cardápio público; conteúdo preservado na Central
- Navegação redirecionada automaticamente quando pag-1 ou pag-2 são desativadas

## Próxima fase — 12C (pendente)
Catálogo de Festas — vitrine pública `/festas` no Worker.
Iniciar somente após homologação completa em produção.

## Pontos de retorno seguros
- Tag `v12B-baseline` = commit `ded3c58` — antes do redesign 12B
- Tag `v12C-pre` = commit `5fbff2a` — estado atual, pré-fase 12C

## Links
- Central: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Cardápio: https://oba-cardapio-gestao.obadoceria.workers.dev/cardapio
- GitHub: https://github.com/oba-group-projects/cardapio

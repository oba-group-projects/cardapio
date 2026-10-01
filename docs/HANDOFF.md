# HANDOFF

Atualizado: 2026-10-01

Branch: feature/gestao-online-segura
HEAD: c527348
Tag estável anterior: v12C-pre (2477185)
Tag de marco atual: v12C-pre-2 (c527348)

## Última fase entregue
Melhorias de UX sessão 01/10 — duplicação, toggle visibilidade, "Ver mais" compacto, overflow consistente

## Commits recentes relevantes
| Commit   | O que fez |
|----------|-----------|
| c527348  | fix: páginas overflow herdam logo/subtítulo da pag-3; limpa className duplicado |
| 02a5ec5  | fix: botão automático de seção sem label/título não aparece no menu |
| 08329fa  | feat: botão Ver mais compacto; toggle visibilidade no header do card de botão |
| d6c90f9  | feat: duplicar botão do menu e seção extra na Edição Visual |

## O que está funcionando (c527348)
- **Duplicar botão do menu:** ⧉ no header de cada card de botão; cópia inserida logo após o original com todos os campos copiados
- **Duplicar Seção Extra:** ⧉ no header; cópia nasce pausada (`ativo:false`, `linkMenu.ativo:false`, título "Cópia de X")
- **Toggle visibilidade 👁/🚫:** ícone no header do card sincronizado com checkbox "Visível no cardápio"; funciona nos dois sentidos
- **"Ver mais" compacto:** linha fina e discreta; não ocupa espaço de botão normal; evita corte do logo/título da Pág 3
- **Overflow consistente:** páginas 3b, 3c... herdam logo (tamanho configurado) e subtítulo da Pág 3
- **Fix:** seção sem label e título não gera botão no menu (não usa mais o ID como fallback)

## Comportamento de duplicação
- **Botão do menu:** cópia com mesmos dados, `visivel:true` — nasce visível, igual ao original
- **Seção Extra:** cópia com `ativo:false` e `linkMenu.ativo:false` — nasce pausada, deve ser editada antes de ativar

## Arquivos críticos
- `online/gestao/src/index.js` — Worker (autenticação, rotas, CSRF)
- `online/gestao/public/index.html` — Central de Gestão
- `online/gestao/public/ui-desenvolvimento/index.html` — Cardápio público
- `online/gestao/migrations/` — D1 migrations (0001 a 0015)

## Próxima implementação — Fase 12C
Catálogo de Festas — vitrine pública `/festas`:
- Rota pública sem autenticação
- Exibe categorias + doces finos para eventos
- Sem fluxo de pedido — CTA único WhatsApp
- **Pré-requisito:** homologar estado atual em produção

## Ponto de retorno seguro
Tag: `v12C-pre-2` = commit `c527348` — estado atual estável.

Leia AGENTS.md, CURRENT_STATE.md, DECISIONS.md antes de alterar código.

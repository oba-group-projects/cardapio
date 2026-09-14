# HANDOFF

Atualizado: 2026-09-14 00:00:00

Projeto: Oba Doceria - Cardapio Virtual + Central de Gestao.
Branch: feature/gestao-online-segura
Commit HEAD: 2ad4329

## Ultima fase aprovada
9C — Controles visuais por página na Central de Gestão.

## Histórico das fases desta sessão

| Commit   | Fase     | Resumo |
|----------|----------|--------|
| 1a2afd6  | 9A       | Infraestrutura theme.json + hidratarTemaDoModeloMestre |
| 79bf902  | 9B       | Aba Edição Visual na Central (formulários de texto) |
| 4b073c3  | 9B-fix   | Bug vtab + variantes visuais + tipografia + sliders |
| 2ad4329  | 9C       | Controles visuais por página (cores, tamanho logo, visibilidade) |

## Estado do sistema

### Central de Gestão — Aba Edição Visual
Dois sub-painéis:

**📄 Páginas** — 6 formulários colapsáveis:
- Página 1 (Boas-vindas): título, subtítulo, CTA, logo+tamanho, corFundo, corTítulo, toggles exibir
- Página 2 (Nossa Essência): título, texto, citação, logo+tamanho, corFundo, corTítulo, toggles exibir
- Página 3 (Menu Principal): subtítulo, logo+tamanho, corFundo, corSubtítulo, 4 toggles de botão, labels
- Vitrine de Presentes: título, subtítulo
- Modal Doces Personalizados: título, informações, pacotes
- Modal Eventos: título

**🎨 Tema Global** — afeta o cardápio inteiro:
- 6 variantes visuais com swatches (Clássica, Elegante, Moderna, Suave, Minimalista, Festiva)
- 5 color pickers com sincronização picker↔hex + botão Limpar
- Tipografia: 10 fontes, tamanho título (18–40px), tamanho corpo (11–18px), peso título, peso corpo
- Layout: arredondamento (0–40px), espaçamento (compacto/normal/espaçado)
- Preview ao vivo refletindo todas as configurações
- Botão "Restaurar padrão" (aplica variante Clássica Oba)

### theme.json (schemaVersion 3)
Localização: `online/gestao/public/data/catalog-v1/theme.json`
Campos na raiz: schemaVersion, updatedAt, variante
Campos em paginas.*: logo, tamanhoLogo, titulo/subtitulo/texto/citacao/etc,
  corFundo, corTitulo/corSubtitulo, toggles de visibilidade (exibirCTA etc),
  opcoes.*.visivel (pag3)
Campos em tema: 12 tokens (cores, fonte, tamanhoTitulo, tamanhoCorpo,
  pesoTitulo, pesoCorpo, arredondamento, espacamento)

### Fluxo de publicação
Igual ao fluxo original: edição na Central → salva no DRAFT → Preview → Publicar.
theme.json viaja dentro do payload do DRAFT automaticamente.
preview-bootstrap.js intercepta theme.json para o slot PREVIEW.

## Observação visual (menor)
Os color pickers da seção "Cores desta página" exibem o marrom da marca como
valor padrão do picker, mas o campo hex fica vazio (= usa tema global). Isso é
correto funcionalmente mas pode parecer inconsistente. Pode ser ajustado se o
usuário reportar confusão: basta mudar obaSetCorPagina() para deixar o picker
cinza quando vazio.

## Próximo passo recomendado
Homologar ao vivo + fase 9D (preview iframe de celular dentro da Central).

Leia AGENTS.md, docs/CURRENT_STATE.md, docs/DECISIONS.md e docs/ROADMAP.md antes de alterar codigo.

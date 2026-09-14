# CURRENT STATE

Atualizado: 2026-09-14 00:00:00

## Git
Branch: feature/gestao-online-segura
Commit HEAD: 79bf902

## Estado funcional
- Central privada autenticada e 100% isolada da exposição pública.
- D1 operacional com schemas 0001_catalog_states.sql e 0002_catalog_media.sql.
- GET/POST /api/draft homologados (Central carrega DRAFT, edições gravam DRAFT).
- GET/POST /api/preview homologados (DRAFT -> PREVIEW).
- /__preview privado autenticado com headers estritos de segurança (CSP, noindex).
- POST /api/publish homologado (promoção atômica PREVIEW -> PUBLISHED).
- POST /api/publish/rollback homologado (reversão segura de revisão).
- GET /api/publish/history homologado (listagem de revisões e status ativo).
- Interface de Histórico de Versões e Rollback homologada na Central.
- Upload e gestão de mídia online homologados com compressão Canvas e D1.
- Servimento público de imagens homologado com cache imutável e ETag.
- Slot PUBLISHED preservado e intacto (baseline pub_c3b7ee083866bb26a7a0b881).

## Fase 9A — Infraestrutura de Tema Visual (concluída 2026-09-14, commit 1a2afd6)
- catalog-v1/theme.json: textos de 6 páginas + 5 tokens de cor + fonte.
- Worker: "tema":"theme.json" em OBA_CATALOG_FILES + aliases tema/theme.
- preview-bootstrap.js: 'theme.json':'tema' no mapa de interceptação.
- index.html (cardápio): 31 IDs oba-*, hidratarTemaDoModeloMestre(), style#oba-tema-vars.

## Fase 9B — Aba de Edição Visual na Central (concluída 2026-09-14, commit 79bf902)
- Nova aba "✏️ Edição Visual" na Central (data-tab=visual / panel-visual).
- Sub-aba "📄 Páginas": 6 formulários colapsáveis (details/summary):
    • Página 1 — Boas-vindas (logo, título, subtítulo, botão CTA)
    • Página 2 — Nossa Essência (logo, título, texto, citação)
    • Página 3 — Menu Principal (logo, subtítulo, 4×label+sublabel)
    • Vitrine de Presentes (título, subtítulo)
    • Modal Doces Personalizados (título, info_titulo, 2 itens, pacotes_titulo)
    • Modal Orçamentos de Eventos (título)
- Sub-aba "🎨 Tema Global":
    • 5 color pickers com sincronização picker↔hex input em tempo real
    • Preview inline de cores (fundo, texto, botão, card) atualiza ao digitar
    • Seletor de fonte (8 opções: Poppins, Lato, Inter, Nunito, Roboto,
      Montserrat, Playfair Display, DM Sans)
    • Botão "Restaurar padrão" com confirmação
- obaNormalizeCatalog: tema adicionado (s.tema||s.theme||{})
- obaDraftPayload: tema adicionado (state.tema||{})
- carregar(): chama obaPopularFormTema() ao carregar o DRAFT
- obaPopularFormTema(): popula todos os 30+ campos a partir de catalogo.tema
- obaLerFormTema(): lê todos os campos e monta objeto tema completo
- obaSalvarPaginaDoTema(): POST /api/draft via obaSaveDraftWith('tema', tema)
- CSS inline: oba-pg-details/summary/form (details colapsáveis estilizados)
- Worker: nenhuma alteração necessária.

## Ultima fase aprovada
9B — Aba de Edição Visual na Central (commit 79bf902).

## Próximo passo
Deploy: executar wrangler deploy para publicar as fases 9A + 9B na Central online.
Após deploy, homologar na Central ao vivo:
  1. Abrir aba Edição Visual → verificar campos populados do theme.json
  2. Alterar um texto → Salvar → verificar badge "Rascunho aguardando Preview"
  3. Visualizar cardápio (Preview) → confirmar texto alterado no /__preview
  4. Publicar → confirmar no cardápio público

Fase 9C (opcional): preview ao vivo com iframe de celular dentro da Central.

## Estado atual do ciclo
Produção Estável & Aguardando Deploy das Fases 9A+9B.
- Central Privada Online: https://oba-cardapio-gestao.obadoceria.workers.dev/
- Repositório Oficial: https://github.com/oba-group-projects/cardapio
- Cardápio Público: https://oba-group-projects.github.io/cardapio/

# DECISIONS

## D001 — GitHub como fonte canônica

Código, documentação, releases e histórico oficial vivem no repositório Git.

## D002 — Produção não é área de edição

Editar nunca significa publicar.

Fluxo obrigatório:

DRAFT -> PREVIEW -> PUBLISHED.

## D003 — Revisões imutáveis

Uma revisão publicada não é editada.

Novas alterações criam ou reutilizam revisões identificadas por conteúdo/SHA-256.

## D004 — Central privada

A administração não pode ser exposta como página pública sem proteção real.

## D005 — Autenticação no Worker

Cloudflare Access/Zero Trust não foi adotado porque a configuração disponível exigiu informações de pagamento.

A autenticação foi implementada na aplicação/Worker, mantendo o requisito de zero custo e sem cartão.

## D006 — Secrets

Passwords, session secrets e tokens nunca ficam no navegador, Git ou arquivos versionados.

## D007 — Publicação pública preservada durante migração

O cardápio público existente continua funcionando enquanto a nova gestão é construída isoladamente.

## D008 — Cloud writes protegidos

Checkpoint + gates + build antes de qualquer deploy ou D1 write.

## D009 — Fail closed

Se uma fase crítica falhar, não avançar automaticamente para a fase seguinte.

## D010 — Automação prioritária

Automatizar diagnóstico, patch, testes, checkpoints, deploy seguro, rollback, documentação e handoff sempre que possível.

## D011 — Portabilidade entre IAs

O repositório deve conter contexto suficiente para continuidade em ChatGPT, Claude, Cursor, Cline, Copilot ou outra ferramenta.

## D012 — Scripts persistentes

Evitar scripts extremamente longos colados diretamente no PSReadLine. Preferir scripts versionados em `.scripts/`.

## D013 — Armazenamento de mídia zero custo no D1

O Cloudflare R2 ou serviços externos de storage frequentemente exigem inserção de cartão de crédito. Para manter a premissa de zero custo e sem cartão, as imagens enviadas pela gestão são compactadas no navegador (Canvas HTML5) e persistidas em tabela dedicada (`catalog_media`) no Cloudflare D1 como Base64, sendo servidas publicamente via `/api/media/:id` com headers de cache imutável e ETag.

## D014 — Catálogo e Cardápio são experiências distintas

Cardápio = escolher e comprar. Catálogo = descobrir e explorar.
Os dois não devem convergir para a mesma interface nem para o mesmo fluxo.

## D015 — Editor do Catálogo deliberadamente mais simples

O Editor Visual do Catálogo não precisa reproduzir os recursos do Editor Visual do Cardápio.
Deve ter apenas os controles necessários para a arquitetura atual do Catálogo.
Não buscar paridade artificial entre os dois editores.

## D016 — Pg1 do Catálogo estruturalmente obrigatória

Pg1 do Catálogo permanece como entrada obrigatória do fluxo.
Somente Pg2 e os grupos de sabores podem ser ativados/desativados na Camada 1 do editor.
Não implementar ativo/inativo de Pg1 sem caso de uso real demonstrado.

## D017 — Não criar grupos dinâmicos no Catálogo sem necessidade real

Artesanais e Finos são os grupos atuais. Criar um novo grupo é uma operação de dados,
não uma duplicação visual. Não implementar criação/remoção/duplicação de grupos
antes de necessidade demonstrada.

## D018 — Não implementar seções extras no Catálogo sem necessidade real

A regra é: primeiro provar que o Catálogo precisa de nova seção, depois criar a capacidade.
Não transformar o Catálogo em CMS antes de validar necessidade com uso real.

## D019 — Contrato é snapshot independente da Proposta

Quando uma Proposta vira Contrato, o conteúdo é congelado em snapshot imutável (HTML + SHA-256).
Alterações posteriores na Proposta não afetam o Contrato enviado.
Se houver necessidade de alteração, o contrato atual é cancelado e um novo é gerado.

## D020 — `valor_total` do Contrato é calculado e persistido no Worker

O valor total do contrato é calculado pelo Worker via `obaCalcularValorContrato()`
usando os preços reais do catálogo (D1 PUBLISHED). Não recalcular no frontend.
O campo `valor_total` na tabela `contracts` é a fonte de verdade do valor contratado.

## D021 — Não implementar assinatura eletrônica própria

A Gestão é responsável pelo contrato e pelo aceite eletrônico simples (WhatsApp/CPF).
A assinatura digital com evidências, certificado e validade jurídica plena
será responsabilidade de um provedor especializado (candidato: Autentique).
Não construir mecanismo próprio de autenticação forte nem geração de PDF certificado.

# Documentação dos módulos de código

Este documento descreve o comportamento e os contratos de todos os módulos de
`src/`:

- [`src/types.ts`](#srctypests)
- [`src/config.ts`](#srcconfigts)
- [`src/io.ts`](#srciots)
- [`src/concurrency.ts`](#srcconcurrencyts)
- [`src/github.ts`](#srcgithubts)
- [`src/oci.ts`](#srcocits)
- [`src/policy.ts`](#srcpolicyts)
- [`src/main.ts`](#srcmaints)

A visão de arquitetura (functional core / imperative shell) está em
[architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md); o contrato público
da action está em [product/ACTION-CONTRACT.md](product/ACTION-CONTRACT.md).

## src/types.ts

### Objetivo

Definir os tipos de domínio e os contratos compartilhados por todos os módulos.
Não contém lógica.

### Principais tipos

- `Config` / `ResolvedConfig`: configuração validada dos inputs;
  `ResolvedConfig` tem `ownerType` já resolvido (`auto` substituído por
  `organization` ou `user`).
- `Rule`: regra de tag, `exact` ou `regex`; `value` preserva a linha original do
  input e é a evidência registrada em `matchedRule`.
- `PackageVersion`: versão normalizada da API do GitHub (a unidade de exclusão).
- `Reason`: reason codes estáveis (`PROTECTED_*` / `ELIGIBLE_*`) de cada decisão.
- `Decision`: decisão auditável por versão — disposição (`protected` |
  `eligible`), reason code e evidência.
- `Plan`: plano canônico e determinístico, com fingerprints de inventário e de
  política e contadores agregados.
- `OciEvidence`: evidência dos manifests do registry (`children`, `subjects`,
  `unknown`); digests em `unknown` falham fechado.
- `ApplyOutcome` / `ApplyResult` / `ApplyReport`: desfechos por tentativa de
  exclusão (`deleted`, `absent`, `failed`) e o relatório auditável do apply.

### Invariantes relevantes

- Cada versão recebe exatamente uma disposição e um reason code no plano.
- Desfechos de apply nunca substituem a disposição do plano — são namespaces
  distintos.
- `counts.scanned` = `counts.protected` + `counts.eligible`.

## src/config.ts

### Objetivo

Ler, validar e normalizar os inputs da GitHub Action para um objeto `Config`
tipado, antes de qualquer acesso à rede.

### API

- `rules(value: string): Rule[]`
- `loadConfig(): Config`

### Funções auxiliares

- `integer(name, value, min, max)`:
  - Exige inteiro decimal positivo/zero (`^\d+$`).
  - Valida faixa inclusiva (`min` a `max`).
- `bool(name, value)`:
  - Aceita apenas `"true"` ou `"false"`.

### Regras de parsing de tags (`rules`)

- Entrada multilinha.
- Remove espaços nas extremidades.
- Ignora linhas vazias e comentários iniciados por `#`.
- Limites (contêm inputs abusivos):
  - Máximo de 50 regras.
  - Máximo de 256 caracteres por regra.
- Regex:
  - Linha no formato `/.../` (com tamanho > 2) é compilada com
    `new RegExp(source)`.
  - Em erro de compilação, lança `Invalid regular expression: <linha>`.
- Caso contrário, regra do tipo `exact`.

### `loadConfig` (resumo)

- Lê `INPUT_*` via `input(...)`.
- Mascara o token via `mask(token)` imediatamente após a leitura, antes de
  qualquer log possível.
- Aplica defaults e validações de tipo/faixa.
- Retorna um objeto `Config` pronto para uso pelas camadas de domínio e IO.

### Defaults e limites relevantes

- `owner-type`: `auto` (ou `organization`/`user`).
- `ephemeral-retention-days`: default `30`, faixa `0..36500`.
- `untagged-retention-days`: default `7`, faixa `0..36500`.
- `keep-latest`: default `10`, faixa `0..10000`.
- `delete-untagged`: default `false`.
- `always-keep-newest`: default `true`.
- `protect-multi-arch`: default `true`.
- `protect-referrers`: default `true`.
- `delete-orphaned-referrers`: default `false`.
- `dry-run`: default `true`.
- `fail-on-empty`: default `false`.
- `verify-inventory-before-apply`: default `true`.
- `validate-after-cleanup`: default `true`.
- `max-deletions`: default `20`, faixa `0..10000`.
- `max-delete-percentage`: default `25`, faixa `0..100`.
- `budget-mode`: default `abort` (ou `cap`).
- `concurrency`: default `2`, faixa `1..10`.
- `retry-count`: default `3`, faixa `0..5`.

## src/io.ts

### Objetivo

Centralizar IO de ambiente e mensagens específicas do GitHub Actions.

### API

- `input(name, required?)`
- `mask(value)`
- `info(message)`
- `warning(message)`
- `fail(message)`
- `output(name, value)`
- `summary(markdown)`
- `save(path, data)`

### Comportamento por função

- `input`:
  - Converte o nome para a chave `INPUT_<NOME>`.
  - Aplica `trim()` e retorna `""` quando ausente.
  - Se `required=true` e vazio, lança erro.
- `mask`:
  - Emite `::add-mask::` para ocultar o segredo nos logs.
- `info`, `warning` e `fail`:
  - Removem CR/LF das mensagens: uma quebra de linha injetada poderia forjar
    comandos de workflow (`::...::`) no log.
  - `fail` marca `process.exitCode = 1` sem interromper o fluxo imediatamente.
- `output`:
  - Quando `GITHUB_OUTPUT` existe, escreve no formato heredoc com delimitador
    `ARKLEAN_EOF`, imune a valores com `=` ou quebras de linha.
  - Fora do runner, faz fallback para `console.log`.
- `summary`:
  - Escreve markdown em `GITHUB_STEP_SUMMARY` quando presente.
- `save`:
  - Persiste arquivo UTF-8 com permissão `0600`.

### Observações de segurança

- O token deve sempre ser mascarado antes de qualquer log.
- Mensagens de erro/aviso passam por sanitização de CR/LF.

## src/concurrency.ts

### Objetivo

Fornecer execução concorrente simples para listas de itens, com limite de
paralelismo.

### API

`pool<T>(values: T[], n: number, fn: (v: T) => Promise<void>): Promise<void>`

### Comportamento

- Executa `fn` para cada item de `values`.
- Limita a concorrência ao mínimo entre `n` e `values.length`.
- Não garante ordem de conclusão das execuções.
- Resolve quando todos os itens terminam.
- Rejeita em caso de erro em qualquer execução (`Promise.all`, fail-fast) —
  quem precisa tolerar falhas por item captura o erro dentro de `fn` (como o
  apply em `main.ts` e a inspeção em `oci.ts`).

### Detalhes importantes

- O índice compartilhado (`i`) distribui o trabalho entre os workers.
- Itens `undefined` são ignorados por segurança antes da chamada de `fn`.

### Quando usar

- Fan-out de chamadas HTTP.
- Processamento de lotes com limite de throughput.

## src/github.ts

### Objetivo

Transporte REST para a API do GitHub: resolução de owner, listagem paginada de
versões e exclusão idempotente.

### API

- `resolveOwnerType(c): Promise<OwnerType>`
- `listVersions(c): Promise<PackageVersion[]>`
- `deleteVersion(c, id): Promise<"deleted" | "absent">`

### Transporte e resiliência

- `base(c)`: monta o endpoint por escopo do proprietário
  (`/orgs/{owner}/...` ou `/users/{owner}/...`), com URL-encoding.
- `headers(c)`: `Accept`, `Authorization: Bearer`, `X-GitHub-Api-Version`
  (`2022-11-28`) e `User-Agent`.
- `transient(r)`: HTTP `429/502/503/504` são transitórios; `403` só é
  transitório com `Retry-After` ou `x-ratelimit-remaining: 0` (rate limit
  secundário) — um `403` puro é erro de permissão e não é re-tentado.
- `request(...)`: retry com backoff exponencial e jitter (teto de 30s por
  espera), respeitando `Retry-After`; máximo de tentativas em `retryCount`.

### `resolveOwnerType`

- Retorna direto quando o input não é `auto`.
- Consulta `/users/{owner}` (o endpoint responde para usuários e organizações)
  e mapeia `type` para `organization`/`user`; qualquer outro valor aborta.

### `listVersions`

- Paginação completa via cabeçalho `Link` (`rel="next"`), 100 por página.
- IDs duplicados abortam (`Duplicate package version ...`): inventário ambíguo
  não pode alimentar decisões de exclusão.
- Mais de 1000 páginas abortam (`Pagination exceeded ...`): inventário parcial
  não pode alimentar decisões de exclusão.
- Normaliza `id`, `name` (digest), `tags`, `created_at`, `updated_at`.

### `deleteVersion`

- `204` → `"deleted"`.
- `404` → `"absent"` (sucesso idempotente; nunca contado como `deleted`).
- Qualquer outro status lança erro com o HTTP status e o ID da versão (sem
  corpo de resposta, que poderia expor informação).

## src/oci.ts

### Objetivo

Coletar evidências OCI no registry para proteger relações entre artefatos
durante a limpeza.

### Conceitos

- `children`: filhos de um índice/lista multi-arch.
- `subjects`: relação referrer → subject (OCI 1.1).
- `unknown`: digests que não puderam ser inspecionados (falham fechado no motor
  de política).

### Constantes e utilitários

- `REGISTRY`: `ARKLEAN_REGISTRY_URL` (hook de teste) ou `https://ghcr.io`
  (produção).
- `MANIFEST_ACCEPT`: cabeçalho `Accept` com media types OCI/Docker de index e
  manifest.
- `repository(c)`: normaliza para `owner/package` em lowercase (exigência do
  registry).

### Fluxo principal: `gatherOciEvidence(c, versions)`

1. Inicializa a estrutura `OciEvidence` vazia.
2. Tenta obter token de pull via `registryToken(c)`.
3. Se o token falhar:
   - Marca todas as versões em `unknown` (fail-closed total).
   - Retorna as evidências sem interromper o processo superior.
4. Com token válido:
   - Processa versões em paralelo via `pool` com `c.concurrency`.
   - Busca o manifest por digest da versão.
   - Em sucesso:
     - Coleta `manifest.manifests[].digest` em `children`.
     - Coleta `manifest.subject.digest` em `subjects`.
   - Em erro HTTP ou exceção:
     - Marca o digest da versão em `unknown`.

### Resiliência de rede: `fetchRetry(...)`

- Retry para HTTP `429`, `502`, `503`, `504`.
- Respeita `Retry-After` quando informado.
- Fallback de backoff exponencial com jitter.
- Limita a espera máxima a 30s por tentativa.
- Número máximo de tentativas controlado por `retryCount`.

### `registryToken(c)`

- Troca a credencial básica (`x:<token>`) por um Bearer token do registry com
  escopo `pull` restrito ao único pacote inspecionado.
- Falha se o HTTP não for ok ou se o token estiver ausente no payload.

### `confirmAbsent(c, digests)`

- Confirma ausência de subjects no registry para a limpeza de órfãos: **apenas
  um 404 explícito** no manifest conta como prova.
- Qualquer outra resposta ou falha (rede, autenticação, 5xx) deixa o digest de
  fora do resultado — na dúvida, o referrer permanece retido.
- Se a própria troca de token falhar, nada é confirmado.

### Tamanhos (`evidence.sizes`)

- Durante a inspeção, soma `config.size` + `layers[].size` (manifests de
  imagem) ou os descritores de `manifests[]` (índices) por digest.
- Base do output `estimated-reclaimed-bytes`, somado sobre as elegíveis do
  plano final; vazio quando a inspeção não rodou.

## src/policy.ts

### Objetivo

Motor de política puro e determinístico: transforma inventário + configuração
em um plano auditável, sem qualquer acesso à rede (invariante verificada por
`tests/architecture.test.js`).

### API

- `buildPlan(config, versions, now?): Plan`
- `protectOciRelations(plan, evidence, config): Plan`
- `unresolvedSubjects(plan, evidence): Set<string>`
- `releaseOrphanReferrers(plan, evidence, confirmedAbsent, config): Plan`
- `capToBudget(config, plan): Plan`
- `planHash(plan): string`
- `assertBudget(config, plan): void`

### `buildPlan` — precedência de decisão

Para cada versão, na ordem:

1. Tag protegida (`protected-tags`) → `PROTECTED_TAG` (uma tag protegida
   protege a versão inteira).
2. Sem tags: candidata (`ELIGIBLE_UNTAGGED`) apenas com `delete-untagged`
   habilitado e idade ≥ `untagged-retention-days`; senão
   `PROTECTED_TOO_RECENT`.
3. Tagueada sem casar regra efêmera → `PROTECTED_UNMATCHED_TAG`.
4. Efêmera recente (idade < `ephemeral-retention-days`) →
   `PROTECTED_TOO_RECENT`.
5. Efêmera antiga → candidata (`ELIGIBLE_EPHEMERAL`).

Sobre as candidatas:

- `keep-latest`: as N candidatas tagueadas mais recentes viram
  `PROTECTED_KEEP_LATEST` (ordenação por `createdAt` com desempate por
  `versionId` para estabilidade).
- `always-keep-newest`: a versão mais nova do pacote vira `PROTECTED_NEWEST`.

O plano final carrega `evaluatedAt` (relógio injetado), `inventoryFingerprint`
e `policyFingerprint` (SHA-256 de representações canônicas) e decisões
ordenadas por `versionId`.

### `protectOciRelations` — propagação em ponto fixo

Repropaga proteção até não haver mudanças (um referrer protegido também protege
os próprios filhos):

- Filho de índice retido → `PROTECTED_OCI_CHILD` (`matchedRule` = digest do
  pai).
- Referrer de versão retida, via `subject` OCI 1.1 ou tag Cosign
  `sha256-<digest>.<sufixo>` → `PROTECTED_OCI_REFERRER` (`matchedRule` =
  digest do subject).
- Digest em `unknown` → `PROTECTED_UNKNOWN_RELATION` (fail-closed, ADR-003 e
  ADR-005).
- Se algum índice retido está em `unknown`, toda candidata sem tag também vira
  `PROTECTED_UNKNOWN_RELATION` — qualquer uma pode ser filha dele.

### `unresolvedSubjects` e `releaseOrphanReferrers` — órfãos (`delete-orphaned-referrers`)

`unresolvedSubjects` coleta os subjects (campo `subject` do manifest e tags
Cosign) referenciados por retenções fracas (`PROTECTED_UNMATCHED_TAG`,
`PROTECTED_TOO_RECENT`) que **não existem no inventário** — os únicos digests
que precisam de confirmação no registry. `releaseOrphanReferrers` torna
elegível (`ELIGIBLE_ORPHAN_REFERRER`) o referrer cujos subjects estão **todos**
fora do inventário **e todos** confirmados 404 (`confirmAbsent` em `oci.ts`).
Tags protegidas, keep-latest/newest, proteções OCI e relações desconhecidas
nunca são liberadas; qualquer dúvida retém (fail-closed).

### `capToBudget` — orçamento como fatia (`budget-mode: cap`)

Quando as candidatas excedem os orçamentos, mantém elegíveis as **mais antigas**
que cabem em `max-deletions` e `max-delete-percentage` (o menor dos dois manda)
e reclassifica o restante como `DEFERRED_BUDGET` (disposição `protected` nesta
execução; volta a ser candidata nas próximas). `matchedRule` é preservado como
evidência. O plano resultante satisfaz `assertBudget` por construção. No modo
`abort` (default), esta função não é chamada.

### `planHash`

SHA-256 do JSON do plano. Contrato de determinismo: o plano é sempre construído
com a mesma ordem de chaves e com decisões/tags/inventário ordenados, então o
`JSON.stringify` é estável.

### `assertBudget`

Aborta com `ABORTED_BUDGET_EXCEEDED` quando as candidatas excedem
`max-deletions` (absoluto) ou `max-delete-percentage` (percentual sobre o total
escaneado).

## src/main.ts

### Objetivo

Orquestrar o fluxo completo da action: configuração → planejamento → apply
opcional → outputs → resumo. É o único módulo que compõe todos os demais.

### Fluxo

1. `loadConfig()` + `resolveOwnerType()` → `ResolvedConfig`.
2. `listVersions()`; com `fail-on-empty` e inventário vazio, aborta
   (`ABORTED_NO_MATCH`).
3. `buildPlan()`; com proteção OCI habilitada e candidatas presentes,
   `gatherOciEvidence()` + `protectOciRelations()` (avisa quando a inspeção
   ficou incompleta).
4. Grava o plano JSON (`plan-path`, com `planSha256`) **antes** de
   `assertBudget()`, para que um abort ainda deixe o artefato de auditoria.
5. Em dry-run: apenas avisa quantas versões seriam excluídas.
6. Em apply:
   - Exige `confirm-delete` exatamente igual a `owner/package`.
   - Com `verify-inventory-before-apply`, relê o inventário e replaneja com o
     relógio original (`evaluatedAt`) — só mudanças reais de inventário alteram
     o fingerprint; divergência aborta (`ABORTED_INVENTORY_CHANGED`).
   - Exclui as candidatas via `pool` com `c.concurrency`, capturando falhas por
     item (`deleted`/`absent`/`failed`); resultados ordenados por `versionId`
     para relatório determinístico.
   - Com `validate-after-cleanup`, relê o inventário e verifica se todas as
     versões protegidas continuam presentes.
   - Grava o relatório de apply (`result-path`).
7. Emite os outputs (`scanned`, `protected`, `eligible`, `deleted`, `absent`,
   `failed`, `plan-sha256`, `plan-path`, `result-path`) e o Step Summary.
8. Falha a execução se houve exclusões com erro ou se a validação pós-apply
   falhou (`VALIDATION_FAILED`).

### Detalhes

- `sanitize(name)` restringe o nome do pacote a caracteres seguros para nome de
  arquivo.
- Os artefatos são gravados em `RUNNER_TEMP` (fallback: diretório atual).
- Erros não tratados terminam em `fail(...)`, marcando `exitCode = 1`.

## Relação entre módulos

- `types.ts` define os contratos compartilhados.
- `config.ts` monta o `Config` validado.
- `github.ts` fornece inventário e exclusão via API do GitHub.
- `oci.ts` consome `Config` para coletar evidências OCI no registry.
- `policy.ts` decide, de forma pura, o destino de cada versão.
- `concurrency.ts` limita o paralelismo das chamadas de rede.
- `io.ts` padroniza logs, outputs e persistência de artefatos.
- `main.ts` compõe tudo e é o único módulo ciente do ambiente.

## Guia rápido de manutenção

- Ao adicionar novo input:
  - Atualize `action.yml`, `loadConfig` (validação consistente) e
    [product/ACTION-CONTRACT.md](product/ACTION-CONTRACT.md).
  - Mantenha defaults conservadores e fail-safe.
- Ao alterar o motor de política:
  - Preserve pureza (sem rede/ambiente) e determinismo (relógio injetado,
    ordenações estáveis) — os testes de arquitetura e de propriedade cobram
    isso.
  - Reason codes são contrato público: adicionar exige atualização do
    ACTION-CONTRACT; remover/renomear é breaking change.
- Ao alterar comportamento de rede:
  - Preserve o tratamento de `unknown` para manter o fail-closed.
  - Evite reduzir a robustez de retry para códigos transitórios.
- Ao mudar formato de output:
  - Mantenha compatibilidade com `GITHUB_OUTPUT` e `GITHUB_STEP_SUMMARY`.

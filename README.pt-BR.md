# Arklean

GitHub Action segura e explicável para políticas de retenção no GitHub Container Registry. Escrita em TypeScript estrito e sem dependências npm em runtime.

> **Aviso de segurança:** com `protect-multi-arch` e `protect-referrers` (ambos ligados por padrão), o Arklean inspeciona manifests do registry e protege filhos de plataforma de índices multi-arch retidos e seus referrers de assinatura/atestado/SBOM; relações que não podem ser provadas falham fechado (`PROTECTED_UNKNOWN_RELATION`). Ainda assim comece com `dry-run: true` e revise o plano antes de ativar exclusões — a limpeza de referrers órfãos ainda não foi implementada, e `delete-untagged` permanece `false` por padrão.

## Uso

```yaml
name: Cleanup GHCR
on:
  workflow_dispatch:
    inputs:
      dry-run: { type: boolean, default: true }
  schedule:
    - cron: "0 3 * * 1"
permissions:
  contents: read
  packages: write
jobs:
  cleanup:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [aws-cli, gcloud-cli, tofu]
    steps:
      - uses: Tooark/arklean@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          owner: ${{ github.repository_owner }}
          package: ${{ matrix.package }}
          dry-run: ${{ github.event_name != 'workflow_dispatch' || inputs.dry-run }}
          # Obrigatório quando dry-run é false; deve ser exatamente owner/package:
          # confirm-delete: ${{ github.repository_owner }}/${{ matrix.package }}
          keep-latest: 10
          max-deletions: 20
          max-delete-percentage: 25
```

O repositório executor precisa de acesso administrativo ao pacote. Um PAT clássico usado para exclusão precisa de escopos de leitura/exclusão de packages. Prefira `GITHUB_TOKEN` com acesso explícito de Actions ao pacote ou um GitHub App/token dedicado.

## Semântica da política

- Uma tag protegida preserva a versão inteira do pacote.
- Versões tagueadas que não casam com nenhuma regra efêmera são preservadas (`PROTECTED_UNMATCHED_TAG`).
- Versões efêmeras e antigas tornam-se candidatas.
- Versões antigas sem tag só se tornam candidatas quando habilitado explicitamente; o padrão é `false`.
- Com a proteção OCI ligada e havendo candidatas, o Arklean busca um manifest do registry por versão escaneada (limitado por `concurrency`): filhos de índices retidos viram `PROTECTED_OCI_CHILD`, referrers (`subject` do OCI 1.1 ou tags cosign `sha256-<digest>.*`) viram `PROTECTED_OCI_REFERRER`, e o que não puder ser provado vira `PROTECTED_UNKNOWN_RELATION`.
- `keep-latest` preserva as candidatas tagueadas mais recentes; `always-keep-newest` preserva a versão mais nova do pacote (`PROTECTED_NEWEST`).
- Tags de branch mutáveis (`main`, `master`, `develop`) **não** são efêmeras por padrão: elas podem apontar para a imagem em uso. Adicione-as a `ephemeral-tags` explicitamente se entender o risco.
- `owner-type` tem padrão `auto` e é resolvido pela API do GitHub.
- Antes do primeiro DELETE, o Arklean exige os limites de segurança, `confirm-delete: owner/package` exato e a releitura do inventário sem mudanças.
- Após o apply, `validate-after-cleanup` relê o inventário e falha a execução se qualquer versão protegida tiver desaparecido.
- Toda decisão carrega um reason code estável; abortos de execução usam `ABORTED_BUDGET_EXCEEDED`, `ABORTED_NO_MATCH`, `ABORTED_INVENTORY_CHANGED` e `VALIDATION_FAILED`.

## Outputs

`scanned`, `protected`, `eligible`, `deleted`, `absent` (já ausente quando a exclusão foi tentada), `failed`, `plan-sha256`, `plan-path` (plano JSON canônico, sempre gravado) e `result-path` (relatório JSON do apply com o desfecho por versão; vazio em dry-run). Envie o plano e o relatório como artifacts do workflow se precisar de registros de auditoria duráveis.

## Desenvolvimento

```bash
corepack enable
pnpm install
pnpm check   # lint + typecheck + build + test
```

O bundle `dist/` commitado deve sempre corresponder a um build novo; o CI falha caso contrário. Os testes usam o test runner nativo do Node com um mock HTTP da API do GitHub — sem acesso à rede.

## Supply chain

As actions do CI são pinadas por SHA completo de commit. CodeQL, dependency review e Dependabot rodam a cada mudança. As releases são construídas a partir do fonte, verificadas quanto à reprodutibilidade do bundle e publicadas com checksums SHA-256, SBOM CycloneDX e atestado de proveniência de build; a tag móvel `v1` só é atualizada pelo workflow de release protegido. Consumidores com postura estrita devem pinar um SHA completo.

Os controles de nível de repositório (branch protection, environment `release` protegido, secret scanning) estão pendentes até o repositório se tornar público — veja [docs/REPO-SETUP.md](docs/REPO-SETUP.md) para o status e os comandos exatos.

## Licença

Apache-2.0.

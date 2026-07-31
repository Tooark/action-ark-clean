<div align="left">
  <img src="media/banner-arklean.png" alt="Arklean" width="100%" />
</div>

# Arklean

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Arklean-2088FF?logo=githubactions&logoColor=white)](https://github.com/marketplace/actions/arklean)
[![CI](https://github.com/Tooark/action-ark-clean/actions/workflows/ci.yml/badge.svg)](https://github.com/Tooark/action-ark-clean/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/Tooark/action-ark-clean)](https://github.com/Tooark/action-ark-clean/releases)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

GitHub Action segura e explicável para políticas de retenção no GitHub Container Registry. Escrita em TypeScript estrito e sem dependências npm em runtime.

> **Aviso de segurança:** com `protect-multi-arch` e `protect-referrers` (ambos ligados por padrão), o Arklean inspeciona
> manifests do registry e protege filhos de plataforma de índices multi-arch retidos e seus referrers de
> assinatura/atestado/SBOM; relações que não podem ser provadas falham fechado (`PROTECTED_UNKNOWN_RELATION`). Ainda assim
> comece com `dry-run: true` e revise o plano antes de ativar exclusões — a limpeza de referrers órfãos ainda não foi
> implementada, e `delete-untagged` permanece `false` por padrão.

🌍 **Idiomas:** [![USA Flag](https://flagcdn.com/w20/us.png) English](README.md) · ![Brazil Flag](https://flagcdn.com/w20/br.png) **Português (este arquivo)**

## ✨ Funcionalidades

- 🔍 **Dry-run por padrão** — planeja primeiro; só exclui com confirmação explícita via `confirm-delete`.
- 🧾 **Decisões explicáveis** — toda versão recebe um reason code estável e legível por máquina em um plano JSON canônico.
- 🛡️ **Proteção do grafo OCI** — retém filhos de plataforma de índices multi-arch e referrers de assinatura/atestado/SBOM; relações não prováveis falham fechado.
- 🚧 **Limites de segurança** — orçamentos absoluto e percentual de exclusão, releitura do inventário antes do primeiro DELETE e validação pós-apply.
- 🪶 **Zero dependências em runtime** — apenas built-ins do Node, bundle reproduzível commitado, CI pinado por SHA.
- 📦 **Um pacote por execução** — use uma matriz de workflow para varrer vários pacotes.

## 🚀 Como começar

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
      - uses: Tooark/action-ark-clean@v0
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

O repositório executor precisa de acesso administrativo ao pacote. Um PAT clássico usado para exclusão precisa de escopos
de leitura/exclusão de packages. Prefira `GITHUB_TOKEN` com acesso explícito de Actions ao pacote ou um GitHub App/token
dedicado.

Mais exemplos em [examples/](examples/):

- [minimal-dry-run.yml](examples/minimal-dry-run.yml) — o menor setup útil: relatório semanal, nada é excluído
- [full-options.yml](examples/full-options.yml) — todos os inputs suportados com seus defaults e uma nota breve
- [apply-with-audit.yml](examples/apply-with-audit.yml) — modo apply com plano/relatório enviados como artifacts de auditoria
- [tooark-cleanup.yml](examples/tooark-cleanup.yml) — caso real de produção: matriz sobre vários pacotes

## ⚙️ Inputs

Obrigatórios:

| Input     | Descrição                                                  |
| --------- | ---------------------------------------------------------- |
| `token`   | Token do GitHub com permissão de administração de packages |
| `owner`   | Organização ou usuário proprietário do pacote              |
| `package` | Nome exato do pacote no GHCR                               |

Política de retenção:

| Input                      | Padrão                                         | Descrição                                                               |
| -------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `protected-tags`           | `latest`, `stable`, `production`, regex SemVer | Tags exatas ou `/regex/`, uma por linha; correspondência retém a versão |
| `ephemeral-tags`           | Regexes de SHA, prefixo de branch e scan       | Tags exatas ou `/regex/`, uma por linha, elegíveis por idade            |
| `ephemeral-retention-days` | `30`                                           | Idade mínima para versões com tag efêmera                               |
| `untagged-retention-days`  | `7`                                            | Idade mínima para versões sem tag                                       |
| `keep-latest`              | `10`                                           | Quantidade das candidatas tagueadas mais recentes a preservar           |
| `delete-untagged`          | `false`                                        | Permite excluir versões antigas sem tag                                 |
| `always-keep-newest`       | `true`                                         | Preserva sempre a versão mais recente do pacote                         |

Segurança OCI:

| Input                | Padrão | Descrição                                                           |
| -------------------- | ------ | ------------------------------------------------------------------- |
| `protect-multi-arch` | `true` | Protege filhos de plataforma de índices multi-arch retidos          |
| `protect-referrers`  | `true` | Protege referrers de assinatura, atestado e SBOM de versões retidas |

Segurança e execução:

| Input                           | Padrão  | Descrição                                                           |
| ------------------------------- | ------- | ------------------------------------------------------------------- |
| `dry-run`                       | `true`  | Somente plano; nenhuma requisição DELETE                            |
| `confirm-delete`                | —       | Obrigatório no modo apply; deve ser exatamente `owner/package`      |
| `verify-inventory-before-apply` | `true`  | Relê o inventário e aborta se mudou antes da exclusão               |
| `validate-after-cleanup`        | `true`  | Relê o inventário após o apply; falha se uma versão protegida sumiu |
| `max-deletions`                 | `20`    | Orçamento absoluto de exclusões                                     |
| `max-delete-percentage`         | `25`    | Orçamento percentual de exclusões                                   |
| `budget-mode`                   | `abort` | `abort` falha ao exceder orçamentos; `cap` adia o excedente         |
| `fail-on-empty`                 | `false` | Falha quando o pacote não tem versões                               |
| `owner-type`                    | `auto`  | `auto`, `organization` ou `user`                                    |
| `concurrency`                   | `2`     | Requisições concorrentes, 1–10                                      |
| `retry-count`                   | `3`     | Tentativas extras para falhas transitórias da API, 0–5              |

A descrição normativa de cada input, output e reason code é o [contrato da action](docs/product/ACTION-CONTRACT.md).

## 📤 Outputs

| Output        | Descrição                                                         |
| ------------- | ----------------------------------------------------------------- |
| `scanned`     | Número de versões escaneadas                                      |
| `protected`   | Número de versões retidas                                         |
| `eligible`    | Número de versões elegíveis para exclusão                         |
| `deleted`     | Número de versões excluídas                                       |
| `absent`      | Número já ausente quando a exclusão foi tentada (404 idempotente) |
| `failed`      | Número cuja exclusão falhou                                       |
| `plan-sha256` | SHA-256 do plano canônico de limpeza                              |
| `plan-path`   | Caminho do plano JSON (sempre gravado)                            |
| `result-path` | Caminho do relatório JSON do apply; vazio em dry-run              |

Envie o plano e o relatório como artifacts do workflow se precisar de registros de auditoria duráveis.

## 🧠 Semântica da política

- Uma tag protegida preserva a versão inteira do pacote.
- Versões tagueadas que não casam com nenhuma regra efêmera são preservadas (`PROTECTED_UNMATCHED_TAG`).
- Versões efêmeras e antigas tornam-se candidatas.
- Versões antigas sem tag só se tornam candidatas quando habilitado explicitamente; o padrão é `false`.
- Com a proteção OCI ligada e havendo candidatas, o Arklean busca um manifest do registry por versão escaneada (limitado
  por `concurrency`): filhos de índices retidos viram `PROTECTED_OCI_CHILD`, referrers (`subject` do OCI 1.1 ou tags
  cosign `sha256-<digest>.*`) viram `PROTECTED_OCI_REFERRER`, e o que não puder ser provado vira `PROTECTED_UNKNOWN_RELATION`.
- `keep-latest` preserva as candidatas tagueadas mais recentes; `always-keep-newest` preserva a versão mais nova do pacote (`PROTECTED_NEWEST`).
- Tags de branch mutáveis (`main`, `master`, `develop`) **não** são efêmeras por padrão: elas podem apontar para a imagem
  em uso. Adicione-as a `ephemeral-tags` explicitamente se entender o risco.
- `owner-type` tem padrão `auto` e é resolvido pela API do GitHub.
- Antes do primeiro DELETE, o Arklean exige os limites de segurança, `confirm-delete: owner/package` exato e a releitura do inventário sem mudanças.
- Após o apply, `validate-after-cleanup` relê o inventário e falha a execução se qualquer versão protegida tiver desaparecido.
- Toda decisão carrega um reason code estável; abortos de execução usam `ABORTED_BUDGET_EXCEEDED`, `ABORTED_NO_MATCH`, `ABORTED_INVENTORY_CHANGED` e `VALIDATION_FAILED`.

## 🧪 Desenvolvimento

```bash
corepack enable
pnpm install
pnpm check   # lint + typecheck + build + test
```

O bundle `dist/` commitado deve sempre corresponder a um build novo; o CI falha caso contrário. Os testes usam o test runner nativo do Node com um mock HTTP da API do GitHub — sem acesso à rede.

## 📚 Documentação

- [Contrato da action](docs/product/ACTION-CONTRACT.md) — o contrato público implementado: inputs, outputs, reason codes, nomes reservados
- [Arquitetura](docs/architecture/ARCHITECTURE.md) e [modelo de domínio](docs/architecture/DOMAIN-MODEL.md)
- [Registros de decisão de arquitetura](docs/adr/) (ADR-001 … ADR-009)
- [Threat model](docs/security/THREAT-MODEL.md), [supply chain](docs/security/SUPPLY-CHAIN.md) e [notas de segurança](docs/SECURITY-NOTES.md)
- [Runbook de operações](docs/operations/RUNBOOK.md) — onboarding de pacote, parada de emergência, recuperação
- [Estratégia de testes](docs/development/TEST-STRATEGY.md) e [governança](docs/GOVERNANCE.md)
- [Referência dos módulos de código (pt-BR)](docs/SOURCE-MODULES.pt-BR.md)
- [Changelog](CHANGELOG.md)

As versões mantidas dos documentos originais de planejamento ficam em [docs/](docs/).

## 🔐 Supply chain

As actions do CI são pinadas por SHA completo de commit. CodeQL, dependency review e Dependabot rodam a cada mudança. As
releases são construídas a partir do fonte, verificadas quanto à reprodutibilidade do bundle e publicadas com checksums
SHA-256, SBOM CycloneDX e atestado de proveniência de build; a tag móvel de major (atualmente `v0`) só é atualizada pelo
workflow de release protegido. Consumidores com postura estrita devem pinar um SHA completo.

Os controles de nível de repositório (branch protection, environment `release` protegido, secret scanning) estão pendentes
até o repositório se tornar público — veja [docs/REPO-SETUP.md](docs/REPO-SETUP.md) para o status e os comandos exatos.

## 🤝 Contribuindo

Contribuições são bem-vindas! Comece pelo [CONTRIBUTING.md](CONTRIBUTING.md) — ele cobre o layout do repositório, o fluxo
de desenvolvimento, a convenção de commits, a exigência de sign-off DCO e o processo de release.

- 🐛 Encontrou um bug? [Abra uma issue](https://github.com/Tooark/action-ark-clean/issues/new/choose).
- ✨ Tem uma ideia? Abra uma issue descrevendo o problema que quer resolver.

Ao participar, você concorda com nosso [Código de Conduta](CODE_OF_CONDUCT.md).

## 🆘 Ajuda & Segurança

- 💬 **Dúvidas e ajuda** — veja o [SUPPORT.md](SUPPORT.md) para todos os canais e prazos de resposta.
- 🔒 **Vulnerabilidades de segurança** — nunca abra uma issue pública; reporte de forma privada conforme o [SECURITY.md](SECURITY.md).

## 💖 Apoie

Se o Arklean economiza sua conta de armazenamento ou seus scripts de limpeza, considere apoiar o projeto:

- [GitHub Sponsors](https://github.com/sponsors/paulosfjunior)
- [Ko-fi](https://ko-fi.com/paulosfjunior)
- [PayPal](https://www.paypal.com/donate/?business=62KETU4PXBWZC&no_recurring=0&currency_code=BRL)

Toda contribuição ajuda a manter a família Tooark. Obrigado! 💙

## 📝 Licença

Distribuído sob a [Licença Apache 2.0](LICENSE).

---

Feito com 💙 pela [Tooark](https://tooark.com).

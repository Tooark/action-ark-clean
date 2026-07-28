# Arklean

**Políticas seguras e explicáveis de ciclo de vida para o GitHub Container Registry.**

O Arklean é uma GitHub Action open source da família Tooark/Ark* para descobrir, planejar e excluir versões antigas de imagens no GHCR com segurança. O projeto prioriza simulação por padrão, preservação das relações OCI, decisões auditáveis, privilégio mínimo e integridade da cadeia de suprimentos.

> Status: handoff / pré-implementação. Este pacote contém documentação e planejamento; o código será iniciado após a revisão arquitetural.

## Identidade

- Repositório: `Tooark/arklean`
- Nome no Marketplace: `Arklean - Secure GHCR Cleanup`
- Licença: Apache-2.0
- Linguagem principal: TypeScript
- Distribuição: GitHub Action JavaScript empacotada em bundle único
- Modo padrão: `dry-run`

## Objetivos

- Aplicar retenção no GHCR sem depender, em runtime, de actions de limpeza de terceiros.
- Preservar tags protegidas, índices OCI, manifests de plataforma, assinaturas, atestados e SBOMs mantidos.
- Explicar cada decisão de retenção ou exclusão.
- Impor limites de segurança antes de operações destrutivas.
- Suportar pacotes pertencentes a organizações e usuários.

## Fora do escopo da V1

- Registries diferentes do GHCR.
- Exclusão de repositórios, releases, artifacts ou caches.
- Remoção isolada de tags, pois a unidade da API é a versão do pacote.
- Varredura de vulnerabilidades.

## Próximo passo

Revisar as ADRs, validar fixtures reais anonimizadas do GHCR e usar o prompt em `prompts/CLAUDE-CODE-BOOTSTRAP.md` para iniciar o scaffold.

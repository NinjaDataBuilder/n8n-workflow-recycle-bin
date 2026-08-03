# Guia de instalação

## Alvo suportado

A primeira versão suporta n8n self-hosted `2.32.x` executando com Docker Compose. O instalador recusa outra linha de versão antes de montar hooks, alterar proxy ou iniciar o sidecar.

O sidecar é instalado ao lado do stack existente do n8n. Ele não substitui o Compose principal e não publica uma porta no host por padrão.

## Pré-requisitos

- Docker Engine e plugin Docker Compose;
- diretório Compose existente do n8n contendo `docker-compose.yml`;
- versão exata do n8n em execução;
- nome da rede Docker existente compartilhada com o n8n;
- URL interna do n8n acessível nessa rede;
- arquivo local do hook-token com permissão `600`;
- local de backup gravável pelo instalador.

O CLI nunca pede nem imprime o valor do hook-token.

## Instalação recomendada pelo CLI

Após a publicação pública, o fluxo será:

```bash
npx @ninjadatabuilder/n8n-workflow-recycle-bin install \
  --target /opt/n8n/compose \
  --version 0.1.2 \
  --n8n-version 2.32.5 \
  --network n8n_default \
  --n8n-internal-url http://n8n:5678 \
  --hook-token-file /opt/n8n/secrets/recycle-bin-hook-token \
  --dry-run
```

Revise o plano JSON. Remova `--dry-run` para preparar e validar. Adicione `--start` somente depois de revisar a rede, a configuração dos hooks e o rollback.

O CLI baixa o tarball da release no GitHub, verifica o SHA-256, executa o preflight de compatibilidade, cria backup, grava um arquivo de ambiente com modo `600`, valida o Compose do sidecar e, opcionalmente, baixa/inicia somente o sidecar.

## Rollback e desinstalação

Cada substituição é preservada em:

```text
<target>/.recycle-bin-backups/<timestamp>/workflow-recycle-bin
```

Se a validação do Compose ou o início explícito do sidecar falhar, o CLI remove o candidato e restaura o bundle anterior. O volume de auditoria não é removido por rollback nem pela desinstalação normal.

```bash
npx @ninjadatabuilder/n8n-workflow-recycle-bin uninstall \
  --target /opt/n8n/compose \
  --confirm
```

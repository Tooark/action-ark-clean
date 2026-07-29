import { appendFile, writeFile } from "node:fs/promises";

/**
 * Lê um input da action a partir de `INPUT_<NOME>`, com trim.
 * @param name Nome do input a ser lido.
 * @param required Se `true`, lança erro se o input estiver ausente ou vazio.
 * @returns Valor textual do input, possivelmente vazio.
 * @throws Erro se `required` e o valor estiver ausente ou vazio.
 */
export function input(name: string, required = false): string {
  const key = `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
  const v = process.env[key]?.trim() ?? "";

  if (required && !v) {
    throw new Error(`Missing required input: ${name}`);
  }

  return v;
}

/**
 * Registra um valor sensível para mascaramento nos logs do GitHub Actions.
 * @param value Valor sensível a ser mascarado.
 */
export function mask(value: string): void {
  if (value) {
    process.stdout.write(`::add-mask::${value}\n`);
  }
}

/**
 * Emite log informativo.
 * @param message Mensagem a ser registrada.
 * @remarks Remove CR/LF das mensagens: uma quebra de linha injetada
 * poderia forjar comandos de workflow (`::...::`) no log.
 */
export function info(message: string): void {
  console.log(message.replace(/[\r\n]+/g, " "));
}

/**
 * Emite warning no formato de comando do GitHub Actions.
 * @param message Mensagem de warning a ser registrada.
 * @remarks Remove CR/LF das mensagens: uma quebra de linha injetada
 * poderia forjar comandos de workflow (`::...::`) no log.
 */
export function warning(message: string): void {
  console.log(`::warning::${message.replace(/[\r\n]+/g, " ")}`);
}

/**
 * Marca a execução como falha (`exitCode = 1`) sem interromper o fluxo imediatamente.
 * @param message Mensagem de erro a ser registrada.
 * @remarks Remove CR/LF das mensagens: uma quebra de linha injetada
 * poderia forjar comandos de workflow (`::...::`) no log.
 */
export function fail(message: string): void {
  process.exitCode = 1;
  console.error(`::error::${message.replace(/[\r\n]+/g, " ")}`);
}

/**
 * Publica output da action em `GITHUB_OUTPUT` usando o formato heredoc com
 * delimitador fixo, imune a valores contendo `=` ou quebras de linha.
 * Fora do runner, faz fallback para o console.
 * @param name Nome do output a ser publicado.
 * @param value Valor do output a ser publicado.
 * @remarks O delimitador `ARKLEAN_EOF` é fixo e não pode aparecer no valor.
 */
export async function output(name: string, value: string | number): Promise<void> {
  const f = process.env.GITHUB_OUTPUT;
  if (f) {
    await appendFile(f, `${name}<<ARKLEAN_EOF\n${value}\nARKLEAN_EOF\n`);
  } else {
    console.log(`OUTPUT ${name}=${value}`);
  }
}

/**
 * Acrescenta markdown ao resumo da etapa quando `GITHUB_STEP_SUMMARY` estiver definido.
 * @param markdown Markdown a ser acrescentado ao resumo.
 */
export async function summary(markdown: string): Promise<void> {
  const f = process.env.GITHUB_STEP_SUMMARY;
  if (f) {
    await appendFile(f, markdown);
  }
}

/**
 * Persiste um arquivo UTF-8 com permissão restrita ao usuário atual (0600).
 * @param path Caminho do arquivo a ser salvo.
 * @param data Conteúdo a ser salvo no arquivo.
 */
export async function save(path: string, data: string): Promise<void> {
  await writeFile(path, data, { encoding: "utf8", mode: 0o600 });
}

/**
 * Lê um input da action a partir de `INPUT_<NOME>`, com trim.
 * @param name Nome do input a ser lido.
 * @param required Se `true`, lança erro se o input estiver ausente ou vazio.
 * @returns Valor textual do input, possivelmente vazio.
 * @throws Erro se `required` e o valor estiver ausente ou vazio.
 */
export declare function input(name: string, required?: boolean): string;
/**
 * Registra um valor sensível para mascaramento nos logs do GitHub Actions.
 * @param value Valor sensível a ser mascarado.
 */
export declare function mask(value: string): void;
/**
 * Emite log informativo.
 * @param message Mensagem a ser registrada.
 * @remarks Remove CR/LF das mensagens: uma quebra de linha injetada
 * poderia forjar comandos de workflow (`::...::`) no log.
 */
export declare function info(message: string): void;
/**
 * Emite warning no formato de comando do GitHub Actions.
 * @param message Mensagem de warning a ser registrada.
 * @remarks Remove CR/LF das mensagens: uma quebra de linha injetada
 * poderia forjar comandos de workflow (`::...::`) no log.
 */
export declare function warning(message: string): void;
/**
 * Marca a execução como falha (`exitCode = 1`) sem interromper o fluxo imediatamente.
 * @param message Mensagem de erro a ser registrada.
 * @remarks Remove CR/LF das mensagens: uma quebra de linha injetada
 * poderia forjar comandos de workflow (`::...::`) no log.
 */
export declare function fail(message: string): void;
/**
 * Publica output da action em `GITHUB_OUTPUT` usando o formato heredoc com
 * delimitador fixo, imune a valores contendo `=` ou quebras de linha.
 * Fora do runner, faz fallback para o console.
 * @param name Nome do output a ser publicado.
 * @param value Valor do output a ser publicado.
 * @remarks O delimitador `ARKLEAN_EOF` é fixo e não pode aparecer no valor.
 */
export declare function output(name: string, value: string | number): Promise<void>;
/**
 * Acrescenta markdown ao resumo da etapa quando `GITHUB_STEP_SUMMARY` estiver definido.
 * @param markdown Markdown a ser acrescentado ao resumo.
 */
export declare function summary(markdown: string): Promise<void>;
/**
 * Persiste um arquivo UTF-8 com permissão restrita ao usuário atual (0600).
 * @param path Caminho do arquivo a ser salvo.
 * @param data Conteúdo a ser salvo no arquivo.
 */
export declare function save(path: string, data: string): Promise<void>;

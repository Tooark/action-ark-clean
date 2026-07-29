import type { Config, Rule } from "./types.js";
/**
 * Analisa regras de tags de uma string multilinha: cada linha é uma correspondência
 * exata ou uma regex delimitada por `/.../`; linhas vazias e comentários `#` são ignorados.
 * Limites de 50 regras e 256 caracteres por regra contêm inputs abusivos.
 * @param value Valor textual do input.
 * @returns Lista de regras de tags.
 * @throws Erro se alguma regra for inválida ou exceder os limites.
 */
export declare function rules(value: string): Rule[];
/**
 * Carrega e valida todos os inputs da action antes de qualquer acesso à rede,
 * retornando uma configuração tipada.
 * @returns Configuração completa da action.
 * @throws Erro se algum input for inválido ou ausente.
 */
export declare function loadConfig(): Config;

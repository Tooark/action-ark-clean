import { cp, mkdir, rm } from "node:fs/promises";

// Remove o diretório "dist" de forma recursiva e forçada, garantindo que qualquer conteúdo existente seja excluído antes de criar um novo diretório.
await rm("dist", { recursive: true, force: true });

// Cria o diretório "dist" de forma recursiva, garantindo que todos os diretórios pai necessários sejam criados.
await mkdir("dist", { recursive: true });

// Copia o conteúdo do diretório ".build" para o diretório "dist" de forma recursiva, preservando a estrutura de diretórios e arquivos.
await cp(".build", "dist", { recursive: true });

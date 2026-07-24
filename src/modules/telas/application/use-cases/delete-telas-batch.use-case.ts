import { AppError } from "../../../../shared/domain/errors/app-error.js";
import { ITelasRepository } from "../contracts/telas.repository.js";

const normalizeCodes = (raw: unknown): string[] => {
  const values = Array.isArray(raw) ? raw : [raw];
  return [...new Set(values
    .flatMap((value) => String(value ?? "").split("/"))
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean))];
};

export class DeleteTelasBatchUseCase {
  constructor(private readonly telasRepository: ITelasRepository) {}

  async execute(codigosRaw: unknown, usuario: string) {
    if (!usuario) {
      throw new AppError(400, "USUARIO_OBRIGATORIO", "Usuário autenticado não informado");
    }

    const codigos = normalizeCodes(codigosRaw);
    if (codigos.length < 2) {
      throw new AppError(400, "TELAS_INSUFICIENTES", "Selecione pelo menos duas telas para uma ação em lote");
    }

    const excluidas = await this.telasRepository.deleteBatch(codigos, usuario);
    return { excluidas };
  }
}

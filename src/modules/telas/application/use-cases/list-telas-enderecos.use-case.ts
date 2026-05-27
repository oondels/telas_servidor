import { ITelasEnderecosRepository } from "../contracts/telas-enderecos.repository.js";
import { TelaEndereco } from "../../domain/tela-endereco.js";

export class ListTelasEnderecosUseCase {
  constructor(private readonly repository: ITelasEnderecosRepository) {}

  async execute(): Promise<TelaEndereco[]> {
    const list = await this.repository.listAll();
    const result: TelaEndereco[] = [];

    for (const item of list) {
      const occupied = await this.repository.countOccupiedVagas(item.address);
      result.push({
        ...item,
        ocupadas: occupied,
      });
    }

    return result;
  }
}

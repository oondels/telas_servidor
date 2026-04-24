import { ITelasRepository } from "../contracts/telas.repository.js";
import { SearchTelasInput } from "../dtos/tela.dto.js";

export class SearchTelasUseCase {
  constructor(private readonly telasRepository: ITelasRepository) {}

  execute(input: SearchTelasInput) {
    return this.telasRepository.search(input);
  }
}

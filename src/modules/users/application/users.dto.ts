import { UserRole } from "../domain/user-role.js";

export interface SearchUsersInput {
  search?: string;
  role?: UserRole | null;
  active?: boolean | null;
  page: number;
  itemsPerPage: number;
}

export interface CreateUserInput {
  matricula: number;
  nome?: string | null;
  usuario?: string | null;
  setor?: string | null;
  unidade?: string | null;
  role: UserRole;
  active?: boolean;
}

export interface UpdateUserInput extends Partial<CreateUserInput> {}

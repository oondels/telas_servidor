import { UserRole } from "./user-role.js";

export interface AppUser {
  id: string;
  matricula: number;
  nome: string | null;
  usuario: string | null;
  setor: string | null;
  unidade: string | null;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

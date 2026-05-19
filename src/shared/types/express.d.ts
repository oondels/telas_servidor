import { JwtPayload } from "jsonwebtoken";
import { AppUser } from "../../modules/users/domain/app-user.js";

export interface AuthenticatedUser extends JwtPayload {
  id?: string;
  usuario?: string;
  codbarras?: string;
  rfid?: string;
  matricula?: string;
  setor?: string;
  nivel?: string;
  unidade?: string;
  funcao?: string;
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: AuthenticatedUser;
      appUser?: AppUser;
    }
  }
}

export {};

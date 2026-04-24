import { JwtPayload } from "jsonwebtoken";

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
    }
  }
}

export {};

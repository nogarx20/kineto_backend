
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'super-secret-key';
const EXPIRES_IN = '8h';

export interface TokenPayload {
  id: string;
  company_id: string;
  email: string;
}

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, SECRET) as TokenPayload;
};

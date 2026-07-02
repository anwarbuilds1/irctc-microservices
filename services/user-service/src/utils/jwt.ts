import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

export const signToken = (
  payload: TokenPayload,
  expiresIn: jwt.SignOptions["expiresIn"] = "1d",
): string => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn } as jwt.SignOptions);
};


export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
};

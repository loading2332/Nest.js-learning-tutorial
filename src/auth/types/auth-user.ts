import { UserRole } from '../../generated/client';

export type JwtPayload = {
  sub: number;
  email: string;
  role: UserRole;
};

export type AuthUser = {
  id: number;
  email: string;
  role: UserRole;
};

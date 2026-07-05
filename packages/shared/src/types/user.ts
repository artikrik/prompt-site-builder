export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export const UserRole = {
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

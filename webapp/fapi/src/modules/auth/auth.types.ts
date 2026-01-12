/**
 * Типы для модуля авторизации
 */

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
    name: string | null;
    roles: string[];
  };
}

export interface UserWithRoles {
  id: number;
  username: string | null;
  email: string | null;
  name: string | null;
  status: boolean | null;
  roles: Array<{
    id: number;
    name: string;
    title: string | null;
  }>;
}

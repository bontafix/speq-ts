/**
 * Типы для модуля Users
 */

export interface User {
  id: number;
  username: string | null;
  email: string | null;
  name: string | null;
  status: boolean | null;
  limit_document: number | null;
  limit_size_pdf: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithRoles extends User {
  roles: Array<{
    id: number;
    name: string;
    title: string | null;
  }>;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  name?: string;
  status?: boolean;
  limit_document?: number;
  limit_size_pdf?: number;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  name?: string;
  status?: boolean;
  limit_document?: number;
  limit_size_pdf?: number;
}

export interface AssignRoleRequest {
  roleId: number;
}

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prompt-site-builder/shared';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // When RolesGuard runs as global APP_GUARD, it fires before controller-level
    // JwtAuthGuard — user may not be attached yet. Let JwtAuthGuard handle auth;
    // this guard only enforces role when user is already on the request.
    if (!user) {
      return true;
    }

    return requiredRoles.some((role) => user.role === role);
  }
}

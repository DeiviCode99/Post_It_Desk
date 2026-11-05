import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Exige el encabezado `x-api-token` en cada petición. Aunque el servidor solo
 * escucha en 127.0.0.1, esto evita que otros programas del equipo lean o
 * modifiquen tus notas.
 */
@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(
    private readonly config: AppConfig,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || !this.config.apiToken) return true;

    const received = context.switchToHttp().getRequest<Request>().header('x-api-token') ?? '';
    if (!this.tokensMatch(received, this.config.apiToken)) {
      throw new UnauthorizedException('Token de API inválido');
    }
    return true;
  }

  /** Comparación en tiempo constante para no filtrar el token por tiempos de respuesta. */
  private tokensMatch(received: string, expected: string): boolean {
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

/** Electron consulta esta ruta para saber cuándo el backend ya está listo. */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }
}

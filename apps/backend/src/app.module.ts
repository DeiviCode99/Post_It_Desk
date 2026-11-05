import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiTokenGuard } from './common/guards/api-token.guard';
import type { AppConfigValues } from './config/app-config';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { NotesModule } from './modules/notes/notes.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { TagsModule } from './modules/tags/tags.module';

/** Módulos de negocio que no dependen de cómo se conecta la base de datos. */
export const FEATURE_MODULES = [HealthModule, TagsModule, NotesModule, RemindersModule];

/** Raíz del monolito modular: infraestructura + módulos de negocio + guard global. */
@Module({})
export class AppModule {
  static forRoot(config: Partial<AppConfigValues> = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(config), DatabaseModule, ...FEATURE_MODULES],
      providers: [{ provide: APP_GUARD, useClass: ApiTokenGuard }],
    };
  }
}

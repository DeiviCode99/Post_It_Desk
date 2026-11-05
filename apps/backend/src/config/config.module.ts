import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_CONFIG_VALUES, AppConfig, type AppConfigValues } from './app-config';

/** Expone AppConfig a toda la aplicación sin tener que importarlo en cada módulo. */
@Global()
@Module({ providers: [AppConfig], exports: [AppConfig] })
export class ConfigModule {
  /** Variante con valores explícitos; los que falten se leen del entorno. */
  static forRoot(values: Partial<AppConfigValues> = {}): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG_VALUES, useValue: values }, AppConfig],
      exports: [AppConfig],
    };
  }
}

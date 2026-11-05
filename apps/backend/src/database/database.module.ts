import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { AppConfig } from '../config/app-config';
import { ChecklistItem } from '../modules/notes/entities/checklist-item.entity';
import { Note } from '../modules/notes/entities/note.entity';
import { Tag } from '../modules/tags/entities/tag.entity';
import { InitialSchema1730419200000 } from './migrations/1730419200000-InitialSchema';

/** Entidades registradas en el ORM; se exporta para reutilizarla en tests. */
export const ENTITIES = [Note, ChecklistItem, Tag];
export const MIGRATIONS = [InitialSchema1730419200000];

/**
 * Conexión SQLite vía sql.js (WebAssembly): no requiere compilar módulos
 * nativos en Windows. `autoSave` vuelca la base al archivo tras cada escritura
 * y las migraciones se aplican al arrancar.
 */
@Module({
  imports: [
    // AppConfig llega del ConfigModule global.
    TypeOrmModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        mkdirSync(dirname(config.databasePath), { recursive: true });
        return {
          type: 'sqljs',
          location: config.databasePath,
          autoSave: true,
          entities: ENTITIES,
          migrations: MIGRATIONS,
          migrationsRun: true,
          synchronize: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}

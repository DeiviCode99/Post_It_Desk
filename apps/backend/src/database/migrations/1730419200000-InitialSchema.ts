import { MigrationInterface, QueryRunner } from 'typeorm';

/** Esquema inicial: notas, subtareas, etiquetas y la tabla puente nota↔etiqueta. */
export class InitialSchema1730419200000 implements MigrationInterface {
  name = 'InitialSchema1730419200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const audit = `"id" varchar PRIMARY KEY NOT NULL,
      "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
      "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))`;

    await queryRunner.query(`CREATE TABLE "tags" (${audit},
      "name" varchar(40) NOT NULL,
      "color" varchar(7) NOT NULL DEFAULT ('#8EC5FF'),
      CONSTRAINT "UQ_tags_name" UNIQUE ("name"))`);

    await queryRunner.query(`CREATE TABLE "notes" (${audit},
      "title" varchar(120) NOT NULL,
      "body" text NOT NULL DEFAULT (''),
      "priority" varchar CHECK("priority" IN ('none','low','medium','high')) NOT NULL DEFAULT ('none'),
      "dueAt" datetime,
      "remindAt" datetime,
      "reminderSentAt" datetime,
      "done" boolean NOT NULL DEFAULT (0),
      "position" integer NOT NULL DEFAULT (0))`);

    await queryRunner.query(`CREATE TABLE "checklist_items" (${audit},
      "text" varchar(200) NOT NULL,
      "done" boolean NOT NULL DEFAULT (0),
      "position" integer NOT NULL DEFAULT (0),
      "noteId" varchar,
      CONSTRAINT "FK_checklist_items_note" FOREIGN KEY ("noteId")
        REFERENCES "notes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);

    await queryRunner.query(`CREATE TABLE "note_tags" (
      "noteId" varchar NOT NULL,
      "tagId" varchar NOT NULL,
      PRIMARY KEY ("noteId", "tagId"),
      CONSTRAINT "FK_note_tags_note" FOREIGN KEY ("noteId") REFERENCES "notes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FK_note_tags_tag" FOREIGN KEY ("tagId") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);

    await queryRunner.query(`CREATE INDEX "IDX_note_tags_note" ON "note_tags" ("noteId")`);
    await queryRunner.query(`CREATE INDEX "IDX_note_tags_tag" ON "note_tags" ("tagId")`);
    await queryRunner.query(`CREATE INDEX "IDX_notes_remindAt" ON "notes" ("remindAt")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "note_tags"`);
    await queryRunner.query(`DROP TABLE "checklist_items"`);
    await queryRunner.query(`DROP TABLE "notes"`);
    await queryRunner.query(`DROP TABLE "tags"`);
  }
}

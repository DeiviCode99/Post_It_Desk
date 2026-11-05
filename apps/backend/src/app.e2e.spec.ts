import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { FEATURE_MODULES } from './app.module';
import { configureApp } from './app.setup';
import { ApiTokenGuard } from './common/guards/api-token.guard';
import { ConfigModule } from './config/config.module';
import { ENTITIES, MIGRATIONS } from './database/database.module';

const TOKEN = 'token-de-prueba';

/**
 * Prueba la API completa contra una base sql.js en memoria, aplicando las
 * migraciones reales para detectar desajustes entre entidades y esquema.
 */
describe('API de notas (e2e)', () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.API_TOKEN = TOKEN;
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule,
        TypeOrmModule.forRoot({
          type: 'sqljs',
          entities: ENTITIES,
          migrations: MIGRATIONS,
          migrationsRun: true,
          synchronize: false,
        }),
        ...FEATURE_MODULES,
      ],
      providers: [{ provide: APP_GUARD, useClass: ApiTokenGuard }],
    }).compile();

    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.API_TOKEN;
  });

  it('rechaza peticiones sin token pero deja pasar /health', async () => {
    await api().get('/api/notes').expect(401);
    await api().get('/api/health').expect(200, { status: 'ok' });
  });

  it('crea, edita y borra una nota con etiquetas y checklist', async () => {
    const tag = await api()
      .post('/api/tags')
      .set('x-api-token', TOKEN)
      .send({ name: 'Universidad', color: '#8EC5FF' })
      .expect(201);

    const created = await api()
      .post('/api/notes')
      .set('x-api-token', TOKEN)
      .send({
        title: 'Parcial de Sistemas Operacionales',
        priority: 'high',
        dueAt: '2026-11-05T14:00:00.000Z',
        tagIds: [tag.body.id],
        checklist: [{ text: 'Repasar caché' }, { text: 'Hacer taller' }],
      })
      .expect(201);

    expect(created.body.tags).toHaveLength(1);
    expect(created.body.checklist.map((i: { text: string }) => i.text)).toEqual([
      'Repasar caché',
      'Hacer taller',
    ]);

    const [first] = created.body.checklist;
    const updated = await api()
      .patch(`/api/notes/${created.body.id}`)
      .set('x-api-token', TOKEN)
      .send({ done: true, checklist: [{ id: first.id, text: first.text, done: true }] })
      .expect(200);

    expect(updated.body.done).toBe(true);
    expect(updated.body.checklist).toHaveLength(1);
    expect(updated.body.checklist[0]).toMatchObject({ id: first.id, done: true });

    await api().delete(`/api/notes/${created.body.id}`).set('x-api-token', TOKEN).expect(204);
    await api().get(`/api/notes/${created.body.id}`).set('x-api-token', TOKEN).expect(404);
  });

  it('valida los datos de entrada', async () => {
    await api()
      .post('/api/notes')
      .set('x-api-token', TOKEN)
      .send({ title: '', priority: 'urgentísima' })
      .expect(400);
  });

  it('entrega recordatorios vencidos una sola vez', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const note = await api()
      .post('/api/notes')
      .set('x-api-token', TOKEN)
      .send({ title: 'Llamar al profe', remindAt: past })
      .expect(201);

    const due = await api().get('/api/reminders/due').set('x-api-token', TOKEN).expect(200);
    expect(due.body.map((n: { id: string }) => n.id)).toContain(note.body.id);

    await api().post(`/api/reminders/${note.body.id}/ack`).set('x-api-token', TOKEN).expect(204);
    const after = await api().get('/api/reminders/due').set('x-api-token', TOKEN).expect(200);
    expect(after.body.map((n: { id: string }) => n.id)).not.toContain(note.body.id);
  });
});

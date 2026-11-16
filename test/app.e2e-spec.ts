import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

// Valeurs factices : aucun appel réseau n'est fait pour ces tests (routes publiques / refus sans jeton).
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon-test-key';

import { AppModule } from './../src/app.module';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health est public', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
      });
  });

  it.each([
    '/api/v1/employees',
    '/api/v1/payrolls',
    '/api/v1/auth/me',
    '/api/v1/pdf/payslip/6f1d6b0e-1c1a-4a6e-9a55-0d4b1f0e6a11',
  ])('GET %s sans jeton => 401', (path) =>
    request(app.getHttpServer()).get(path).expect(401),
  );

  it('refuse le jeton factice « dev-token » => 401', () => {
    return request(app.getHttpServer())
      .get('/api/v1/employees')
      .set('Authorization', 'Bearer dev-token')
      .expect(401);
  });

  it("l'ancienne route de connexion factice n'existe plus", () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'x@y.z' })
      .expect(404);
  });
});

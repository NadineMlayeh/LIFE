import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('rejects login with unknown credentials', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrongpassword' })
      .expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});

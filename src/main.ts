import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions/all-exceptions.filter';
import { ConfigService } from '@nestjs/config';
import { apiReference } from '@scalar/nestjs-api-reference';
import { applyBigIntSerializers } from './common/utils/bigint.util';
import { MediaUtils } from './common/utils/media.utils';
async function bootstrap() {
  applyBigIntSerializers();
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);
  const httpAdapter = app.get(HttpAdapterHost);

  // Initialize MediaUtils with configured public URL
  const minioPublicUrl = configService.get<string>(
    'minio.publicUrl',
    'http://localhost:9000/smartiv-media',
  );
  MediaUtils.configure(minioPublicUrl);

  // Global Settings
  app.setGlobalPrefix('api');
  app.enableCors();

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global Interceptor & Filter
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  // -----------------------------------------------------------
  // 📄 DOCUMENTATION SETUP (Scalar UI)
  // -----------------------------------------------------------
  const config = new DocumentBuilder()
    .setTitle('SmartIV Ads API')
    .setDescription('Enterprise Backend for SmartIV Hospitality TV Ads')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  // 2. Generate JSON Spec dari NestJS Swagger
  const document = SwaggerModule.createDocument(app, config);

  // 3. Render UI menggunakan Scalar
  app.use(
    '/reference',
    apiReference({
      // PERBAIKAN: Langsung gunakan 'content' tanpa wrapper 'spec'
      content: document,
      theme: 'purple',
    }),
  );

  // Start Server
  const port = configService.get<number>('port') || 3000;
  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}/api`);
  logger.log(
    `📚 API Reference (Scalar) at: http://localhost:${port}/reference`,
  );
}
void bootstrap();

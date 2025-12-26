import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions/all-exceptions.filter';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);
  const httpAdapter = app.get(HttpAdapterHost);

  // Global Settings
  app.setGlobalPrefix('api');
  app.enableCors(); // Penting untuk frontend nanti

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

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('SmartIV Ads API')
    .setDescription('Enterprise Backend for SmartIV Hospitality TV Ads')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start Server
  const port = configService.get<number>('port') || 3000;
  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}/api`);
  logger.log(`📄 Swagger Docs available at: http://localhost:${port}/api/docs`);
}
bootstrap();

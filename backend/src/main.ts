import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable Zod Validation globally
  app.useGlobalPipes(new ZodValidationPipe());

  // Enable CORS for development
  app.enableCors({
    origin: 'http://localhost:4200',
    credentials: true,
  });

  // Setup Swagger
  const config = new DocumentBuilder()
    .setTitle('Stocks Researcher API')
    .setDescription('API documentation for the Stocks Researcher application')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3001);
  console.log(
    `Application is running on: http://localhost:${process.env.PORT ?? 3001}`,
  );
  console.log(
    `Swagger documentation available at: http://localhost:${process.env.PORT ?? 3001}/api`,
  );
}
bootstrap();

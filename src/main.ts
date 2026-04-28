import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import session from "express-session";
import { createClient } from "redis";
import { RedisStore } from "connect-redis";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>("port") ?? 3000;
  const origins = configService.get<string[]>("cors.origins") ?? ["*"];
  const sessionSecret = configService.get<string>("session.secret");
  const sessionTtl = configService.get<number>("session.ttl");

  if (!sessionSecret || !sessionTtl) {
    throw new Error(
      "Missing required session configuration: session.secret and session.ttl",
    );
  }

  // Redis session store
  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
    },
    password: process.env.REDIS_PASSWORD || "",
  });
  redisClient.on("error", (err) => console.error("[Redis]", err));
  await redisClient.connect();

  app.use(
    session({
      store: new RedisStore({ client: redisClient, ttl: sessionTtl }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: sessionTtl * 1000,
      },
    }),
  );

  // Security (Swagger UI 인라인 스크립트 허용)
  app.use(helmet({ contentSecurityPolicy: false }));

  // CORS
  app.enableCors({
    origin: origins.includes("*") ? true : origins,
    credentials: true,
  });

  // Global validation (class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle("K-Statra API")
    .setDescription("K-Statra 백엔드 API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(port);
  console.log(`Server running on port ${port}`);
  console.log(`Swagger: http://localhost:${port}/api/docs`);
}

void bootstrap();

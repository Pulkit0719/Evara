export const ENV = {
  appId: process.env.VITE_APP_ID ?? "uptrail",
  sessionSecret: process.env.SESSION_SECRET ?? process.env.JWT_SECRET ?? "uptrail-default-session-secret-key-change-me",
  cookieSecret: process.env.SESSION_SECRET ?? process.env.JWT_SECRET ?? "uptrail-default-session-secret-key-change-me",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerUserId: process.env.OWNER_USER_ID ? parseInt(process.env.OWNER_USER_ID, 10) : undefined,
  ownerEmail: process.env.OWNER_EMAIL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",

  // Provider-independent AI configuration (OpenAI-compatible, Gemini, Groq, Ollama)
  aiProvider: (process.env.AI_PROVIDER || "openai").toLowerCase(),
  aiBaseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
  aiApiKey: process.env.AI_API_KEY ?? "",
  aiModel: process.env.AI_MODEL ?? "gpt-4o-mini",

  // S3-compatible Object Storage
  s3Endpoint: process.env.S3_ENDPOINT,
  s3Region: process.env.S3_REGION ?? "us-east-1",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",

  // Notifications
  notificationWebhookUrl: process.env.NOTIFICATION_WEBHOOK_URL ?? "",

  // Legacy fallback aliases for backward compatibility during migration
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
};

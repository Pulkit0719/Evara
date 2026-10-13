export const ENV = {
  appId: process.env.VITE_APP_ID ?? "evara",
  sessionSecret: process.env.SESSION_SECRET ?? "evara-default-session-secret-key-change-me",
  cookieSecret: process.env.SESSION_SECRET ?? "evara-default-session-secret-key-change-me",
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

  // Notifications (Webhook)
  notificationWebhookUrl: process.env.NOTIFICATION_WEBHOOK_URL ?? "",

  // Provider-independent Email Configuration (SMTP)
  emailProvider: process.env.EMAIL_PROVIDER ?? "smtp",
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPassword: process.env.SMTP_PASSWORD ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "noreply@evara.app",
};

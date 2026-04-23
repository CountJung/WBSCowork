type RuntimeEnv = {
  appName: string;
  appPort: number;
  uploadDir: string;
  uploadMaxFileSizeMb: number;
  auth: {
    googleClientId?: string;
    googleClientSecret?: string;
    nextAuthSecret?: string;
    nextAuthUrl?: string;
    superuserEmail?: string;
    googleProviderConfigured: boolean;
    superuserConfigured: boolean;
  };
  database: {
    host?: string;
    port: number;
    user?: string;
    password?: string;
    database?: string;
    connectionLimit: number;
    connectTimeoutMs: number;
    configured: boolean;
  };
  logging: {
    directory: string;
    retentionDays: number;
    maxFileSizeMb: number;
  };
};

export type DatabaseEnv = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  connectTimeoutMs: number;
};

let cachedRuntimeEnv: RuntimeEnv | undefined;

function readOptionalEnv(name: string, options?: { allowEmpty?: boolean; trim?: boolean }) {
  const rawValue = process.env[name];

  if (rawValue === undefined) {
    return undefined;
  }

  const value = options?.trim === false ? rawValue : rawValue.trim();

  if (!options?.allowEmpty && value.length === 0) {
    return undefined;
  }

  return value;
}

function readPositiveIntegerEnv(name: string, fallbackValue: number) {
  const rawValue = readOptionalEnv(name);

  if (!rawValue) {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsedValue;
}

export function getRuntimeEnv(): RuntimeEnv {
  if (cachedRuntimeEnv) {
    return cachedRuntimeEnv;
  }

  const googleClientId = readOptionalEnv("GOOGLE_CLIENT_ID");
  const googleClientSecret = readOptionalEnv("GOOGLE_CLIENT_SECRET");
  const nextAuthSecret = readOptionalEnv("NEXTAUTH_SECRET");
  const nextAuthUrl = readOptionalEnv("NEXTAUTH_URL");
  const superuserEmail = readOptionalEnv("SUPERUSER_EMAIL")?.toLowerCase();

  const databaseHost = readOptionalEnv("DB_HOST");
  const databaseUser = readOptionalEnv("DB_USER");
  const databasePassword = readOptionalEnv("DB_PASSWORD", { allowEmpty: true, trim: false });
  const databaseName = readOptionalEnv("DB_NAME");
  const uploadDir = readOptionalEnv("UPLOAD_DIR") ?? "./uploads";
  const uploadMaxFileSizeMb = readPositiveIntegerEnv("UPLOAD_MAX_FILE_SIZE_MB", 20);

  cachedRuntimeEnv = {
    appName: readOptionalEnv("NEXT_PUBLIC_APP_NAME") ?? "WBS Task",
    appPort: readPositiveIntegerEnv("APP_PORT", 3000),
    uploadDir,
    uploadMaxFileSizeMb,
    auth: {
      googleClientId,
      googleClientSecret,
      nextAuthSecret,
      nextAuthUrl,
      superuserEmail,
      googleProviderConfigured: Boolean(googleClientId && googleClientSecret),
      superuserConfigured: Boolean(superuserEmail),
    },
    database: {
      host: databaseHost,
      port: readPositiveIntegerEnv("DB_PORT", 3306),
      user: databaseUser,
      password: databasePassword,
      database: databaseName,
      connectionLimit: readPositiveIntegerEnv("DB_CONNECTION_LIMIT", 5),
      connectTimeoutMs: readPositiveIntegerEnv("DB_CONNECT_TIMEOUT_MS", 10000),
      configured: Boolean(databaseHost && databaseUser && databasePassword !== undefined && databaseName),
    },
    logging: {
      directory: readOptionalEnv("LOG_DIR") ?? "./logs",
      retentionDays: readPositiveIntegerEnv("LOG_RETENTION_DAYS", 5),
      maxFileSizeMb: readPositiveIntegerEnv("LOG_MAX_FILE_SIZE_MB", 100),
    },
  };

  return cachedRuntimeEnv;
}

export function resetRuntimeEnvCache() {
  cachedRuntimeEnv = undefined;
}

export function requireDatabaseEnv(): DatabaseEnv {
  const runtimeEnv = getRuntimeEnv();
  const missingVariables = [
    runtimeEnv.database.host ? undefined : "DB_HOST",
    runtimeEnv.database.user ? undefined : "DB_USER",
    runtimeEnv.database.password !== undefined ? undefined : "DB_PASSWORD",
    runtimeEnv.database.database ? undefined : "DB_NAME",
  ].filter((value): value is string => Boolean(value));

  if (missingVariables.length > 0) {
    throw new Error(`Missing required database environment variables: ${missingVariables.join(", ")}`);
  }

  return {
    host: runtimeEnv.database.host!,
    port: runtimeEnv.database.port,
    user: runtimeEnv.database.user!,
    password: runtimeEnv.database.password!,
    database: runtimeEnv.database.database!,
    connectionLimit: runtimeEnv.database.connectionLimit,
    connectTimeoutMs: runtimeEnv.database.connectTimeoutMs,
  };
}
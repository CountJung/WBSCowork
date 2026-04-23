import type { NextConfig } from "next";

function readPositiveIntegerEnv(name: string, fallbackValue: number) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsedValue;
}

const uploadMaxFileSizeMb = readPositiveIntegerEnv("UPLOAD_MAX_FILE_SIZE_MB", 20);
const serverActionBodySizeLimitMb = uploadMaxFileSizeMb + 2;

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    turbopackFileSystemCacheForDev: false,
    serverActions: {
      bodySizeLimit: `${serverActionBodySizeLimitMb}mb`,
    },
  },
};

export default nextConfig;

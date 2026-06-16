const REQUIRED_ENV = ["MONGO_URI"] as const;

type RequiredEnvName = (typeof REQUIRED_ENV)[number];

function readRequiredEnv(name: RequiredEnvName): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export function getEnv() {
  return {
    mongoUri: readRequiredEnv("MONGO_URI")
  };
}

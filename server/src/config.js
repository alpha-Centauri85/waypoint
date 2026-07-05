import 'dotenv/config';

// Single source of truth for environment config. Read env through this object,
// not process.env directly, so defaults and coercion live in one place.
export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};

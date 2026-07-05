// Applying the schema happens on import of ./index.js (idempotent). This script
// exists so `npm run db:migrate` can create/upgrade the database file on demand,
// e.g. as a first step when deploying to the server.
import { db } from './index.js';

console.log(`Database ready at ${db.name}`);
db.close();

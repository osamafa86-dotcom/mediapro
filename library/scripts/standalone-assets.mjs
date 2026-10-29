// `output: 'standalone'` leaves static assets out of the server bundle; copy them in so
// `node .next/standalone/server.js` serves exactly what production serves (fonts included).
import { cpSync, existsSync } from 'node:fs';
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
if (existsSync('public')) cpSync('public', '.next/standalone/public', { recursive: true });
console.log('standalone assets copied');

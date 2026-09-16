import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // pg opens real sockets; keep it out of the bundle.
  serverExternalPackages: ['pg'],

  // Pin the workspace root. Without this Next walks up looking for a lockfile
  // and can land on one outside the project (a stray package-lock.json in the
  // user's home directory, say), which changes what gets traced into a build.
  outputFileTracingRoot: here,
};

export default nextConfig;

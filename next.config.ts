import type { NextConfig } from "next";
import path from 'node:path';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(process.env.CHESSITO_TARGET==='node'?{
    distDir: '.next-production',
    typescript: {tsconfigPath:'tsconfig.production.json'},
    output: 'standalone' as const,
    webpack(config) {
      config.resolve.alias['chessito-env']=path.resolve('docker/node-env.mjs');
      return config;
    },
  }:{}),
};

export default nextConfig;

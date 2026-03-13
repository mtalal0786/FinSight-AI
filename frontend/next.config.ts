/** @type {import('next').NextConfig} */
const nextConfig = {
  // react-markdown v9+ is ESM-only; transpile it for Next.js
  transpilePackages: ["react-markdown", "remark-gfm", "remark-parse", "unified"],
};

module.exports = nextConfig;
// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import sentry from "@sentry/astro";
import { env } from "node:process";

const buildEnvironment = env;
const sentrySourceMapUploadEnabled =
  buildEnvironment.WORKERS_CI === "1" &&
  buildEnvironment.SENTRY_UPLOAD_SOURCE_MAPS === "true" &&
  Boolean(buildEnvironment.SENTRY_PRODUCTION_BRANCH) &&
  buildEnvironment.WORKERS_CI_BRANCH === buildEnvironment.SENTRY_PRODUCTION_BRANCH &&
  Boolean(buildEnvironment.SENTRY_AUTH_TOKEN);

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [
    react(),
    sitemap(),
    sentry({
      enabled: { client: true, server: false },
      org: buildEnvironment.SENTRY_ORG,
      project: buildEnvironment.SENTRY_PROJECT,
      authToken: sentrySourceMapUploadEnabled ? buildEnvironment.SENTRY_AUTH_TOKEN : undefined,
      sourcemaps: { disable: !sentrySourceMapUploadEnabled },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      PUBLIC_SUPABASE_URL: envField.string({ context: "client", access: "public", optional: true }),
      PUBLIC_SUPABASE_ANON_KEY: envField.string({ context: "client", access: "public", optional: true }),
      PUBLIC_SENTRY_DSN: envField.string({ context: "client", access: "public", optional: true }),
    },
  },
});

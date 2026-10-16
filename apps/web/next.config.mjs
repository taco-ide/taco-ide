import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Self-contained server bundle for Docker (.next/standalone).
    output: "standalone",
    // In a monorepo, trace the workspace root so hoisted node_modules are
    // copied into the standalone output; without this the bundle is incomplete
    // and crashes at runtime.
    outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "avatars.githubusercontent.com",
                port: "",
                pathname: "/**",
            }
        ]
    }
};

export default withNextIntl(nextConfig);

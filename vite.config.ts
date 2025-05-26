import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import StringReplace from "vite-plugin-string-replace";
import type { LibraryFormats } from "vite";

type BuildFormat = LibraryFormats;

interface GlobalMap {
    [key: string]: string;
}

const EXTERNAL_DEPENDENCIES = [
    "@elizaos/core",
    "@hashgraph/sdk",
    "@hashgraphonline/standards-agent-kit",
    "@hashgraphonline/standards-sdk",
    "@hashgraphonline/hedera-agent-kit",
    "bignumber.js",
    "dotenv",
    "zod",
];

const GLOBAL_MAP: GlobalMap = {
    "@elizaos/core": "ElizaCore",
    "@hashgraph/sdk": "HederaSDK",
    "@hashgraphonline/standards-agent-kit": "StandardsAgentKit",
    "@hashgraphonline/standards-sdk": "StandardsSDK",
    "@hashgraphonline/hedera-agent-kit": "HederaAgentKit",
    "bignumber.js": "BigNumber",
    dotenv: "Dotenv",
    zod: "Zod",
};

function getOutputDirectory(format: BuildFormat): string {
    if (format === "umd") {
        return "dist/umd";
    }
    if (format === "cjs") {
        return "dist/cjs";
    }
    return "dist/esm";
}

function getTypesOutputDirectory(
    format: BuildFormat,
    outputDir: string
): string {
    if (format === "es") {
        return "dist/types";
    }
    return outputDir;
}

function getFileName(format: BuildFormat): (fmt: string) => string {
    return (fmt: string) => {
        if (format === "umd") {
            return `eliza-plugin-hedera.${fmt}.js`;
        }
        if (format === "cjs") {
            return "index.cjs";
        }
        return "index.js";
    };
}

function isExternalDependency(id: string, format: BuildFormat): boolean {
    if (format === "umd") {
        const umdExternals = [
            "@elizaos/core",
            "@hashgraph/sdk",
            "@hashgraphonline/standards-agent-kit",
            "@hashgraphonline/standards-sdk",
            "@hashgraphonline/hedera-agent-kit",
            "dotenv"
        ];
        return umdExternals.some(dep => id === dep || id.startsWith(`${dep}/`));
    }

    const isExternalPackage = EXTERNAL_DEPENDENCIES.some(
        (dep) => id === dep || id.startsWith(`${dep}/`)
    );

    const isRelativeImport =
        !id.startsWith(".") && !id.startsWith("/") && !id.includes(__dirname);

    return isExternalPackage || isRelativeImport;
}

function getGlobalName(id: string): string {
    return GLOBAL_MAP[id] || id;
}

function createRollupOutput(format: BuildFormat) {
    if (format === "cjs") {
        return {
            exports: "named" as const,
            format: "cjs" as const,
        };
    }

    return {
        globals: getGlobalName,
        preserveModules: format === "es",
        preserveModulesRoot: format === "es" ? "src" : undefined,
        exports: "named" as const,
        inlineDynamicImports: format === "umd",
        name: format === "umd" ? "ElizaPluginHedera" : undefined,
    };
}

export default defineConfig(async () => {
    const format = (process.env.BUILD_FORMAT || "es") as BuildFormat;
    const outputDir = getOutputDirectory(format);

    const plugins = [
        StringReplace([
            {
                search: "VITE_BUILD_FORMAT",
                replace: format,
            },
        ]),
        dts({
            insertTypesEntry: true,
            include: ["src/**/*.ts"],
            exclude: ["**/*.d.ts", "tests/**/*", "vite.config.ts"],
            outDir: getTypesOutputDirectory(format, outputDir),
        }),
    ];

    if (format === "umd") {
        const { nodePolyfills } = await import("vite-plugin-node-polyfills");
        plugins.push(
            nodePolyfills({
                globals: {
                    Buffer: true,
                    global: true,
                    process: true,
                },
                protocolImports: true,
            })
        );
    }

    const defineConfig: Record<string, string> = {
        VITE_BUILD_FORMAT: JSON.stringify(format),
    };

    if (format === "cjs") {
        defineConfig.Buffer = "globalThis.Buffer";
    }

    return {
        plugins,
        resolve: {
            alias: {
                "@": resolve(__dirname, "src"),
                util: "util",
            },
        },
        build: {
            outDir: outputDir,
            lib: {
                entry: resolve(__dirname, "src/index.ts"),
                name: format === "umd" ? "ElizaPluginHedera" : undefined,
                fileName: getFileName(format),
                formats: [format],
            },
            rollupOptions: {
                external: (id: string) => isExternalDependency(id, format),
                output: createRollupOutput(format),
            },
            minify: "terser" as const,
            sourcemap: true,
            target: "es2020",
        },
        define: defineConfig,
        ssr: {
            noExternal: [],
            external: EXTERNAL_DEPENDENCIES,
        },
    };
});
 
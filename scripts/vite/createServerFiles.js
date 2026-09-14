async function buildServerFiles() {
    console.log("Building server files with Vite in parallel...")

    const { build } = await import("vite")
    const { getServerViteConfig, servers } = await import("../../config/building/vite.config.servers.mjs")
    const isProduction = (process.env.NODE_ENV || "production") === "production"

    const serverNames = Object.keys(servers)
    try {
        await Promise.all(
            serverNames.map(async (server) => {
                const config = getServerViteConfig(server, isProduction)
                await build({
                    ...config,
                    configFile: false,
                    logLevel: "warn"
                })
                console.log(`${server} built successfully!`)
            })
        )
        console.log("\nAll servers built successfully!")
    } catch (err) {
        console.error("\nServer build failed:", err)
        process.exit(1)
    }
}

buildServerFiles()

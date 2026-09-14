async function startServerWatch() {
    console.log("Starting server watch mode...")

    const { build } = await import("vite")
    const { getServerViteConfig, servers } = await import("../../config/building/vite.config.servers.mjs")
    const serverNames = Object.keys(servers)

    const watchers = await Promise.all(
        serverNames.map(async (server) => {
            console.log(`Starting watch for ${server}...`)
            const config = getServerViteConfig(server, false)
            return build({
                ...config,
                configFile: false,
                build: {
                    ...config.build,
                    watch: {}
                },
                logLevel: "warn"
            })
        })
    )

    const cleanup = () => {
        console.log("\nShutting down server watches...")
        watchers.forEach((watcher) => {
            if (watcher && typeof watcher.close === "function") {
                watcher.close()
            }
        })
        process.exit(0)
    }

    process.on("SIGINT", cleanup)
    process.on("SIGTERM", cleanup)
}

startServerWatch()

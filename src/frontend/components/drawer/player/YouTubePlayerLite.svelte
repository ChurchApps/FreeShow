<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from "svelte"
    import "lite-youtube-embed/src/lite-yt-embed.css"
    import "lite-youtube-embed/src/lite-yt-embed.js"

    export let videoId: string
    export let options: any = {}

    let liteYTElem: any
    let player: any = null
    let stateCheckInterval: any = null

    const dispatch = createEventDispatcher()

    onMount(async () => {
        // Wait for the lite-youtube element to be defined
        if (!customElements.get("lite-youtube")) {
            await customElements.whenDefined("lite-youtube")
        }

        // Wait for the element to be in the DOM
        await new Promise(resolve => setTimeout(resolve, 100))

        if (liteYTElem) {
            // Auto-activate if autoplay is enabled
            if (options.playerVars?.autoplay === 1) {
                setTimeout(async () => {
                    await initializePlayer()
                }, 200)
            }
        }
    })

    async function initializePlayer() {
        try {
            // Call getYTPlayer which activates the player if not already activated
            player = await liteYTElem.getYTPlayer()

            // Verify player has the expected methods
            if (player && player.getPlayerState && player.playVideo) {
                onPlayerReady()
            }
        } catch (e) {
            console.error("Error getting YT player:", e)
        }
    }

    onDestroy(() => {
        if (stateCheckInterval) {
            clearInterval(stateCheckInterval)
            stateCheckInterval = null
        }
        player = null
    })

    function onPlayerReady() {
        if (!player) return

        // Listen to state changes
        if (stateCheckInterval) clearInterval(stateCheckInterval)

        let lastState = -1
        stateCheckInterval = setInterval(() => {
            if (player && player.getPlayerState) {
                try {
                    const state = player.getPlayerState()
                    if (state !== lastState) {
                        lastState = state
                        handleStateChange({ data: state })
                    }
                } catch (e) {
                    // Player might not be ready yet
                }
            }
        }, 500)

        dispatch("ready", { target: player })
    }

    function handleStateChange(event: any) {
        dispatch("stateChange", event)

        const PlayerState = {
            UNSTARTED: -1,
            ENDED: 0,
            PLAYING: 1,
            PAUSED: 2,
            BUFFERING: 3,
            CUED: 5
        }

        switch (event.data) {
            case PlayerState.ENDED:
                dispatch("end", event)
                break
            case PlayerState.PLAYING:
                dispatch("play", event)
                break
            case PlayerState.PAUSED:
                dispatch("pause", event)
                break
        }
    }

    // Build params string from options
    $: params = buildParams(options)
    function buildParams(opts: any) {
        const params = new URLSearchParams()

        // Add origin parameter for Electron apps to fix Error 153
        params.append("origin", "https://freeshow.app")

        if (opts.playerVars) {
            Object.entries(opts.playerVars).forEach(([key, value]) => {
                params.append(key, String(value))
            })
        } else {
            params.append("autoplay", "1")
        }

        return params.toString()
    }
</script>

<lite-youtube bind:this={liteYTElem} videoid={videoId} {params} js-api class={$$props.class}> </lite-youtube>

<style>
    :global(lite-youtube) {
        width: 100%;
        height: 100%;
        max-width: unset;
    }
</style>

<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activePage, activePopup, activeShow, companion, connections, dataPath, disabledServers, maxConnections, outputs, pcoConnected, chumsConnected, popupData, ports, remotePassword, serverData } from "../../../stores"
    import { pcoSync, chumsSync } from "../../../utils/startup"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { checkWindowCapture } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"

    let ip = "localhost"

    onMount(async () => {
        getIP(await requestMain(Main.IP))
    })

    function getIP(nets: any) {
        let results: any = {}
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
                const familyV4Value = typeof net.family === "string" ? "IPv4" : 4
                if (net.family === familyV4Value && !net.internal) {
                    if (!results[name]) results[name] = []
                    results[name].push(net.address)
                }
            }
        }

        ip = results["en0"]?.[0] || results["eth0"]?.[0] || results["Wi-Fi"]?.[0] || Object.values(results)[0]?.[0] || "localhost"
    }

    function reset() {
        remotePassword.set(randomNumber(1000, 9999).toString())
        ports.set({ remote: 5510, stage: 5511 })
        maxConnections.set(10)
        disabledServers.set({})
        serverData.set({})
    }

    const randomNumber = (from: number, to: number): number => Math.floor(Math.random() * (to - from)) + from

    function toggleServer(e: any, id: string) {
        let value = e.target.checked

        disabledServers.update((a) => {
            a[id] = !value
            return a
        })

        if (value) {
            popupData.set({ ip, id })
            activePopup.set("connect")
        }

        if (id === "output_stream") {
            if ($serverData?.output_stream?.outputId && !$outputs[$serverData.output_stream.outputId]) {
                serverData.update((a) => {
                    delete a.output_stream.outputId
                    return a
                })
            }

            if (value) checkWindowCapture()
        }
    }

    function toggleCompanion(e: any) {
        let value = e.target.checked

        companion.update((a) => {
            a.enabled = value
            return a
        })

        if (value) sendMain(Main.WEBSOCKET_START, $ports.companion)
        else sendMain(Main.WEBSOCKET_STOP)
    }

    function restart() {
        sendMain(Main.START, { ports: $ports, max: $maxConnections, disabled: $disabledServers, data: $serverData })
    }

    // restart servers on toggle on/off
    let initialServerState = JSON.stringify($disabledServers)
    $: if (JSON.stringify($disabledServers) !== initialServerState) restart()

    $: console.log($connections)

    const servers = [
        { id: "remote", name: "RemoteShow", icon: "connection", enabledByDefault: true },
        { id: "stage", name: "StageShow", icon: "stage", enabledByDefault: true },
        { id: "controller", name: "ControlShow", icon: "connection", enabledByDefault: false },
        { id: "output_stream", name: "OutputShow", icon: "stage", enabledByDefault: false },
        // Bitfocus Companion (WebSocket/REST)
        { id: "companion", name: "API", icon: "companion", enabledByDefault: false, url: "https://freeshow.app/docs/companion" },
        // { id: "rest", name: "REST Listener", icon: "companion", enabledByDefault: false, url: "https://freeshow.app/docs/api" },
    ]
    // Camera
    // Answer / Guess / Poll

    function pcoConnect() {
        if (!$pcoConnected) sendMain(Main.PCO_LOAD_SERVICES, { dataPath: $dataPath })
        else {
            requestMain(Main.PCO_DISCONNECT, undefined, (a) => {
                if (!a.success) return
                pcoConnected.set(false)
            })
        }
    }

    function syncPCO() {
        pcoSync()
        activeShow.set(null)
        activePage.set("show")
    }

    function chumsConnect() {
        if (!$chumsConnected) sendMain(Main.CHUMS_LOAD_SERVICES, { dataPath: $dataPath })
        else {
            requestMain(Main.CHUMS_DISCONNECT, undefined, (a) => {
                if (!a.success) return
                chumsConnected.set(false)
            })
        }
    }

    function syncChums() {
        chumsSync()
        activeShow.set(null)
        activePage.set("show")
    }
</script>

<!-- <CombinedInput>
    <Button style="width: 100%;" on:click={restart} center>
        <Icon id="refresh" right />
        <T id="settings.restart" />
    </Button>
</CombinedInput> -->

<!-- <div>
  <p><T id="settings.device_name" /></p>
  <TextInput style="max-width: 50%;" value={$os.name} light />
</div> -->

{#each servers as server}
    {@const disabled = server.id === "companion" ? $companion.enabled !== true : server.enabledByDefault ? $disabledServers[server.id] === true : $disabledServers[server.id] !== false}
    {@const connections = Object.keys($connections[server.id.toUpperCase()] || {})?.length || 0}
    <CombinedInput>
        <span style="width: 100%;">
            <Button
                style="width: 100%;"
                on:click={() => {
                    popupData.set({ ip, id: server.id })
                    activePopup.set("connect")
                }}
                {disabled}
            >
                <div style="margin: 0;border: none;">
                    <Icon id={server.icon} size={1.1} right />
                    <p style="min-width: fit-content;padding-right: 0;">
                        {server.name}
                        {#if server.id === "companion"}<span style="border: none;opacity: 0.8;font-size: 0.9em;padding-left: 15px;" class="connections">WebSocket/REST/OSC/Companion</span>{/if}
                        {#if connections}<span style="border: none;" class="connections">{connections}</span>{/if}
                    </p>
                </div>
                {#if server.id === "output_stream" && $serverData.output_stream?.sendAudio}
                    <span style="border: none;display: flex;align-items: center;justify-content: end;">
                        <Icon id="volume" />
                    </span>
                {/if}
            </Button>
        </span>
        <span class="alignRight" style="padding-left: 10px;">
            {#if server.id === "companion"}
                <Checkbox checked={$companion.enabled === true} on:change={toggleCompanion} />
            {:else}
                <Checkbox checked={server.enabledByDefault ? $disabledServers[server.id] !== true : $disabledServers[server.id] === false} on:change={(e) => toggleServer(e, server.id)} />
            {/if}
        </span>
    </CombinedInput>
{/each}

<!-- Planning Center -->
<h3>Planning Center</h3>

<CombinedInput style="border-bottom: 2px solid var(--{$pcoConnected ? 'connected' : 'disconnected'});">
    <Button on:click={pcoConnect} style="width: 100%;" center>
        <Icon id={$pcoConnected ? "logout" : "login"} right />
        {#if $pcoConnected}
            <T id="settings.disconnect_from" replace={["Planning Center"]} />
        {:else}
            <T id="settings.connect_to" replace={["Planning Center"]} />
        {/if}
    </Button>
    {#if $pcoConnected}
        <Button on:click={syncPCO}>
            <Icon id="cloud_sync" right />
            <p><T id="cloud.sync" /></p>
        </Button>
    {/if}
</CombinedInput>

<!-- Chums -->
<h3>Chums</h3>

<CombinedInput style="border-bottom: 2px solid var(--{$chumsConnected ? 'connected' : 'disconnected'});">
    <Button on:click={chumsConnect} style="width: 100%;" center>
        <Icon id={$chumsConnected ? "logout" : "login"} right />
        {#if $chumsConnected}
            <T id="settings.disconnect_from" replace={["Chums"]} />
        {:else}
            <T id="settings.connect_to" replace={["Chums"]} />
        {/if}
    </Button>
    {#if $chumsConnected}
        <Button on:click={syncChums}>
            <Icon id="cloud_sync" right />
            <p><T id="cloud.sync" /></p>
        </Button>
    {/if}
</CombinedInput>

<!-- <div>
  <p><T id="settings.allowed_connections" /></p>
  <span>(all, only phones, (laptops), ...)</span>
</div> -->

<div class="filler" />
<div class="bottom">
    <Button style="width: 100%;" on:click={reset} center>
        <Icon id="reset" right />
        <T id="actions.reset" />
    </Button>
</div>

<style>
    div:not(.scroll):not(.bottom):not(.filler) {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 5px 0;
        min-height: 38px;
    }

    .connections {
        display: flex;
        align-items: center;
        padding-left: 10px;
        opacity: 0.5;
        font-weight: normal;
    }

    .filler {
        height: 48px;
    }
    .bottom {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        background-color: var(--primary-darkest);

        display: flex;
        flex-direction: column;
    }

    h3 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }

    h3 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }
</style>

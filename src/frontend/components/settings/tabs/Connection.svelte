<script lang="ts">
    import { onMount } from "svelte"
    import type { ContentProviderId } from "../../../../electron/contentProviders/base/types"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import {
        activePage,
        activePopup,
        activeShow,
        activeTriggerFunction,
        companion,
        connections,
        contentProviderData,
        dataPath,
        disabledServers,
        maxConnections,
        outputs,
        popupData,
        ports,
        providerConnections,
        serverData,
        special
    } from "../../../stores"
    import { contentProviderSync } from "../../../utils/startup"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { checkWindowCapture } from "../../helpers/output"
    import InputRow from "../../input/InputRow.svelte"
    import Title from "../../input/Title.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

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

    // WIP reset in popups
    // function reset() {
    //     remotePassword.set(randomNumber(1000, 9999).toString())
    //     ports.set({ remote: 5510, stage: 5511 })
    //     maxConnections.set(10)
    //     disabledServers.set({})
    //     serverData.set({})
    // }
    // const randomNumber = (from: number, to: number): number => Math.floor(Math.random() * (to - from)) + from

    function toggleServer(e: any, id: string) {
        let value = e.detail

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
        let value = e.detail

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

    $: if ($activeTriggerFunction.includes("open_connection_") && ip !== "localhost") openConnection()
    function openConnection() {
        const id = $activeTriggerFunction.slice(16)
        popupData.set({ ip, id })
        activePopup.set("connect")
        activeTriggerFunction.set("")
    }

    const servers = [
        { id: "remote", name: "RemoteShow", icon: "connection", enabledByDefault: true },
        { id: "stage", name: "StageShow", icon: "stage", enabledByDefault: true },
        { id: "controller", name: "ControlShow", icon: "connection", enabledByDefault: false },
        ...($special.optimizedMode ? [] : [{ id: "output_stream", name: "OutputShow", icon: "stage", enabledByDefault: false }]),
        // Bitfocus Companion (WebSocket/REST)
        { id: "companion", name: "API", icon: "companion", enabledByDefault: false, url: "https://freeshow.app/docs/companion" }
        // { id: "rest", name: "REST Listener", icon: "companion", enabledByDefault: false, url: "https://freeshow.app/docs/api" },
    ]
    // Camera
    // Answer / Guess / Poll

    function contentProviderConnect(providerId: ContentProviderId) {
        if (!$providerConnections[providerId]) {
            sendMain(Main.PROVIDER_LOAD_SERVICES, { providerId, dataPath: $dataPath })
        } else {
            requestMain(Main.PROVIDER_DISCONNECT, { providerId }, (a) => {
                if (!a.success) return
                providerConnections.update((c) => {
                    c[providerId] = false
                    return c
                })
            })
        }
    }

    function syncContentProvider() {
        contentProviderSync()
        activeShow.set(null)
        activePage.set("show")
    }

    function updateProvider(id: ContentProviderId, key: string, value: any) {
        contentProviderData.update((a) => {
            if (!a[id]) a[id] = {}
            a[id][key] = value
            return a
        })
    }
</script>

{#each servers as server}
    {@const disabled = server.id === "companion" ? $companion?.enabled !== true : server.enabledByDefault ? $disabledServers[server.id] === true : $disabledServers[server.id] !== false}
    {@const connections = Object.keys($connections[server.id.toUpperCase()] || {})?.length || 0}

    <InputRow>
        <MaterialButton
            style="flex: 1;justify-content: space-between;"
            {disabled}
            on:click={() => {
                popupData.set({ ip, id: server.id })
                activePopup.set("connect")
            }}
        >
            <span style="display: flex;align-items: center;justify-content: center;gap: 15px;">
                <Icon id={server.icon} size={1.1} />

                {server.name}

                {#if server.id === "companion"}
                    <span style="opacity: 0.5;font-size: 0.7em;margin-left: 5px;">WebSocket/REST/OSC/Companion</span>
                {/if}
                {#if connections}
                    <span style="opacity: 0.5;font-size: 0.7em;margin-left: 5px;">{connections}</span>
                {/if}
            </span>

            {#if server.id === "output_stream" && $serverData.output_stream?.sendAudio}
                <span style="border: none;display: flex;align-items: center;justify-content: end;">
                    <Icon id="volume" />
                </span>
            {/if}
        </MaterialButton>

        {#if server.id === "companion"}
            <MaterialToggleSwitch label="" checked={$companion?.enabled === true} on:change={toggleCompanion} />
        {:else}
            <MaterialToggleSwitch label="" checked={server.enabledByDefault ? $disabledServers[server.id] !== true : $disabledServers[server.id] === false} on:change={(e) => toggleServer(e, server.id)} />
        {/if}
    </InputRow>
{/each}

{#if !$providerConnections.planningcenter && !$providerConnections.churchApps && !$providerConnections.amazinglife}
    <!-- No provider connected - show connection options -->
    <Title label="Content Provider" icon="list" />

    <InputRow>
        <MaterialButton on:click={() => contentProviderConnect("planningcenter")} style="flex: 1;" icon="login">
            <T id="settings.connect_to" replace={["Planning Center"]} />
        </MaterialButton>
    </InputRow>

    <InputRow>
        <MaterialButton on:click={() => contentProviderConnect("churchApps")} style="flex: 1;" icon="login">
            <T id="settings.connect_to" replace={["ChurchApps"]} />
        </MaterialButton>
    </InputRow>

    <!-- <InputRow>
        <MaterialButton on:click={() => contentProviderConnect("amazinglife")} style="flex: 1;" icon="login">
            <T id="settings.connect_to" replace={["Amazing Life"]} />
        </MaterialButton>
    </InputRow> -->
{:else if $providerConnections.planningcenter}
    <!-- Planning Center connected -->
    <Title label="Content Provider: Planning Center" icon="list" />

    <InputRow>
        <MaterialButton on:click={() => contentProviderConnect("planningcenter")} style="flex: 1;border-bottom: 2px solid var(--connected) !important;" icon="logout">
            <T id="settings.disconnect_from" replace={["Planning Center"]} />
        </MaterialButton>
        <MaterialButton icon="cloud_sync" on:click={syncContentProvider}>
            <T id="cloud.sync" />
        </MaterialButton>
    </InputRow>
    <MaterialToggleSwitch label="Always use local instance of songs" checked={$contentProviderData.planningcenter?.localAlways} defaultValue={false} on:change={(e) => updateProvider("planningcenter", "localAlways", e.detail)} />
{:else if $providerConnections.churchApps}
    <!-- ChurchApps connected -->
    <Title label="Content Provider: ChurchApps" icon="list" />

    <InputRow>
        <MaterialButton on:click={() => contentProviderConnect("churchApps")} style="flex: 1;border-bottom: 2px solid var(--connected) !important;" icon="logout">
            <T id="settings.disconnect_from" replace={["ChurchApps"]} />
        </MaterialButton>
        <MaterialButton icon="cloud_sync" on:click={syncContentProvider}>
            <T id="cloud.sync" />
        </MaterialButton>
        <MaterialButton title="churchApps.sync_categories_description" icon="options" on:click={() => activePopup.set("churchApps_sync_categories")}>
            <T id="churchApps.sync_categories" />
        </MaterialButton>
    </InputRow>
{:else if $providerConnections.amazinglife}
    <!-- Amazing Life connected -->
    <Title label="Content Provider: Amazing Life" icon="list" />

    <InputRow>
        <MaterialButton on:click={() => contentProviderConnect("amazinglife")} style="flex: 1;border-bottom: 2px solid var(--connected) !important;" icon="logout">
            <T id="settings.disconnect_from" replace={["Amazing Life"]} />
        </MaterialButton>
        <MaterialButton icon="cloud_sync" on:click={syncContentProvider}>
            <T id="cloud.sync" />
        </MaterialButton>
    </InputRow>
{/if}

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

<!-- <div>
  <p><T id="settings.allowed_connections" /></p>
  <span>(all, only phones, (laptops), ...)</span>
</div> -->

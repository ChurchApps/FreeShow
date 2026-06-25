<script lang="ts">
    import { onMount } from "svelte"
    import type { ContentProviderId } from "../../../../electron/contentProviders/base/types"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activePage, activePopup, activeShow, activeTriggerFunction, cloudSyncData, companion, connections, contentProviderData, disabledServers, maxConnections, notFound, obsData, outputs, popupData, ports, projectTemplates, providerConnections, serverData, special } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { contentProviderSync } from "../../../utils/startup"
    import { keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { checkWindowCapture } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import Title from "../../input/Title.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import Tip from "../../main/Tip.svelte"
    import { startRemoteController, stopRemoteController } from "../../../utils/remoteController"

    let ip = "localhost"

    onMount(async () => {
        ip = ((await requestMain(Main.IP)) || ["localhost"])[0]
    })

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
        // ...(($special.optimizedMode && $disabledServers.output_stream !== false) ? [] : [{ id: "output_stream", name: "OutputShow", icon: "stage", enabledByDefault: false }]),
        { id: "output_stream", name: "OutputShow", icon: "stage", enabledByDefault: false },
        // Bitfocus Companion (WebSocket/REST)
        { id: "companion", name: "API", icon: "companion", enabledByDefault: false, url: "https://freeshow.app/docs/companion" }
        // { id: "rest", name: "REST Listener", icon: "companion", enabledByDefault: false, url: "https://freeshow.app/docs/api" },
    ]
    // Camera
    // Answer / Guess / Poll

    $: cloudOnly = { churchApps: !!$special.churchAppsCloudOnly }
    function contentProviderConnect(providerId: ContentProviderId) {
        if (!$providerConnections[providerId] || cloudOnly[providerId]) {
            if (providerId === "churchApps") {
                special.update((a) => {
                    delete a.churchAppsCloudOnly
                    return a
                })

                if ($cloudSyncData.enabled === undefined) {
                    cloudSyncData.set({ enabled: false, id: "churchApps" })
                }
            }

            sendMain(Main.PROVIDER_LOAD_SERVICES, { providerId, cloudOnly: cloudOnly[providerId] || false })
        } else {
            if ($cloudSyncData.enabled && providerId === $cloudSyncData.id) {
                // should remain connected to cloud
                special.update((a) => {
                    a.churchAppsCloudOnly = true
                    return a
                })
                return
            }

            requestMain(Main.PROVIDER_DISCONNECT, { providerId }, (a) => {
                if (!a?.success) return
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
        notFound.set({ show: [], bible: [] })
    }

    function updateProvider(id: ContentProviderId, key: string, value: any) {
        contentProviderData.update((a) => {
            if (!a[id]) a[id] = {}
            a[id][key] = value
            return a
        })
    }

    $: projectTemplateOptions = [{ value: "", label: translateText("main.none") }, ...sortByName(keysToID($projectTemplates)).map(({ id, name }) => ({ value: id, label: name }))]

    $: providerOriginOptions = [
        { value: "", label: "Ask when existing show is found" },
        { value: "local", label: "Always use local instance" },
        { value: "online", label: "Always use online instance" }
    ]

    // Remote Control

    function toggleRemoteController(value: boolean) {
        special.update((a) => ({ ...a, remoteController: value }))

        if (value) {
            popupData.set({ remoteController: true })
            activePopup.set("connect")
            startRemoteController()
        } else {
            stopRemoteController()
        }
    }

    // OBS Controller

    let obsWasDisabled = !$obsData.enabled

    let obsIP = $obsData.ip || "localhost"
    let obsPort = $obsData.port || 4455
    $: if (obsIP || obsPort) obsData.update((d) => ({ ...d, ip: obsIP, port: obsPort }))
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

<InputRow>
    <MaterialButton
        style="flex: 1;justify-content: space-between;"
        disabled={!$special.remoteController}
        on:click={() => {
            popupData.set({ remoteController: true })
            activePopup.set("connect")
        }}
    >
        <span style="display: flex;align-items: center;justify-content: center;gap: 15px;">
            <Icon id="web" size={1.1} />

            Remote Clicker
        </span>
    </MaterialButton>

    <MaterialToggleSwitch label="" checked={$special.remoteController} on:change={(e) => toggleRemoteController(e.detail)} />
</InputRow>

{#if !$providerConnections.planningcenter && (!$providerConnections.churchApps || cloudOnly.churchApps) && !$providerConnections.amazinglife}
    <!-- No provider connected - show connection options -->
    <Title label="settings.content_provider" icon="list" />

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

    <InputRow>
        <MaterialButton on:click={() => contentProviderConnect("amazinglife")} style="flex: 1;" icon="login">
            <T id="settings.connect_to" replace={["APlay"]} />
        </MaterialButton>
    </InputRow>
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
        <MaterialButton on:click={() => sendMain(Main.URL, "https://planningcenter.com")} title="Planning Center" white>
            <Icon id="launch" white />
        </MaterialButton>
    </InputRow>

    <InputRow>
        <!-- <MaterialPopupButton label="popup.sync_folders" value="" name="" icon="folder" popupId="sync_folders" on:click={() => activePopup.set("sync_folders")} style="flex: 1;" /> -->
        <MaterialButton icon="folder" on:click={() => activePopup.set("sync_folders")} style="flex: 1;">
            <T id="popup.sync_folders" />
        </MaterialButton>
    </InputRow>

    <MaterialDropdown label="Song origin" options={providerOriginOptions} value={$contentProviderData.planningcenter?.songOrigin || ""} on:change={(e) => updateProvider("planningcenter", "songOrigin", e.detail)} />
    {#if Object.keys($projectTemplates).length}
        <MaterialDropdown label="actions.project_template" options={projectTemplateOptions} value={$contentProviderData.planningcenter?.projectTemplate || ""} on:change={(e) => updateProvider("planningcenter", "projectTemplate", e.detail)} />
    {/if}
{:else if $providerConnections.churchApps && !cloudOnly.churchApps}
    <!-- ChurchApps connected -->
    <Title label="Content Provider: ChurchApps" icon="list" />

    <InputRow>
        <MaterialButton on:click={() => contentProviderConnect("churchApps")} style="flex: 1;border-bottom: 2px solid var(--connected) !important;" icon="logout">
            <T id="settings.disconnect_from" replace={["ChurchApps"]} />
        </MaterialButton>
        <MaterialButton icon="cloud_sync" on:click={syncContentProvider}>
            <T id="cloud.sync" />
        </MaterialButton>
        <MaterialButton title="<b>popup.sync_categories:</b> settings.sync_categories_tip" icon="options" on:click={() => activePopup.set("sync_categories")} />
        <MaterialButton on:click={() => sendMain(Main.URL, "https://b1.church")} title="B1.Church" white>
            <Icon id="launch" white />
        </MaterialButton>
    </InputRow>

    <MaterialDropdown label="Song origin" options={providerOriginOptions} value={$contentProviderData.churchApps?.songOrigin || ""} on:change={(e) => updateProvider("churchApps", "songOrigin", e.detail)} />

    {#if $cloudSyncData.enabled}
        <Tip type="warning" value="This is unrelated to the Cloud sync found in 'Files'. This is for the content manager / curriculum." top={20} />
    {/if}
{:else if $providerConnections.amazinglife}
    <!-- APlay connected -->
    <Title label="Content Provider: APlay" icon="list" />

    <InputRow>
        <MaterialButton on:click={() => contentProviderConnect("amazinglife")} style="flex: 1;border-bottom: 2px solid var(--connected) !important;" icon="logout">
            <T id="settings.disconnect_from" replace={["APlay"]} />
        </MaterialButton>
        <!-- Nothing to sync yet -->
        <!-- <MaterialButton icon="cloud_sync" on:click={syncContentProvider}>
            <T id="cloud.sync" />
        </MaterialButton> -->
    </InputRow>
{/if}

<!-- OBS Studio Controller -->
<Title label="OBS Studio" icon="record" />

<InputRow arrow={$obsData.enabled}>
    <MaterialToggleSwitch
        label="OBS Studio Controller"
        style="width: 100%;"
        checked={$obsData.enabled}
        defaultValue={false}
        on:change={(e) => {
            if (!e.detail) obsWasDisabled = true
            obsData.update((a) => ({ ...a, enabled: e.detail }))
        }}
    />

    <div slot="menu">
        <MaterialTextInput label="IP" value={obsIP} defaultValue="localhost" placeholder="localhost" on:change={(e) => (obsIP = e.detail)} />
        <MaterialNumberInput label="settings.port" value={obsPort} defaultValue={4455} placeholder="4455" on:change={(e) => (obsPort = e.detail)} />
    </div>
</InputRow>

{#if $obsData.enabled && obsWasDisabled}
    <Tip value="edit.position: guide_title.drawer > tabs.functions > OBS Studio" top={15} />
{/if}

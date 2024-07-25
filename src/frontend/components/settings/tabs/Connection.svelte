<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { MAIN } from "../../../../types/Channels"
    import { activePopup, companion, connections, disabledServers, maxConnections, outputs, popupData, ports, remotePassword, serverData } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID } from "../../helpers/array"
    import { checkWindowCapture, getActiveOutputs } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    const setRemotePassword = (e: any) => remotePassword.set(e.target.value)

    let ip = "IP"
    let listenerId = "IP_ADDRESS"
    onMount(() => send(MAIN, ["IP"]))
    receive(MAIN, { IP: (a: any) => getIP(a) }, listenerId)
    // receive(MAIN, { IP: (a: any) => (ip = a["Wi-Fi"]?.filter((a: any) => a.family === "IPv4")[0].address) })
    onDestroy(() => destroy(MAIN, listenerId))

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

        ip = results["en0"]?.[0] || results["eth0"]?.[0] || results["Wi-Fi"]?.[0] || Object.values(results)[0]?.[0] || "IP"
    }

    function reset() {
        remotePassword.set(randomNumber(1000, 9999).toString())
        ports.set({ remote: 5510, stage: 5511 })
        maxConnections.set(10)
        disabledServers.set({})
    }

    const randomNumber = (from: number, to: number): number => Math.floor(Math.random() * (to - from)) + from

    function updatePort(e: any, id: string) {
        let port = Number(e.detail)
        if (Object.values($ports).includes(port)) return
        ports.update((a) => {
            a[id] = port
            return a
        })
    }

    function toggleServer(e: any, id: string) {
        let value = !e.target.checked

        disabledServers.update((a) => {
            a[id] = value
            return a
        })

        if (id === "output_stream") checkWindowCapture()
    }

    function toggleCompanion(e: any) {
        let value = e.target.checked

        companion.update((a) => {
            a.enabled = value
            return a
        })

        if (value) send(MAIN, ["WEBSOCKET_START"], $ports.companion)
        else send(MAIN, ["WEBSOCKET_STOP"])
    }

    // output
    $: outputsList = getList(clone($outputs))
    function getList(outputs) {
        let list = keysToID(outputs).filter((a) => !a.isKeyOutput && a.enabled === true)
        return list.sort((a, b) => a.name.localeCompare(b.name))
    }

    function setOutputId(e: any) {
        let outputId = e.detail.id

        serverData.update((a) => {
            if (!a.output_stream) a.output_stream = {}
            a.output_stream.outputId = outputId

            return a
        })
    }

    let enableOutputSelector = $serverData?.output_stream?.outputId || getActiveOutputs($outputs, false, true).length > 1

    function restart() {
        send(MAIN, ["START"], { ports: $ports, max: $maxConnections, disabled: $disabledServers })
    }

    // restart servers on toggle on/off
    let initialServerState = JSON.stringify($disabledServers)
    $: if (JSON.stringify($disabledServers) !== initialServerState) restart()

    $: console.log($connections)

    const servers = [
        { id: "remote", name: "RemoteShow", defaultPort: 5510, icon: "connection", enabledByDefault: true },
        { id: "stage", name: "StageShow", defaultPort: 5511, icon: "stage", enabledByDefault: true },
        { id: "controller", name: "ControlShow", defaultPort: 5512, icon: "connection", enabledByDefault: false },
        { id: "output_stream", name: "OutputShow", defaultPort: 5513, icon: "stage", enabledByDefault: false },
        { id: "companion", name: "Bitfocus Companion (WebSocket/REST)", defaultPort: 5505, icon: "companion", enabledByDefault: false, url: "https://freeshow.app/docs/companion" },
        // { id: "rest", name: "REST Listener", defaultPort: 5506, icon: "companion", enabledByDefault: false, url: "https://freeshow.app/docs/api" },
    ]
    // Camera
    // Answer / Guess / Poll
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
    <CombinedInput>
        <span style="flex: 1;">
            <Button
                style="width: 100%;"
                on:click={() => {
                    if (server.url) {
                        send(MAIN, ["URL"], server.url)
                        return
                    }

                    popupData.set({ ip, id: server.id })
                    activePopup.set("connect")
                }}
                {disabled}
            >
                <div style="margin: 0;">
                    <Icon id={server.icon} size={1.1} right />
                    <p>
                        {server.name}
                        <span class="connections">{Object.keys($connections[server.id.toUpperCase()] || {})?.length || ""}</span>
                        {#if server.url}<Icon id="launch" white />{/if}
                    </p>
                </div>
            </Button>
        </span>
        <span style="display: flex;">
            <span style="flex: 1;">
                <span class="alignLeft">
                    {#if server.id === "companion"}
                        <Checkbox checked={$companion.enabled === true} on:change={toggleCompanion} />
                    {:else}
                        <Checkbox checked={server.enabledByDefault ? $disabledServers[server.id] !== true : $disabledServers[server.id] === false} on:change={(e) => toggleServer(e, server.id)} />
                    {/if}
                </span>
            </span>
            <span style="display: flex;flex: 1;">
                <span style="display: flex;align-items: center;padding: 0 10px;"><T id="settings.port" />:</span>
                <NumberInput value={$ports[server.id] || server.defaultPort} on:change={(e) => updatePort(e, server.id)} min={1025} max={65535} buttons={false} />
            </span>
        </span>
    </CombinedInput>
{/each}

<br />

<CombinedInput>
    <p><T id="settings.max_connections" /></p>
    <NumberInput value={$maxConnections} on:change={(e) => maxConnections.set(e.detail)} max={100} />
</CombinedInput>
<CombinedInput>
    <p>RemoteShow <T id="settings.password" /></p>
    <TextInput style="max-width: 50%;" value={$remotePassword} light on:change={setRemotePassword} />
</CombinedInput>
{#if enableOutputSelector}
    <CombinedInput>
        <p>OutputShow <T id="midi.output" /></p>
        <Dropdown value={outputsList.find((a) => a.id === $serverData?.output_stream?.outputId)?.name || "—"} options={outputsList} on:click={setOutputId} />
    </CombinedInput>
{/if}
<!-- TODO: OutputShow set output... -->

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
</style>

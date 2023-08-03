<script lang="ts">
    import { onMount } from "svelte"
    import { MAIN } from "../../../../types/Channels"
    import { activePopup, connections, dictionary, disabledServers, maxConnections, outputs, popupData, ports, remotePassword, serverData } from "../../../stores"
    import { receive, send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import { clone, keysToID } from "../../helpers/array"
    import { getActiveOutputs } from "../../helpers/output"

    const setRemotePassword = (e: any) => remotePassword.set(e.target.value)

    let ip = "IP"
    onMount(() => send(MAIN, ["IP"]))
    receive(MAIN, { IP: (a: any) => getIP(a) })
    // receive(MAIN, { IP: (a: any) => (ip = a["Wi-Fi"]?.filter((a: any) => a.family === "IPv4")[0].address) })

    function getIP(nets: any) {
        let results: any = {}
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                if (net.family === "IPv4" && !net.internal) {
                    if (!results[name]) results[name] = []
                    results[name].push(net.address)
                }
            }
        }

        ip = results["en0"]?.[0] || results["Wi-Fi"]?.[0] || "IP"
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
        disabledServers.update((a) => {
            a[id] = !e.target.checked

            return a
        })
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

    $: console.log($connections)
</script>

<!-- TODO: connection -->
<!-- <div style="min-height: initial;justify-content: center;">
    <p>
        <T id="settings.connect" />:
        <strong style="font-size: 1.2em;">{ip}:[<T id="settings.port" />]</strong>
    </p>
</div>
<div style="min-height: initial;justify-content: center;">
    <p>
        <T id="settings.connections" />:
        <strong>
            {Object.values($connections).reduce((value, connections) => (value += Object.keys(connections).length), 0)}
        </strong>
    </p>
</div> -->

<!-- <br /> -->

<CombinedInput title={$dictionary.popup?.connect}>
    <Button
        style="flex: 1;"
        on:click={() => {
            popupData.set({ ip, id: "remote" })
            activePopup.set("connect")
        }}
        disabled={$disabledServers.remote === true}
        center
    >
        <div style="margin: 0;">
            <Icon id="connection" size={1.1} right />
            <p>
                RemoteShow
                <span class="connections">{Object.keys($connections.REMOTE || {})?.length || ""}</span>
            </p>
        </div>
    </Button>
    <Button
        style="flex: 1;"
        on:click={() => {
            popupData.set({ ip, id: "controller" })
            activePopup.set("connect")
        }}
        disabled={$disabledServers.controller !== false}
        center
    >
        <div style="margin: 0;">
            <Icon id="connection" size={1.1} right />
            <p>
                ControlShow
                <span class="connections">{Object.keys($connections.CONTROLLER || {})?.length || ""}</span>
            </p>
        </div>
    </Button>
    <Button
        style="flex: 1;"
        on:click={() => {
            popupData.set({ ip, id: "stage" })
            activePopup.set("connect")
        }}
        disabled={$disabledServers.stage === true}
        center
    >
        <div style="margin: 0;">
            <Icon id="stage" size={1.3} right />
            <p>
                StageShow
                <span class="connections">{Object.keys($connections.STAGE || {})?.length || ""}</span>
            </p>
        </div>
    </Button>
    <Button
        style="flex: 1;"
        on:click={() => {
            popupData.set({ ip, id: "output_stream" })
            activePopup.set("connect")
        }}
        disabled={$disabledServers.output_stream !== false}
        center
    >
        <div style="margin: 0;">
            <Icon id="stage" size={1.3} right />
            <p>
                OutputShow
                <span class="connections">{Object.keys($connections.OUTPUT_STREAM || {})?.length || ""}</span>
            </p>
        </div>
    </Button>
    <!-- Camera -->
    <!-- Answer / Guess / Poll -->
</CombinedInput>

<CombinedInput>
    <Button style="width: 100%;" on:click={() => send(MAIN, ["START"], { ports: $ports, max: $maxConnections, disabled: $disabledServers })} center>
        <Icon id="refresh" right />
        <T id="settings.restart" />
    </Button>
</CombinedInput>

<!-- <div>
  <p><T id="settings.device_name" /></p>
  <TextInput style="max-width: 50%;" value={$os.name} light />
</div> -->
<CombinedInput>
    <p>
        <span style="display: flex;align-items: center;border: 0;">RemoteShow</span>
        <span class="alignRight" style="padding: 0;border: 0;">
            <Checkbox checked={$disabledServers.remote !== true} on:change={(e) => toggleServer(e, "remote")} />
        </span>
    </p>
    <p style="min-width: unset;"><T id="settings.port" />:</p>
    <NumberInput value={$ports.remote || 5510} on:change={(e) => updatePort(e, "remote")} min={1025} max={65535} buttons={false} />
</CombinedInput>
<CombinedInput>
    <p>
        <span style="display: flex;align-items: center;border: 0;">StageShow</span>
        <span class="alignRight" style="padding: 0;border: 0;">
            <Checkbox checked={$disabledServers.stage !== true} on:change={(e) => toggleServer(e, "stage")} />
        </span>
    </p>
    <p style="min-width: unset;"><T id="settings.port" />:</p>
    <NumberInput value={$ports.stage || 5511} on:change={(e) => updatePort(e, "stage")} min={1025} max={65535} buttons={false} />
</CombinedInput>
<CombinedInput>
    <p>
        <span style="display: flex;align-items: center;border: 0;">ControlShow</span>
        <span class="alignRight" style="padding: 0;border: 0;">
            <Checkbox checked={$disabledServers.controller === false} on:change={(e) => toggleServer(e, "controller")} />
        </span>
    </p>
    <p style="min-width: unset;"><T id="settings.port" />:</p>
    <NumberInput value={$ports.controller || 5512} on:change={(e) => updatePort(e, "controller")} min={1025} max={65535} buttons={false} />
</CombinedInput>
<CombinedInput>
    <p>
        <span style="display: flex;align-items: center;border: 0;">OutputShow</span>
        <span class="alignRight" style="padding: 0;border: 0;">
            <Checkbox checked={$disabledServers.output_stream === false} on:change={(e) => toggleServer(e, "output_stream")} />
        </span>
    </p>
    <p style="min-width: unset;"><T id="settings.port" />:</p>
    <NumberInput value={$ports.output_stream || 5513} on:change={(e) => updatePort(e, "output")} min={1025} max={65535} buttons={false} />
</CombinedInput>

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

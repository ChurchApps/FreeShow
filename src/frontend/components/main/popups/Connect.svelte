<script lang="ts">
    import qrcode from "qrcode-generator"
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { AudioAnalyser } from "../../../audio/audioAnalyser"
    import { sendMain } from "../../../IPC/main"
    import { activePopup, maxConnections, os, outputs, popupData, ports, remotePassword, serverData, special } from "../../../stores"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Link from "../../inputs/Link.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    let id: keyof typeof defaultPorts = "stage"
    let ip = "localhost"

    $: useHostname = $special.connectionHostname

    onMount(() => {
        id = $popupData.id
        ip = $popupData.ip
        popupData.set({})
    })

    const defaultPorts = {
        remote: 5510,
        stage: 5511,
        controller: 5512,
        output_stream: 5513,

        companion: 5505
        // rest: 5506

        // PCO: 5501
    }

    $: port = $ports[id] || defaultPorts[id]
    $: hostname = `${$os.name.toLowerCase()}${$os.platform === "win32" ? ".local" : ""}`
    $: url = `http://${useHostname ? hostname : ip}:${port}`
    $: if (url) generateQR(url)

    function mousedown(e: any) {
        if (e.target.closest("a")) {
            activePopup.set(null)
        }
    }

    let qrImg = ""
    function generateQR(text) {
        if ((!useHostname && ip === "localhost") || id === "companion") return

        var qr = qrcode(0, "L")
        qr.addData(text)
        qr.make()
        qrImg = qr.createImgTag(8, 8)
    }

    let options = false

    const RESERVED_PORTS = { nowPlaying: [5502], WebSocket: [5505], REST: [5506], companion: [5505, 5506], remote: [5510], stage: [5511], controller: [5512], output_stream: [5513] }
    $: isReserved = !RESERVED_PORTS[id]?.includes(port) && Object.values(RESERVED_PORTS).flat().includes(port)

    function updatePort(e: any) {
        port = e.detail
        ports.update((a) => {
            a[id] = port
            return a
        })
    }

    const setRemotePassword = (e: any) => remotePassword.set(e.target.value)

    // output
    $: outputsList = getList(clone($outputs))
    function getList(outputs) {
        let list = keysToID(outputs).filter((a) => !a.isKeyOutput && a.enabled === true)
        return sortByName(list).map((a) => ({ label: a.name, value: a.id }))
    }

    function toggleAudio(e: any) {
        let value = e.detail
        updateData(value, "sendAudio")
        if (value) AudioAnalyser.recorderActivate()
    }

    function updateData(e: any, key: string) {
        let value = e.detail ?? e

        serverData.update((a) => {
            if (!a[id]) a[id] = {}
            a[id][key] = value

            return a
        })

        sendMain(Main.SERVER_DATA, $serverData)
    }

    function updateSpecial(key: string, value: any) {
        special.update((a) => {
            a[key] = value
            return a
        })
    }

    // $: enableOutputSelector = ($serverData?.output_stream?.outputId && $outputs[$serverData.output_stream.outputId]) || getActiveOutputs($outputs, false, true).length > 1
</script>

<MaterialButton class="popup-options {options ? 'active' : ''}" icon="options" iconSize={1.3} title={options ? "actions.close" : "create_show.more_options"} on:click={() => (options = !options)} white />

{#if options}
    <div class="reserved" class:isReserved>
        <MaterialNumberInput label="settings.port" value={port} defaultValue={RESERVED_PORTS[id]?.[0]} min={1025} max={65535} on:change={(e) => updatePort(e)} />
    </div>

    {#if id === "remote"}
        <MaterialTextInput label="remote.password" value={$remotePassword} on:change={setRemotePassword} />
    {:else if id === "output_stream"}
        <!-- {#if enableOutputSelector} -->
        <MaterialDropdown label="midi.output" options={outputsList} value={$serverData?.output_stream?.outputId || ""} on:change={(e) => updateData(e.detail, "outputId")} allowEmpty />
        <!-- {/if} -->

        <MaterialToggleSwitch label="preview.audio" checked={$serverData?.output_stream?.sendAudio} defaultValue={false} on:change={toggleAudio} />
    {/if}

    {#if id !== "companion"}
        <hr />

        <MaterialNumberInput label="settings.max_connections" value={$maxConnections} max={100} on:change={(e) => maxConnections.set(e.detail)} />
        <MaterialToggleSwitch label="settings.use_hostname" checked={$special.connectionHostname} defaultValue={false} on:change={(e) => updateSpecial("connectionHostname", e.detail)} />
    {/if}
{:else}
    <div on:mousedown={mousedown}>
        {#if id === "companion"}
            <Link url="https://freeshow.app/api">
                API Docs
                <Icon id="launch" white />
            </Link>
            <Link url="https://freeshow.app/docs/companion">
                Bitfocus Companion Connection
                <Icon id="launch" white />
            </Link>
        {:else}
            <p><T id="settings.connect" />:</p>
            <Link {url}>
                {url}
                <Icon id="launch" white />
            </Link>

            <br />

            {#if ip === "localhost"}
                <p style="text-align: start;">
                    <T id="error.ip" />
                    <!-- <br />Should look similar to this: 192.168.1.100 -->
                </p>
            {:else if qrImg}
                <p style="margin-bottom: 5px;"><T id="settings.connect_qr" />:</p>
                {@html qrImg}
            {/if}
        {/if}

        {#if id === "remote" && $remotePassword}
            <p style="padding-top: 10px;font-size: 0.9em;"><T id="remote.password" />: <b>{$remotePassword}</b></p>
        {/if}
    </div>
{/if}

<style>
    div {
        text-align: center;
    }

    div :global(a) {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    hr {
        border: none;
        height: 2px;
        margin: 20px 0;
        background-color: var(--primary-lighter);
    }

    div :global(img) {
        border-radius: 4px;
    }

    .reserved.isReserved :global(input) {
        color: #ff3232;
    }
</style>

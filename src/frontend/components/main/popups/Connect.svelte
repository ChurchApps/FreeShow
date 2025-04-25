<script lang="ts">
    import qrcode from "qrcode-generator"
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { AudioAnalyser } from "../../../audio/audioAnalyser"
    import { sendMain } from "../../../IPC/main"
    import { activePopup, dictionary, maxConnections, outputs, popupData, ports, remotePassword, serverData } from "../../../stores"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import Link from "../../inputs/Link.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    let id: keyof typeof defaultPorts = "stage"
    let ip = "localhost"

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

        companion: 5505,
        // rest: 5506

        // PCO: 5501
    }

    $: port = $ports[id] || defaultPorts[id]
    $: url = "http://" + ip + ":" + port
    $: if (url) generateQR(url)

    function mousedown(e: any) {
        if (e.target.closest("a")) {
            activePopup.set(null)
        }
    }

    let qrImg = ""
    function generateQR(text) {
        if (ip === "localhost" || id === "companion") return

        var qr = qrcode(0, "L")
        qr.addData(text)
        qr.make()
        qrImg = qr.createImgTag(8, 8)
    }

    let options = false

    function updatePort(e: any) {
        let port = Number(e.detail)
        if (Object.values($ports).includes(port)) return
        ports.update((a) => {
            a[id] = port
            return a
        })
    }

    const isChecked = (e: any) => e.target.checked
    const setRemotePassword = (e: any) => remotePassword.set(e.target.value)

    // output
    $: outputsList = getList(clone($outputs))
    function getList(outputs) {
        let list = keysToID(outputs).filter((a) => !a.isKeyOutput && a.enabled === true)
        return [{ id: "", name: "—" }, ...sortByName(list)]
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

    // $: enableOutputSelector = ($serverData?.output_stream?.outputId && $outputs[$serverData.output_stream.outputId]) || getActiveOutputs($outputs, false, true).length > 1
</script>

{#if options}
    <Button class="popup-back" title={$dictionary.actions?.back} on:click={() => (options = false)}>
        <Icon id="back" size={2} white />
    </Button>

    <CombinedInput>
        <p><T id="settings.port" /></p>
        <NumberInput value={port} on:change={(e) => updatePort(e)} min={1025} max={65535} buttons={false} />
    </CombinedInput>

    {#if id === "remote"}
        <CombinedInput>
            <!-- <p style="text-transform: capitalize;"><T id="settings.password" /></p> -->
            <p><T id="remote.password" /></p>
            <TextInput style="max-width: 50%;" value={$remotePassword} light on:change={setRemotePassword} />
        </CombinedInput>
    {:else if id === "output_stream"}
        <!-- {#if enableOutputSelector} -->
        <CombinedInput>
            <p><T id="midi.output" /></p>
            <Dropdown value={outputsList.find((a) => a.id === $serverData?.output_stream?.outputId)?.name || "—"} options={outputsList} on:click={(e) => updateData(e.detail.id, "outputId")} />
        </CombinedInput>
        <!-- {/if} -->

        <CombinedInput>
            <p><T id="preview.audio" /></p>
            <div class="alignRight">
                <Checkbox
                    checked={$serverData?.output_stream?.sendAudio}
                    on:change={(e) => {
                        let value = isChecked(e)
                        updateData(value, "sendAudio")
                        if (value) AudioAnalyser.recorderActivate()
                    }}
                />
            </div>
        </CombinedInput>
    {/if}

    {#if id !== "companion"}
        <hr />

        <CombinedInput>
            <p><T id="settings.max_connections" /></p>
            <NumberInput value={$maxConnections} on:change={(e) => maxConnections.set(e.detail)} max={100} />
        </CombinedInput>
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

            <br />
            <br />
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
            {:else}
                <p style="margin-bottom: 5px;"><T id="settings.connect_qr" />:</p>
                {@html qrImg}
            {/if}
        {/if}

        {#if id === "remote" && $remotePassword}
            <p style="padding-top: 10px;font-size: 0.9em;"><T id="remote.password" />: <b>{$remotePassword}</b></p>
        {/if}
    </div>

    <Button style="position: absolute;inset-inline-start: 10px;bottom: 10px;padding: 12px;" title={$dictionary.edit?.options} on:click={() => (options = true)}>
        <Icon id="settings" size={1.5} white />
    </Button>
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
</style>

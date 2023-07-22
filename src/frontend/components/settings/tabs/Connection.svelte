<script lang="ts">
    import { onMount } from "svelte"
    import { MAIN } from "../../../../types/Channels"
    import { activePopup, connections, dictionary, maxConnections, popupData, ports, remotePassword } from "../../../stores"
    import { receive, send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"

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
            popupData.set({ ip, id: "stage" })
            activePopup.set("connect")
        }}
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
            popupData.set({ ip, id: "controller" })
            activePopup.set("connect")
        }}
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
</CombinedInput>

<CombinedInput>
    <Button style="width: 100%;" on:click={() => send(MAIN, ["START"], { ports: $ports, max: $maxConnections })} center>
        <Icon id="refresh" right />
        <T id="settings.restart" />
    </Button>
</CombinedInput>

<!-- <div>
  <p><T id="settings.device_name" /></p>
  <TextInput style="max-width: 50%;" value={$os.name} light />
</div> -->
<CombinedInput>
    <p>RemoteShow <T id="settings.password" /></p>
    <TextInput style="max-width: 50%;" value={$remotePassword} light on:change={setRemotePassword} />
</CombinedInput>
<CombinedInput>
    <p>RemoteShow <T id="settings.port" /></p>
    <NumberInput value={$ports.remote || 5510} on:change={(e) => updatePort(e, "remote")} min={1000} max={10000} buttons={false} />
</CombinedInput>
<CombinedInput>
    <p>StageShow <T id="settings.port" /></p>
    <NumberInput value={$ports.stage || 5511} on:change={(e) => updatePort(e, "stage")} min={1000} max={10000} buttons={false} />
</CombinedInput>
<CombinedInput>
    <p>ControlShow <T id="settings.port" /></p>
    <NumberInput value={$ports.controller || 5512} on:change={(e) => updatePort(e, "controller")} min={1000} max={10000} buttons={false} />
</CombinedInput>
<CombinedInput>
    <p><T id="settings.max_connections" /></p>
    <NumberInput value={$maxConnections} on:change={(e) => maxConnections.set(e.detail)} max={100} />
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
</style>

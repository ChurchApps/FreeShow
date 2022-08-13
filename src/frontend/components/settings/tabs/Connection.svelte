<script lang="ts">
  import { onMount } from "svelte"
  import { MAIN } from "../../../../types/Channels"
  import { connections, maxConnections, os, ports, remotePassword } from "../../../stores"
  import { receive, send } from "../../../utils/request"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import TextInput from "../../inputs/TextInput.svelte"

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
</script>

<!-- TODO: connection -->
<div style="min-height: initial;justify-content: center;">
  <p><T id="settings.connect" />: <strong style="font-size: 1.2em;">{ip}:[<T id="settings.port" />]</strong></p>
</div>
<div style="min-height: initial;justify-content: center;">
  <p><T id="settings.connections" />: <strong>{Object.keys($connections.REMOTE).length + Object.keys($connections.STAGE).length}</strong></p>
</div>
<br />
<div>
  <p><T id="settings.device_name" /></p>
  <TextInput style="max-width: 50%;" value={$os.name} light />
</div>
<div>
  <p>RemoteShow <T id="settings.password" /></p>
  <TextInput style="max-width: 50%;" value={$remotePassword} light on:change={setRemotePassword} />
</div>
<div class="input">
  <p>RemoteShow <T id="settings.port" /></p>
  <NumberInput
    value={$ports.remote}
    on:change={(e) =>
      ports.update((a) => {
        let port = Number(e.detail)
        if (port === a.stage) port--
        a.remote = port
        return a
      })}
    min={1000}
    max={10000}
    buttons={false}
    outline
  />
</div>
<div class="input">
  <p>StageShow <T id="settings.port" /></p>
  <NumberInput
    value={$ports.stage}
    on:change={(e) =>
      ports.update((a) => {
        let port = Number(e.detail)
        if (port === a.remote) port--
        a.stage = port
        return a
      })}
    min={1000}
    max={10000}
    buttons={false}
    outline
  />
</div>
<div>
  <p><T id="settings.max_connections" /></p>
  <NumberInput value={$maxConnections} on:change={(e) => maxConnections.set(e.detail)} max={100} outline />
</div>

<hr />
<Button style="width: 100%;" on:click={() => send(MAIN, ["START"], { ports: $ports, max: $maxConnections })} center>
  <Icon id="restart" right />
  <T id="settings.restart" />
</Button>
<Button style="width: 100%;" on:click={reset} center>
  <Icon id="reset" right />
  <T id="actions.reset" />
</Button>

<!-- <div>
  <p><T id="settings.allowed_connections" /></p>
  <span>(all, only phones, (laptops), ...)</span>
</div> -->
<style>
  div:not(.scroll) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 5px 0;
    min-height: 38px;
  }

  .input :global(input) {
    width: 80px;
  }

  hr {
    margin: 20px 0;
    border: none;
    height: 2px;
    background-color: var(--primary-lighter);
  }
</style>

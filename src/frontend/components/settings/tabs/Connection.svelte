<script lang="ts">
  import { onMount } from "svelte"
  import { MAIN } from "../../../../types/Channels"
  import { os, remotePassword } from "../../../stores"
  import { receive, send } from "../../../utils/request"
  import T from "../../helpers/T.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import TextInput from "../../inputs/TextInput.svelte"

  const setRemotePassword = (e: any) => remotePassword.set(e.target.value)

  let ip = "IP"
  onMount(() => send(MAIN, ["IP"]))
  receive(MAIN, { IP: (a: any) => (ip = a["Wi-Fi"]?.filter((a: any) => a.family === "IPv4")[0].address) })
</script>

<!-- TODO: connection -->
<div>
  <p><T id="settings.device_name" /></p>
  <TextInput style="max-width: 50%;" value={$os.name} light />
</div>
<div>
  <p>RemoteShow <T id="settings.password" /></p>
  <TextInput style="max-width: 50%;" value={$remotePassword} light on:change={setRemotePassword} />
</div>
<!-- TODO: change -->
WIP VV
<div>
  <p>RemoteShow <T id="settings.port" /></p>
  <NumberInput value={5510} min={1000} max={10000} buttons={false} />
</div>
<div>
  <p>StageShow <T id="settings.port" /></p>
  <NumberInput value={5511} min={1000} max={10000} buttons={false} />
</div>
<div>
  <p><T id="settings.max_connections" /></p>
  <NumberInput value={10} />
</div>
<div>
  <p><T id="settings.allowed_connections" /></p>
  <span>(all, only phones, (laptops), ...)</span>
</div>
<br /><br />
<div style="justify-content: center;">
  <p>Connect using:&nbsp;</p>
  <b style="font-size: 1.2em;">{ip}:[port]</b>
</div>

<style>
  div:not(.scroll) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 5px 0;
  }
</style>

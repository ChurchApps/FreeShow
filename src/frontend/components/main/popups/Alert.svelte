<script lang="ts">
  import { activePopup, alertMessage } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"

  let msg: string = ""
  $: msg = $alertMessage.toString()
</script>

<p>
  {#key msg}
    {#if msg?.includes(".")}
      <T id={msg} />
    {:else}
      {msg}
    {/if}
  {/key}
</p>

<Button on:click={() => activePopup.set(null)} center>
  <Icon id="check" />
</Button>

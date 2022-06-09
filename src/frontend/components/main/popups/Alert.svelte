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
    {#if !msg.includes("<") && msg?.length - msg?.replaceAll(".", "").length === 1}
      <T id={msg} />
    {:else}
      {@html msg}
    {/if}
  {/key}
</p>

<Button on:click={() => activePopup.set(null)} center>
  <Icon id="check" />
</Button>

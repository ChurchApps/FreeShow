<script>
  import { OUTPUT } from "../../../../types/Channels"
  import { drawerTabsData } from "../../../stores"
  import { send } from "../../../utils/request"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"

  $: active = $drawerTabsData.player.activeSubTab
</script>

{#if active === "youtube"}
  <Button on:click={() => send(OUTPUT, ["CLOSE_AD"])} center>
    <T id="inputs.close_ad" />
  </Button>
{/if}

<!-- TODO: change quality / resolution -->

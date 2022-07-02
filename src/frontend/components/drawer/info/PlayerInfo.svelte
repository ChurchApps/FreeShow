<script>
  import { OUTPUT } from "../../../../types/Channels"
  import { drawerTabsData } from "../../../stores"
  import { send } from "../../../utils/request"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"

  $: active = $drawerTabsData.player.activeSubTab
</script>

{#if active === "youtube"}
  <main>
    <Button on:click={() => send(OUTPUT, ["CLOSE_AD"])} center dark>
      <T id="inputs.close_ad" />
    </Button>

    <hr />

    <T id="error.video_unavailable" />
  </main>
{/if}

<!-- TODO: change quality / resolution -->
<style>
  main {
    padding: 10px;
  }

  hr {
    border: none;
    height: 2px;
    margin: 20px 0;
    background-color: var(--primary-lighter);
  }
</style>

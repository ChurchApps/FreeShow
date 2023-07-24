<script>
    import { OUTPUT } from "../../../../types/Channels"
    import { activeDrawerOnlineTab } from "../../../stores"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    $: active = $activeDrawerOnlineTab
</script>

{#if active === "youtube"}
    <div class="scroll">
        <T id="error.video_unavailable" />
    </div>

    <Button on:click={() => send(OUTPUT, ["CLOSE_AD"])} center dark>
        <Icon id="close" right />
        <T id="inputs.close_ad" />
    </Button>
{/if}

<!-- TODO: change quality / resolution -->
<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;

        padding: 10px;
    }

    /* hr {
    border: none;
    height: 2px;
    margin: 20px 0;
    background-color: var(--primary-lighter);
  } */
</style>

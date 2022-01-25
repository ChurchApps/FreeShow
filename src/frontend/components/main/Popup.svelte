<script lang="ts">
  import Icon from "../helpers/Icon.svelte"
  import Button from "../inputs/Button.svelte"
  import { activePopup } from "../../stores"
  import { scale, fade } from "svelte/transition"
  import T from "../helpers/T.svelte"
  import DeleteShow from "./popups/DeleteShow.svelte"
  import CreateShow from "./popups/CreateShow.svelte"
  import ChangeIcon from "./popups/ChangeIcon.svelte"
  import Rename from "./popups/Rename.svelte"
  import About from "./popups/About.svelte"

  const hide = (e: any) => {
    if (e.target.classList.contains("popup")) activePopup.set(null)
  }
</script>

{#if $activePopup !== null}
  <div class="popup" transition:fade={{ duration: 100 }} on:click={hide}>
    <div class="card" transition:scale={{ duration: 200 }}>
      <div style="position: relative;">
        <h2 style="text-align: center;margin: 10px 50px;"><T id="popup.{$activePopup}" /></h2>
        <Button style="position: absolute;right: 0;top: 0;height: 100%;" on:click={() => activePopup.set(null)}>
          <Icon id="close" size={2} />
        </Button>
      </div>
      <div style="display: flex;flex-direction: column;margin: 20px;">
        {#if $activePopup === "show"}
          <CreateShow />
        {:else if $activePopup === "delete_show"}
          <DeleteShow />
        {:else if $activePopup === "icon"}
          <ChangeIcon />
        {:else if $activePopup === "rename"}
          <Rename />
        {:else if $activePopup === "about"}
          <About />
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .popup {
    position: absolute;
    background-color: rgb(0 0 0 / 0.8);
    /* pointer-events: none; */
    width: 100%;
    height: calc(100% - 30px);
    padding: 20px 300px;
    z-index: 80;

    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    position: relative;
    background-color: var(--primary);
    overflow-y: auto;

    min-width: 50%;
    min-height: 50px;
    max-width: 100%;
    max-height: 100%;
  }
</style>

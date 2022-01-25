<script type="ts">
  import { OUTPUT } from "../../../types/Channels"
  import { dictionary, outputDisplay } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import Button from "../inputs/Button.svelte"
  import TopButton from "../inputs/TopButton.svelte"

  function display() {
    outputDisplay.set(!$outputDisplay)
    window.api.send(OUTPUT, { channel: "DISPLAY", data: $outputDisplay })
  }
</script>

<div class="top">
  <span style="width: 300px;">
    <!-- logo -->
    <h1 style="align-self: center;width: 100%;padding: 0px 10px;text-align: center;">FreeShow</h1>
  </span>
  <span style="position: absolute;left: 50%;height: 100%;transform: translateX(-50%);">
    <TopButton id="show" />
    <TopButton id="edit" />
    <TopButton id="stage" />
    <TopButton id="draw" />
    <TopButton id="calendar" />
    <!-- <hr /> -->
  </span>
  <span>
    <TopButton id="settings" hideLabel />
    <Button
      title={$outputDisplay ? $dictionary.menu?._title_display_stop : $dictionary.menu?._title_display}
      on:click={display}
      class="display {$outputDisplay ? 'on' : 'off'}"
      red={$outputDisplay}
    >
      {#if $outputDisplay}
        <Icon id="cancelDisplay" size={1.8} white />
      {:else}
        <Icon id="display" size={1.8} white />
      {/if}
    </Button>
  </span>
</div>

<style>
  .top {
    position: relative;
    display: flex;
    justify-content: space-between;
    z-index: 30;
    min-height: 50px;
    height: 50px;
    /* box-shadow: 0px 2px 4px rgb(0 0 0 / 30%); */
    /* border-bottom: 4px solid var(--primary-lighter); */
  }
  .top span {
    display: flex;
  }

  div :global(button.display) {
    display: flex;
    justify-content: center;
    min-width: 60px;
  }

  /* div :global(button.display.on) {
    background-color: rgb(0 150 0 / 30%) !important;
  }
  div :global(button.display.off) {
    background-color: rgb(150 0 0 / 30%) !important;
  } */

  /* hr {
    background-color: var(--primary-lighter);
    width: 2px;
    height: 100%;
    border: none;
  } */

  /* div :global(button) {
    display: flex;
    justify-content: center;
    min-width: 100px;
    height: 100%;
  }
  div :global(button) :global(svg) {
    padding: 0 0.8em;
    padding-left: 0;
  } */
</style>

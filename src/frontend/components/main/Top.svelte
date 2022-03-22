<script type="ts">
  import { OUTPUT } from "../../../types/Channels"
  import { dictionary, outputDisplay } from "../../stores"
  import { receive, send } from "../../utils/request"
  import Icon from "../helpers/Icon.svelte"
  import Button from "../inputs/Button.svelte"
  import TopButton from "../inputs/TopButton.svelte"

  function display() {
    outputDisplay.set(!$outputDisplay)
    send(OUTPUT, ["DISPLAY"], $outputDisplay)
  }

  receive(OUTPUT, { DISPLAY: (a: any) => outputDisplay.set(a) })
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
  }
  .top span {
    display: flex;
  }

  div :global(button.display) {
    display: flex;
    justify-content: center;
    min-width: 60px;
  }
</style>

<script type="ts">
  import { OUTPUT } from "../../../types/Channels"
  import { dictionary, outputDisplay, outputScreen } from "../../stores"
  import { send } from "../../utils/request"
  import Icon from "../helpers/Icon.svelte"
  import Button from "../inputs/Button.svelte"
  import TopButton from "../inputs/TopButton.svelte"

  function display(e: any) {
    send(OUTPUT, ["DISPLAY"], { enabled: !$outputDisplay, screen: $outputScreen, force: e.ctrlKey || e.metaKey })
  }
</script>

<div class="top">
  <span style="width: 300px;">
    <!-- logo -->
    <h1 style="align-self: center;width: 100%;padding: 0px 10px;text-align: center;">FreeShow</h1>
  </span>
  <span>
    <TopButton id="show" />
    <TopButton id="edit" />
    <TopButton id="stage" />
    <TopButton id="draw" />
    <TopButton id="calendar" />
  </span>
  <span style="width: 300px;justify-content: flex-end;">
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
        <Icon id="output" size={1.8} white />
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

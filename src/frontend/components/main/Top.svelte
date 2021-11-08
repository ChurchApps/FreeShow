<script type="ts">
  import { OUTPUT } from "../../../types/Channels"

  import { outputDisplay } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"

  import TopButton from "../inputs/TopButton.svelte"

  function display() {
    outputDisplay.set(!$outputDisplay)
    window.api.send(OUTPUT, { channel: "DISPLAY", data: $outputDisplay })
  }
</script>

<!-- <button on:click={() => (settings = !settings)}>
  <T id="menus.settings" />
  {translate('menus.settings', $language)}
  {translate(d.menus?.settings)}
</button> -->

<div class="top">
  <span>
    <TopButton id="show" />
    <TopButton id="edit" />
    <!-- <TopButton id="reflow" /> -->
    <TopButton id="draw" />
    <TopButton id="stage" />
  </span>
  <span>
    <TopButton id="calendar" />
    <TopButton id="settings" />
    <Button title="" active={$outputDisplay} on:click={display} class="display">
      <Icon id="display" size={1.8} />
      <span><T id={"menu.display"} /></span>
    </Button>
    <!-- Output -->
  </span>
</div>

<style>
  .top {
    position: relative;
    display: flex;
    justify-content: space-between;
    z-index: 30;
    height: 50px;
    /* box-shadow: 0px 2px 4px rgb(0 0 0 / 30%); */
    /* border-bottom: 4px solid var(--primary-lighter); */
  }
  .top span {
    display: flex;
  }

  div :global(button.display) {
    background-color: rgb(150 0 0 / 30%) !important;
    cursor: pointer;
  }
  div :global(button.display.active) {
    background-color: rgb(0 150 0 / 30%) !important;
  }

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

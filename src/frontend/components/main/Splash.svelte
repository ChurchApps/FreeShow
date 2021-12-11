<script lang="ts">
  import { MAIN } from "../../../types/Channels"
  import { dictionary } from "../../stores"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"

  import Button from "../inputs/Button.svelte"
  import Center from "../system/Center.svelte"

  let version: string = "0.0.0"
  window.api.send(MAIN, { channel: "GET_VERSION" })
  window.api.receive(MAIN, (data: any) => {
    if (data.channel === "GET_VERSION") version = data.data
  })
</script>

<Center>
  <h1>FreeShow</h1>
  <p style="padding: 30px">v{version} (Beta)</p>

  <span class="buttons">
    <Button on:click={() => history({ id: "newProject" })} title={$dictionary.new?.project}>
      <Icon id="project" white style="padding-right: 10px;" />
      <T id="new.project" />
    </Button>
    <Button on:click={(e) => history({ id: e.ctrlKey ? "newShowDrawer" : "newShow" })} title={$dictionary.new?.show}>
      <Icon id="showIcon" white style="padding-right: 10px;" />
      <T id="new.show" />
    </Button>
  </span>
</Center>

<style>
  h1 {
    font-size: 4em;
    overflow: initial;
  }

  p {
    opacity: 0.8;
    overflow: initial;
  }

  .buttons {
    display: flex;
    /* flex-direction: column; */
  }
  .buttons :global(button) {
    background-color: var(--secondary);
    color: var(--secondary-text);
    font-size: 1em;
    margin: 10px;
  }
</style>

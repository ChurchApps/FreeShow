<script lang="ts">
  import { MAIN, OUTPUT } from "../../../types/Channels"
  import { outputDisplay, outputScreen } from "../../stores"
  import { receive, send } from "../../utils/request"
  import T from "../helpers/T.svelte"

  let screens: any[] = []
  send(MAIN, ["GET_DISPLAYS"])
  receive(MAIN, {
    GET_DISPLAYS: (d: any) => {
      screens = d
    },
    SET_SCREEN: (d: any) => {
      if (!$outputScreen) outputScreen.set(d.id.toString())
    },
  })

  function changeOutputScreen(e: any) {
    outputScreen.set(e.detail.id.toString())
    if ($outputDisplay) send(OUTPUT, ["DISPLAY"], { enabled: true, screen: $outputScreen })
  }
</script>

<div class="content">
  {#if screens.length}
    <div class="screens">
      {#each screens as screen, i}
        <div
          class="screen"
          class:active={$outputScreen === screen.id.toString()}
          style="width: {screen.bounds.width}px;height: {screen.bounds.height}px;left: {screen.bounds.x}px;top: {screen.bounds.y}px;"
          on:click={() => changeOutputScreen({ detail: { id: screen.id } })}
        >
          {i + 1}
        </div>
      {/each}
    </div>
  {:else}
    <T id="remote.loading" />
  {/if}
</div>

<style>
  .content {
    width: 50%;
    display: flex;
    /* align-items: center; */
    justify-content: center;
  }
  .screens {
    zoom: 0.1;
    font-size: 20em;
    overflow: visible;
    position: relative;
    margin-top: auto;
  }

  .screen {
    background-color: var(--primary);
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    outline: 20px solid var(--primary-lighter);
    cursor: pointer;
    transition: background-color 0.1s;
  }

  .screen:hover {
    background-color: var(--primary-lighter);
  }

  .screen.active {
    background-color: var(--secondary);
    color: var(--secondary-text);
    cursor: default;
  }
</style>

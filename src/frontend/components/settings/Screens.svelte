<script lang="ts">
  import { MAIN, OUTPUT } from "../../../types/Channels"
  import { currentOutputSettings, outputDisplay, outputs } from "../../stores"
  import { receive, send } from "../../utils/request"
  import T from "../helpers/T.svelte"

  let screens: any[] = []

  let screenId: string | null = null
  $: screenId = $currentOutputSettings

  send(MAIN, ["GET_DISPLAYS"])
  // send(MAIN, ["GET_SCREENS"])
  receive(MAIN, {
    GET_DISPLAYS: (d: any) => {
      screens = d
    },
    SET_SCREEN: (d: any) => {
      if (!$outputs[screenId!].screen) {
        outputs.update((a) => {
          a[screenId!].screen = d.id.toString()
          return a
        })
      }
    },
    // GET_SCREENS: (d: any) => (screens = d),
  })

  function changeOutputScreen(e: any) {
    if (!screenId) return

    let bounds = e.detail.bounds
    outputs.update((a) => {
      a[screenId!].bounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
      a[screenId!].screen = e.detail.id.toString()
      a[screenId!].kiosk = true
      return a
    })
    setTimeout(() => {
      send(OUTPUT, ["DISPLAY"], { enabled: $outputDisplay, output: { id: screenId, ...$outputs[screenId!] }, reset: true })
      // send(OUTPUT, ["TOGGLE_KIOSK"], { id: screenId, enabled: true })
      // setTimeout(() => {
      send(OUTPUT, ["UPDATE_BOUNDS"], { id: screenId, ...$outputs[screenId!] })
      // }, 100)
    }, 100)
  }
</script>

<div class="content">
  {#if screens.length}
    <div class="screens">
      {#each screens as screen, i}
        <div
          class="screen"
          class:active={$outputs[screenId || ""].screen === screen.id.toString()}
          style="width: {screen.bounds.width}px;height: {screen.bounds.height}px;left: {screen.bounds.x}px;top: {screen.bounds.y}px;"
          on:click={() => changeOutputScreen({ detail: { id: screen.id, bounds: screen.bounds } })}
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
    width: 100%;
    display: flex;
    /* justify-content: center; */
    /* transform: translateX(-20%); */
  }
  .screens {
    zoom: 0.08;
    font-size: 20em;
    overflow: visible;
    position: relative;
    margin-top: auto;

    /* width: 30%;
    position: absolute;
    left: 50%;
    transform: translateX(-50%); */
  }

  .screen {
    position: absolute;
    /* transform: translateX(-50%); */

    display: flex;
    align-items: center;
    justify-content: center;

    background-color: var(--primary);
    outline: 40px solid var(--primary-lighter);
    cursor: pointer;
    transition: background-color 0.1s;
  }

  .screen:hover {
    background-color: var(--primary-lighter);
  }

  .screen.active {
    background-color: var(--secondary);
    color: var(--secondary-text);
  }
</style>

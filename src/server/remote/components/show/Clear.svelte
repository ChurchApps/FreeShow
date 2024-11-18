<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import Button from "../../../common/components/Button.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"

    export let dictionary: any
    export let locked: boolean = false
    export let outBackground: null | string = null
    export let outSlide: null | number
    export let outOverlays: string[] = []
    export let outAudio: string[] = []

    let out: boolean = outBackground !== null || outSlide !== null || outOverlays.length || outAudio.length ? true : false

    let dispatcher = createEventDispatcher()
    function click(id: string, value: any) {
        dispatcher("click", { id, value })
    }

    const clearAll = () => {
        click("OUT", "clear")
        // outSlide = null
    }
</script>

<div class="clear">
    <span>
        <!-- <button on:click={() => output.set(new OutputObject())}>Clear All</button> -->
        <Button class="clearAll" disabled={locked || !out} on:click={clearAll} red dark center>
            <!-- <T id={"clear.all"} /> -->
            <Icon id="clear" size={1.2} />
            <span style="padding-left: 10px;">{translate("clear.all", $dictionary)}</span>
        </Button>
    </span>
    <!-- <span class="group">
    <Button
      disabled={locked || !outBackground}
      on:click={() => {
        if (!locked) {
          outBackground = null
          // clearVideo()
        }
      }}
      red
      dark
      center
    >
      <Icon id="background" size={1.2} />
    </Button>
    <Button
      disabled={locked || outSlide === null}
      on:click={() => {
        if (!locked) {
          click("OUT", "clear")
          // outSlide = null
        }
      }}
      red
      dark
      center
    >
      <Icon id="slide" size={1.2} />
    </Button>
    <Button
      disabled={locked || !outOverlays.length}
      on:click={() => {
        if (!locked) {
          outOverlays = []
        }
      }}
      red
      dark
      center
    >
      <Icon id="overlays" size={1.2} />
    </Button>
  </span> -->
</div>

<style>
    .clear {
        display: flex;
        flex-direction: column;
        width: 100%;
        font-size: 0.7em;
    }
    .clear :global(button) {
        width: 100%;
        flex: 1;
    }
    /* .group {
    display: flex;
  } */
</style>

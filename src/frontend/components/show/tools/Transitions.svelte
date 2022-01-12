<script lang="ts">
  import { activeShow, shows } from "../../../stores"
  import { GetLayout } from "../../helpers/get"
  import Icon from "../../helpers/Icon.svelte"
  import Button from "../../inputs/Button.svelte"
  import TextInput from "../../inputs/TextInput.svelte"

  $: show = $shows[$activeShow!.id]
  $: slides = GetLayout($activeShow!.id)
</script>

<div>
  <div style="display: flex;align-items: center;padding: 10px;gap: 10px;">
    <TextInput style="min-width: 50px;flex: 1;" value="10" on:change={() => console.log("change")} center />
    <Button style="flex: 3;" dark center>[[[Apply to all]]]</Button>
  </div>
  {#each slides as slide, i}
    <div class="slide">
      <span style="margin: 10px 5px;min-width: 20px;text-align: center;opacity: 0.8;">{i + 1}</span>
      <p style="flex: 3;height: 100%;margin: 0 5px;padding: 5px;background-color: {slide.color || 'var(--primary-lighter)'};">{show.slides[slide.id].label || ""}</p>
      <!-- transition -->
      <Button style="height: 100%;">
        <Icon id="transition" />
      </Button>
      <!-- next timer -->
      <!-- empty or 0 === disabled -->
      <TextInput style="min-width: 50px;flex: 1;" value="10" on:change={() => console.log("change")} center />
      <!-- to beginning -->
      <Button style="height: 100%;">
        <Icon id="restart" white={true} />
      </Button>
    </div>
  {/each}
  <Button>
    <Icon id="reset" />
    [[[Reset]]]
  </Button>
</div>

<style>
  .slide {
    display: flex;
    align-items: center;
    height: 30px;
    margin: 10px 0;
  }
</style>

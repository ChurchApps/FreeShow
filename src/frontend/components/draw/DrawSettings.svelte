<script lang="ts">
  import { drawSettings, drawTool } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import Checkbox from "../inputs/Checkbox.svelte"
  import Color from "../inputs/Color.svelte"
  import NumberInput from "../inputs/NumberInput.svelte"
  import Panel from "../system/Panel.svelte"

  const defaults: any = {
    focus: {
      color: "#000000",
      opacity: 0.8,
      size: 300,
      glow: true,
      hold: false,
    },
    pointer: {
      color: "#FF0000",
      opacity: 0.8,
      size: 50,
      // type: "circle",
      glow: true,
      hold: false,
    },
    fill: {
      color: "#000000",
      opacity: 0.8,
      rainbow: false,
    },
    paint: {
      color: "#ffffff",
      size: 10,
      hold: true,
      threed: false,
      dots: false,
    },
    particles: {
      color: "#1e1eb4",
      opacity: 0.8,
      size: 100,
      glow: true,
      hold: false,
    },
  }

  const input = (e: any, key: string) => update(key, e.target.value)
  const change = (e: any, key: string) => update(key, e.detail)
  const check = (e: any, key: string) => update(key, e.target.checked)

  const update = (key: string, value: any) => {
    drawSettings.update((ds: any) => {
      ds[$drawTool][key] = value
      return ds
    })
  }

  $: if (!Object.keys($drawSettings[$drawTool] || {}).length) reset()
  function reset() {
    drawSettings.update((ds: any) => {
      ds[$drawTool] = JSON.parse(JSON.stringify(defaults[$drawTool] || {}))
      return ds
    })
  }
</script>

<div class="main border">
  <Panel>
    {#key $drawTool}
      <h6><T id="draw.{$drawTool}" /></h6>
      <div style="display: flex;gap: 10px;">
        <span class="titles">
          {#if $drawSettings[$drawTool]}
            {#each Object.keys($drawSettings[$drawTool]) as key}
              {#if key !== "clear" && (key !== "hold" || $drawTool !== "paint")}
                <p><T id="draw.{key}" /></p>
              {/if}
            {/each}
          {/if}
        </span>

        <span style="display: flex;flex-direction: column;justify-content: space-around;align-items: end;">
          {#if $drawSettings[$drawTool]}
            {#each Object.entries($drawSettings[$drawTool]) as [key, value]}
              {#if key === "color"}
                <Color {value} on:input={(e) => input(e, key)} style="width: 100%;" />
              {:else if (key !== "hold" || $drawTool !== "paint") && ["glow", "hold", "rainbow", "dots", "threed"].includes(key)}
                <Checkbox checked={value} on:change={(e) => check(e, key)} />
              {:else if key === "opacity"}
                <NumberInput {value} step={0.1} decimals={1} max={1} inputMultiplier={10} on:change={(e) => change(e, key)} />
              {:else if key !== "clear" && key !== "hold"}
                <NumberInput {value} min={1} max={2000} on:change={(e) => change(e, key)} />
              {/if}
            {/each}
          {/if}
        </span>
      </div>
    {/key}
  </Panel>
</div>

{#if $drawTool === "paint"}
  <Button style="flex: 1;" on:click={() => update("clear", true)} dark center>
    <Icon id="clear" right />
    <T id="clear.all" />
  </Button>
{/if}

<Button style="flex: 1;" on:click={reset} dark center>
  <Icon id="reset" right />
  <T id="actions.reset" />
</Button>

<style>
  .main {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    height: 100%;
    padding: 10px;
  }

  p {
    height: 35px;
    display: flex;
    align-items: center;
  }
</style>

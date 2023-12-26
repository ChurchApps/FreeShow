<script lang="ts">
    import { drawSettings, drawTool } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import Button from "../inputs/Button.svelte"
    import Checkbox from "../inputs/Checkbox.svelte"
    import Color from "../inputs/Color.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import NumberInput from "../inputs/NumberInput.svelte"
    import Panel from "../system/Panel.svelte"

    const defaults: any = {
        focus: {
            color: "#000000",
            opacity: 0.8,
            size: 300,
            radius: 50,
            glow: true,
            hold: false,
        },
        pointer: {
            color: "#FF0000",
            opacity: 0.8,
            size: 100,
            radius: 50,
            glow: false,
            hollow: true,
            hold: false,
        },
        zoom: {
            opacity: 1,
            size: 300,
            radius: 50,
            hold: false,
        },
        particles: {
            color: "#1e1eb4",
            opacity: 0.8,
            size: 20,
            radius: 25,
            glow: false,
            hollow: false,
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
            // not saved:
            threed: false,
            dots: false,
            hold: true, // always true
        },
    }

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
            ds[$drawTool] = clone(defaults[$drawTool] || {})
            return ds
        })
    }
</script>

<div class="main border">
    <Panel>
        {#key $drawTool}
            <h6 style="margin-top: 10px;"><T id="draw.{$drawTool}" /></h6>
            {#key $drawSettings}
                {#if $drawSettings[$drawTool]}
                    {#each Object.entries($drawSettings[$drawTool]) as [key, value]}
                        <CombinedInput>
                            {#if key !== "clear" && (key !== "hold" || $drawTool !== "paint")}
                                <p><T id="draw.{key}" /></p>
                            {/if}
                            {#if key === "color"}
                                <Color {value} on:input={(e) => change(e, key)} style="width: 100%;" />
                            {:else if (key !== "hold" || $drawTool !== "paint") && ["glow", "hold", "rainbow", "hollow", "dots", "threed"].includes(key)}
                                <div class="alignRight">
                                    <Checkbox checked={value} on:change={(e) => check(e, key)} />
                                </div>
                            {:else if key === "opacity"}
                                <NumberInput {value} step={0.1} decimals={1} max={1} inputMultiplier={10} on:change={(e) => change(e, key)} />
                            {:else if key === "radius"}
                                <NumberInput {value} step={0.5} decimals={1} max={50} inputMultiplier={2} on:change={(e) => change(e, key)} />
                            {:else if key !== "clear" && key !== "hold"}
                                <NumberInput {value} min={1} max={2000} on:change={(e) => change(e, key)} />
                            {:else}
                                <div class="empty">
                                    <!-- {key} -->
                                </div>
                            {/if}
                        </CombinedInput>
                    {/each}
                {/if}
            {/key}
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

    .empty {
        background-color: var(--primary);
        width: 100%;
    }
</style>

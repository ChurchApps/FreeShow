<script lang="ts">
    import { stageShows } from "../../stores"
    import HiddenInput from "../inputs/HiddenInput.svelte"
    import Zoomed from "../slide/Zoomed.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import Stagebox from "./Stagebox.svelte"

    // WIP
    interface Show {
        settings: any
        name: string
        disabled: boolean
        password: string
        items: {
            [key: string]: any
        }
    }
    export let show: Show
    // export let title: string
    export let id: string
    export let index: number
    export let columns: number = 1
    export let active: boolean = false
    export let list: boolean = false

    console.log(show)

    let ratio: number = 1

    function edit(e: any) {
        let name = e.detail.value
        stageShows.update((a) => {
            a[id].name = name
            return a
        })
    }
</script>

<div class="main" class:active style="width: {100 / columns}%" class:list>
    <div class="slide context #stage_slide" class:disabled={show.disabled} style={show.settings.color ? `background-color: ${show.settings.color};` : ""} tabindex={0} on:click>
        <div style="width: 100%;">
            <SelectElem id="stage" data={{ id }}>
                <Zoomed background={show.items.length ? "black" : "transparent"} style="width: 100%;" disableStyle bind:ratio>
                    {#each Object.entries(show.items) as [id, item]}
                        {#if item.enabled !== false}
                            <Stagebox {id} {item} {ratio} {show} />
                        {/if}
                    {/each}
                </Zoomed>
                <div class="label" title={show.name}>
                    <span style="position: absolute;display: contents;">{index + 1}</span>
                    <span class="text">
                        <!-- {#if show.name}
              {show.name}
            {:else}
              <span style="opacity: 0.5;"><T id="main.unnamed" /></span>
            {/if} -->
                        <HiddenInput value={show.name} id={"stage_" + id} on:edit={edit} allowEmpty={false} />
                    </span>
                </div>
            </SelectElem>
        </div>
    </div>
</div>

<style>
    .main {
        display: flex;
        position: relative;
        padding: 5px;
    }
    .main.list {
        width: 100%;
    }
    .main.active {
        outline: 2px solid var(--secondary-opacity);
        outline-offset: -1px;
        z-index: 2;
    }

    .slide {
        /* padding: 3px; */
        /* TODO: global settings background */
        background-color: #000000;
        z-index: 0;
        outline-offset: 0;
        width: 100%;

        position: relative;
        display: flex;

        /* height: fit-content; */
        /* border: 2px solid var(--primary-lighter); */
    }
    .slide.disabled {
        opacity: 0.2;
    }

    .label {
        background-color: var(--primary);

        display: flex;
        padding: 0 5px;
        /* padding-bottom: 2px; */
        font-size: 0.8em;
        font-weight: bold;
        align-items: center;
        /* opacity: 0.8; */
    }

    .label .text {
        width: 100%;
        margin: 0 20px;
        text-align: center;
        overflow-x: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .text :global(p) {
        margin: 4px;
    }
</style>

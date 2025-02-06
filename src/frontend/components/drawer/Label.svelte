<script lang="ts">
    import { fullColors, overlays, playerVideos, templates } from "../../stores"
    import { getContrast } from "../helpers/color"
    import Icon from "../helpers/Icon.svelte"
    import HiddenInput from "../inputs/HiddenInput.svelte"

    export let label: string
    export let count: number = 0
    export let renameId: string = ""
    export let title: string = ""
    export let icon: null | string = null
    export let color: null | string = null
    export let white: boolean = false
    export let mode: "grid" | "list" | "lyrics" = "grid"

    // RENAME!! (duplicate of NavigationButton.svelte)

    const nameCategories: any = {
        overlay: (c: any) => overlays.update((a) => setName(a, c)),
        template: (c: any) => templates.update((a) => setName(a, c)),
        player: (c: any) => playerVideos.update((a) => setName(a, c)),
    }
    const setName = (a: any, { name, id }: any, nameKey: string = "name") => {
        if (!a[id]) return a

        a[id][nameKey] = name
        return a
    }

    function changeName(e: any, categoryId: string) {
        let idSplit = categoryId.split("_")
        let id: string = idSplit[0]
        let elemId: string = idSplit[1]

        if (nameCategories[id]) nameCategories[id]({ name: e.detail.value, id: elemId })
        else console.log("Trying to rename unadded type: " + id)
    }

    let editActive: boolean = false
</script>

<div
    class="label"
    class:alignRight={icon}
    class:padding={!renameId}
    {title}
    class:list={mode !== "grid"}
    style={$fullColors ? `background-color: ${color};color: ${getContrast(color || "")};` : mode !== "list" ? `border-bottom: 2px solid ${color};` : ""}
>
    {#if icon}
        <Icon id={icon} class="icon" {white} />
    {/if}

    {#if renameId}
        <HiddenInput value={label} id={renameId} on:edit={(e) => changeName(e, renameId)} bind:edit={editActive} />
    {:else}
        <span class="title" style={count ? "margin-right: 14px;" : ""}>
            {label}
            {#if count}<span style="opacity: 0.6;font-size: 0.8em;position: absolute;right: 6px;top: 50%;transform: translateY(-50%);">{count}</span>{/if}
        </span>
    {/if}
</div>

<style>
    .label {
        position: relative;
        display: flex;
        align-items: center;
        background-color: var(--primary-darkest);

        font-size: 0.8em;
        /* font-weight: bold; */

        height: 25px;
        flex: 1;

        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;

        width: 100%;
        text-align: center;
    }

    /* edit input */
    .padding {
        padding: 4px 5px;
        padding-bottom: 3px;
    }
    div.label:not(.padding) :global(.icon) {
        margin-left: 3px;
    }
    .label :global(input) {
        padding: 6px;
    }
    div.label.alignRight :global(p),
    div.label.alignRight :global(input) {
        margin-left: 20px;
    }
    div.label :global(p),
    div.label :global(input) {
        text-align: center;
    }

    div.label.list {
        height: 100%;
        font-size: inherit;
        padding: 4px 16px;
        background-color: var(--primary);
    }

    div.label :global(.icon) {
        position: absolute;
    }

    div.label .title {
        width: 100%;
        margin: 0 5px;
        text-align: center;
        overflow-x: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        /* display: flex;
        align-items: center; / * baseline * /
        justify-content: space-between;
        gap: 5px; */
    }
    div.label.alignRight .title {
        margin: 0;
        margin-left: 24px;
    }
    div.label.list .title {
        text-align: left;
        padding: 0 10px;
    }
</style>

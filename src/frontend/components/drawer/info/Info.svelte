<script lang="ts">
    import { activeShow, focusMode, forceClock } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"
    import Clock from "../../system/Clock.svelte"
    import Date from "../../system/Date.svelte"
    import AudioInfo from "./AudioInfo.svelte"
    import CalendarInfo from "./CalendarInfo.svelte"
    import FunctionsInfo from "./FunctionsInfo.svelte"
    import MediaInfo from "./MediaInfo.svelte"
    import ScriptureInfo from "./ScriptureInfo.svelte"
    import ShowInfo from "./ShowInfo.svelte"
    import TemplateInfo from "./TemplateInfo.svelte"

    export let id: string

    const hasOptions = ["shows", "media", "templates", "scripture", "calendar"]
    let optionsOpen = false
    $: if (id) optionsOpen = false
</script>

<div class="main {id !== 'shows' || $activeShow !== null ? 'context #drawer_info' : ''}">
    {#if !$forceClock && id === "shows"}
        <ShowInfo {optionsOpen} />
    {:else if !$forceClock && id === "media"}
        <MediaInfo {optionsOpen} />
    {:else if !$forceClock && id === "audio"}
        <AudioInfo />
        <!-- {:else if !$forceClock && id === "overlays"}
        <OverlayInfo /> -->
    {:else if !$forceClock && id === "templates"}
        <TemplateInfo {optionsOpen} />
    {:else if !$forceClock && id === "scripture"}
        <ScriptureInfo {optionsOpen} />
    {:else if !$forceClock && id === "calendar"}
        <CalendarInfo {optionsOpen} />
    {:else if !$forceClock && id === "functions"}
        <FunctionsInfo />
    {:else}
        <Center>
            <Clock />
            <Date />
        </Center>
    {/if}

    {#if !$forceClock && hasOptions.includes(id) && !$focusMode}
        <FloatingInputs round>
            <MaterialButton isActive={optionsOpen} title="edit.options" on:click={() => (optionsOpen = !optionsOpen)}>
                <Icon size={1.1} id="options" white={!optionsOpen} />
            </MaterialButton>
        </FloatingInputs>
    {/if}
</div>

<style>
    div {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
    }

    div :global(h2) {
        color: var(--text);
    }
</style>

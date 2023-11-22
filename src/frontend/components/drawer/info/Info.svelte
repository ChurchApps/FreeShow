<script lang="ts">
    import { activeShow, drawerTabsData, forceClock } from "../../../stores"
    import Center from "../../system/Center.svelte"
    import Clock from "../../system/Clock.svelte"
    import Date from "../../system/Date.svelte"
    import AudioMix from "./AudioMix.svelte"
    import CalendarInfo from "./CalendarInfo.svelte"
    import MediaInfo from "./MediaInfo.svelte"
    import OverlayInfo from "./OverlayInfo.svelte"
    import ScriptureInfo from "./ScriptureInfo.svelte"
    import ShowInfo from "./ShowInfo.svelte"
    import TemplateInfo from "./TemplateInfo.svelte"

    export let id: string
    export let bibles: any
</script>

<div class="main context #drawer_info">
    {#if !$forceClock && id === "shows" && $activeShow !== null && ($activeShow.type === undefined || $activeShow.type === "show")}
        <ShowInfo />
    {:else if !$forceClock && id === "media" && ($activeShow?.type === "video" || $activeShow?.type === "image" || ["online", "screens"].includes($drawerTabsData.media?.activeSubTab || ""))}
        <MediaInfo />
    {:else if !$forceClock && id === "audio"}
        <AudioMix />
    {:else if !$forceClock && id === "overlays"}
        <OverlayInfo />
    {:else if !$forceClock && id === "templates"}
        <TemplateInfo />
    {:else if !$forceClock && id === "scripture"}
        <ScriptureInfo {bibles} />
    {:else if !$forceClock && id === "calendar"}
        <CalendarInfo />
    {:else}
        <Center>
            <Clock />
            <Date />
        </Center>
    {/if}
</div>

<style>
    div {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
    }
</style>

<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { MAIN } from "../../../../types/Channels"
    import { ShowRef } from "../../../../types/Projects"
    import { activeShow, os, presentationApps, presentationData } from "../../../stores"
    import { send } from "../../../utils/request"
    import Button from "../../inputs/Button.svelte"

    export let show: ShowRef
    console.log(show)

    onMount(() => {
        send(MAIN, ["SLIDESHOW_GET_APPS"])
    })

    $: if (show.id) newPresentation()
    function newPresentation() {
        send(MAIN, ["START_SLIDESHOW"], { path: show.id })
    }

    // id: path
    // info: {titles: string[], notes: string[]}
    // stat: {state: 'viewing', position: 1, slides: 2}
    $: console.log($presentationData)

    onDestroy(() => {
        if ($activeShow?.type !== "ppt") send(MAIN, ["PRESENTATION_CONTROL"], { action: "stop" })
    })
</script>

{#if $presentationApps === null}
    Loading...
{:else if !$presentationApps.length}
    Presentation controller not supported on {$os || "this OS"}.
{:else}
    <!-- WIP don't start until clicking "start" -->
    <!-- WIP turn off always on top -->

    <Button on:click={() => send(MAIN, ["PRESENTATION_CONTROL"], { action: "next" })}>Next</Button>
    <Button on:click={() => send(MAIN, ["PRESENTATION_CONTROL"], { action: "previous" })}>Previous</Button>
    <!-- <Button on:click={() => send(MAIN, ["PRESENTATION_CONTROL"], { action: "black" })}>Black</Button> -->
    <Button on:click={() => send(MAIN, ["PRESENTATION_CONTROL"], { action: "first" })}>First</Button>
    <Button on:click={() => send(MAIN, ["PRESENTATION_CONTROL"], { action: "last" })}>Last</Button>
    <!-- goto? -->

    <!-- WIP change app -->
    <!-- retry button (if not loaded) -->

    <!-- WIP start & show screen recording -->
    <!-- WIP controll from shortcuts + preview buttons!! -->
{/if}

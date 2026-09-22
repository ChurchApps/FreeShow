<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import Capture from "./Capture.svelte"

    let screens: { name: string; id: string }[] = []
    export let streams: MediaStream[]

    onMount(async () => {
        screens = (await requestMain(Main.GET_SCREENS)) || []
    })

    let dispatch = createEventDispatcher()
    function click(event: any, screen: { name: string; id: string }) {
        dispatch("click", { event, screen })
    }
</script>

{#each screens as screen}
    <Capture
        bind:streams
        {screen}
        on:click={(e) => click(e.detail || e, screen)}
    />
{/each}

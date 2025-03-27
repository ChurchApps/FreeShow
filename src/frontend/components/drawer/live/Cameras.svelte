<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import T from "../../helpers/T.svelte"
    import Center from "../../system/Center.svelte"
    import Cam from "./Cam.svelte"
    import { sortByName } from "../../helpers/array"

    let cams: { name: string; id: string; group: string }[] = []
    navigator.mediaDevices?.enumerateDevices()?.then((devices) => {
        if (!devices) return

        let cameraList = devices.filter((a) => a.kind === "videoinput").map((a) => ({ name: a.label, id: a.deviceId, group: a.groupId }))
        cams = sortByName(cameraList)
    })

    let dispatch = createEventDispatcher()
    function click(event, cam) {
        dispatch("click", { event, cam })
    }
</script>

{#if cams.length}
    {#each cams as cam}
        <Cam {cam} on:click={(e) => click(e, cam)} />
    {/each}
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}

<!-- {#if Object.keys(webcams).length}
  {#each Object.values(webcams) as cam}
    <Card {active} on:click label={cam.name} icon={"camera"} white>
      <img id="play" alt="cam" src={cam.src} style="transform: scaleX(-1);" />
    </Card>
  {/each}
{/if} -->

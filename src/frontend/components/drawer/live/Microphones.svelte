<script lang="ts">
    import T from "../../helpers/T.svelte"
    import Center from "../../system/Center.svelte"
    import Mic from "./Mic.svelte"

    interface Mics {
        [key: string]: {
            [key: string]: string
        }
    }

    let mics: Mics = {}
    navigator.mediaDevices?.enumerateDevices()?.then(function (devices) {
        if (!devices) return

        devices.forEach((d) => {
            if (d.kind !== "audioinput") return

            if (!mics[d.groupId]) mics[d.groupId] = {}
            mics[d.groupId][d.deviceId] = d.label
            // mics.push({ name: d.label, id: d.deviceId, group: d.groupId })
        })
    })
</script>

{#if Object.values(mics).length}
    <div class="row">
        {#each Object.values(mics) as mic}
            <div class="row">
                {#each Object.entries(mic) as m}
                    <Mic mic={{ id: m[0], name: m[1] }} />
                {/each}
            </div>
        {/each}
    </div>
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}

<style>
    .row {
        display: flex;
        flex-direction: column;
        width: 100%;
    }
</style>

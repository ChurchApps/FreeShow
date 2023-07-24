<script lang="ts">
    import T from "../../helpers/T.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
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
            console.log("DEVICE", d)

            if (!mics[d.groupId]) mics[d.groupId] = {}
            mics[d.groupId][d.deviceId] = d.label
            // mics.push({ name: d.label, id: d.deviceId, group: d.groupId })
        })
    })

    $: console.log(Object.values(mics))
</script>

<!-- TODO: sort by name -->
{#if Object.values(mics).length}
    <div class="row" style="gap: 10px;">
        {#each Object.values(mics) as mic}
            <div class="row">
                {#each Object.entries(mic) as m}
                    <span style="font-size: 0;position: absolute;">{console.log(m)}</span>
                    <SelectElem id="microphone" data={{ id: m[0], type: "microphone", name: m[1] }} draggable>
                        <Mic mic={{ id: m[0], name: m[1] }} />
                    </SelectElem>
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

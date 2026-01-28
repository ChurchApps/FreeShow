<script lang="ts">
    import { AudioMicrophone } from "../../../audio/audioMicrophone"
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
    AudioMicrophone.getList()?.then((devices) => {
        devices?.forEach((d) => {
            if (!mics[d.groupId]) mics[d.groupId] = {}
            mics[d.groupId][d.deviceId] = d.label
        })
    })
</script>

{#if Object.values(mics).length}
    <div class="row" style="gap: 10px;">
        {#each Object.values(mics) as mic}
            <div class="row">
                {#each Object.entries(mic) as [id, name]}
                    <SelectElem id="microphone" data={{ id, type: "microphone", name }} draggable>
                        <Mic mic={{ id, name }} />
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

<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import { Main } from "../../../types/IPC/Main"
    import { ToMain } from "../../../types/IPC/ToMain"
    import type { Option } from "../../../types/Main"
    import type { HidValue } from "../../../types/Show"
    import { receiveToMain, requestMain, sendMain } from "../../IPC/main"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"

    export let hidValue: HidValue | undefined

    let devicesList: Option[] = []
    onMount(async () => {
        const devices = await requestMain(Main.HID_DEVICES)
        devicesList = devices.filter((a) => a.product && a.manufacturer).map((a) => ({ name: `${a.product} (${a.manufacturer})`, id: a.path }))
    })

    $: if (!hidValue?.inputId) requestInput()
    function requestInput() {
        if (!hidValue?.deviceId) return

        const deviceId = hidValue.deviceId
        sendMain(Main.HID_AWAIT_INPUT, { path: deviceId })

        receiveToMain(ToMain.HID_DATA, (data) => {
            console.log("DATA", data)

            sendMain(Main.HID_CLOSE, { path: deviceId })
        })
    }

    let dispatch = createEventDispatcher()
    function updateDevice(e: any) {
        if (hidValue?.deviceId) {
            sendMain(Main.HID_CLOSE, { path: hidValue.deviceId })
        }

        hidValue = { deviceId: e.detail.id, inputId: null }
        dispatch("change", hidValue)
    }
</script>

<CombinedInput>
    <p>Device</p>
    <Dropdown value={devicesList.find((a) => a.id === hidValue?.deviceId)?.name || "—"} activeId={hidValue?.deviceId} options={devicesList} on:click={updateDevice} />
</CombinedInput>

{#if hidValue?.deviceId}
    <CombinedInput>
        <p>Input</p>

        {#if !hidValue?.inputId}
            <p style="font-style: italic;opacity: 0.¨7;">Awaiting input...</p>
        {:else}
            <p>{hidValue.inputId}</p>
            <!-- WIP REMOVE INPUT "X" BUTTON -->
        {/if}
    </CombinedInput>
{/if}

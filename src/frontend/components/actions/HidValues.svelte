<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { Main } from "../../../types/IPC/Main"
    import { ToMain } from "../../../types/IPC/ToMain"
    import type { Option } from "../../../types/Main"
    import type { HidValue } from "../../../types/Show"
    import { destroyMain, receiveToMain, requestMain, sendMain } from "../../IPC/main"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"

    export let hidValue: HidValue | undefined

    let devicesList: Option[] = []
    onMount(loadDevices)

    async function loadDevices() {
        try {
            const devices = await requestMain(Main.HID_DEVICES)
            devicesList = (devices || []).map((d) => {
                const product = d.product || "Unknown device"
                const manufacturer = d.manufacturer || "Unknown vendor"
                const interfaceInfo = d.interface ? ` · ${d.interface}` : ""
                return { name: `${product} (${manufacturer})${interfaceInfo}`, id: d.path }
            }) as Option[]
        } catch (err) {
            console.log("HID DEVICES LOAD ERROR:", err)
            devicesList = []
        }
    }

    let listenerId: string | null = null
    let listeningPath = ""

    const formatInputId = (data: ArrayLike<number>) =>
        Array.from(data)
            .map((value) => Number(value).toString(16).padStart(2, "0"))
            .join(" ")

    function stopListening(path = listeningPath) {
        if (path) sendMain(Main.HID_CLOSE, { path })
        listeningPath = ""

        if (!listenerId) return
        destroyMain(listenerId)
        listenerId = null
    }

    $: if (!hidValue?.inputId) requestInput()

    function requestInput() {
        if (!hidValue?.deviceId) return

        const deviceId = hidValue.deviceId
        if (listeningPath === deviceId && listenerId) return

        if (listenerId) stopListening()

        listeningPath = deviceId
        sendMain(Main.HID_AWAIT_INPUT, { path: deviceId })

        listenerId = receiveToMain(ToMain.HID_DATA, (data) => {
            console.log("DATA", data)

            const inputId = formatInputId(data as ArrayLike<number>)
            hidValue = { ...hidValue!, inputId }
            dispatch("change", hidValue)

            // cleanup listener after first registered input
            stopListening(deviceId)
        })
    }

    onDestroy(() => stopListening())

    let dispatch = createEventDispatcher()

    function updateDevice(e: CustomEvent<{ id: string }>) {
        if (hidValue?.deviceId) stopListening(hidValue.deviceId)
        else stopListening()

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
            <p style="font-style: italic;opacity: 0.7;">Awaiting input...</p>
        {:else}
            <p>{hidValue.inputId}</p>
            <!-- WIP REMOVE INPUT "X" BUTTON -->
        {/if}
    </CombinedInput>
{/if}

<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { Main } from "../../../types/IPC/Main"
    import { ToMain } from "../../../types/IPC/ToMain"
    import type { HidValues } from "../../../types/Show"
    import { destroyMain, receiveToMain, requestMain, sendMain } from "../../IPC/main"
    import InputRow from "../input/InputRow.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
    import MaterialTextInput from "../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../inputs/MaterialToggleSwitch.svelte"

    export let value: HidValues = {}
    export let simple = false

    $: hid = value || {}

    let dispatch = createEventDispatcher()
    function change() {
        dispatch("change", hid)
    }

    function setHid(key: keyof HidValues, val: any) {
        hid[key] = val
        hid = hid
        change()
    }

    let devices: any[] = []
    function formatDeviceLabel(d: any): string {
        if (!d) return "—"
        const baseName = d.product || d.manufacturer || "HID Device"
        return d.manufacturer && d.product && !d.product.toLowerCase().includes(d.manufacturer.toLowerCase()) ? `${d.manufacturer} - ${baseName}` : baseName
    }

    function requestDevices() {
        requestMain(Main.GET_HID_DEVICES, undefined, (data) => {
            if (!data?.length) return
            devices = data
            const firstDevice = data.find((d) => !d.permission) || data[0]
            if (!hid.device && firstDevice?.path) {
                setHid("device", firstDevice.path)
                setHid("deviceName", formatDeviceLabel(firstDevice))
                sendMain(Main.RECEIVE_HID, { path: firstDevice.path })
            }
        })
    }

    let autoValues = true
    onMount(() => {
        autoValues = !hid.data?.length
        requestDevices()
        if (hid.device) sendMain(Main.RECEIVE_HID, { path: hid.device })
    })

    function onDeviceChange(e: CustomEvent<string>) {
        const path = e.detail
        setHid("device", path)
        const found = devices.find((d) => d.path === path)
        if (found) setHid("deviceName", formatDeviceLabel(found))
        sendMain(Main.RECEIVE_HID, { path })
    }

    function toggleAutoValues(e: any) {
        autoValues = e.detail ?? e
        if (autoValues && hid.device) {
            sendMain(Main.RECEIVE_HID, { path: hid.device })
        }
    }

    let listenerId = receiveToMain(ToMain.HID_DATA, (msg) => {
        if (!autoValues || !msg) return
        const receivedPath = msg.path || ""
        const receivedData = msg.data || (Array.isArray(msg) ? msg : [])
        if (!receivedData?.length) return

        const isMatch = !hid.device || !receivedPath || hid.device.toLowerCase() === receivedPath.toLowerCase()
        if (isMatch) {
            setHid("data", receivedData)
        }
    })

    onDestroy(() => {
        destroyMain(listenerId)
    })

    function onDataInput(e: CustomEvent<string>) {
        const raw = e.detail || ""
        const numbers = raw
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n))
        setHid("data", numbers)
    }

    $: dataString = Array.isArray(hid.data) ? hid.data.join(", ") : ""

    $: selectedDevice = devices.find((d) => d.path === hid.device)
    $: udevRule = selectedDevice ? `SUBSYSTEM=="hidraw", ATTRS{idVendor}=="${hex(selectedDevice.vendorId)}", ATTRS{idProduct}=="${hex(selectedDevice.productId)}", MODE="0660", TAG+="uaccess"` : ""
    function hex(value: number) {
        return (value || 0).toString(16).padStart(4, "0")
    }

    function openInputMonitoringSettings() {
        sendMain(Main.URL, "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent")
    }
</script>

<MaterialDropdown label="settings.device" value={hid.device || ""} options={devices.map((d) => ({ value: d.path, label: formatDeviceLabel(d) }))} on:change={onDeviceChange} />

{#if selectedDevice?.permission === "input_monitoring"}
    <InputRow>
        <p style="font-size: 0.7em;opacity: 0.8;">macOS requires the Input Monitoring permission to read clickers and keyboards. Enable in the System Settings.</p>
        <MaterialButton variant="outlined" style="white-space: nowrap;" on:click={openInputMonitoringSettings}>Open System Settings</MaterialButton>
    </InputRow>
{:else if selectedDevice?.permission === "udev"}
    <InputRow>
        <p style="font-size: 0.7em;opacity: 0.8;">Add this udev rule to /etc/udev/rules.d/70-freeshow-hid.rules and reconnect the device to grant access:</p>
    </InputRow>
    <InputRow>
        <code style="font-size: 0.7em;user-select: text;word-break: break-all;">{udevRule}</code>
    </InputRow>
{/if}

{#if !simple}
    <br />
{/if}

<MaterialToggleSwitch label="hid.auto_values" checked={autoValues} on:change={toggleAutoValues} />

<MaterialTextInput label="hid.data_bytes" value={dataString} on:change={onDataInput} />

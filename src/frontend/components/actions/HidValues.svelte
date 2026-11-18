<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { Main } from "../../../types/IPC/Main"
    import { ToMain } from "../../../types/IPC/ToMain"
    import type { HidValues } from "../../../types/Show"
    import { destroyMain, receiveToMain, requestMain, sendMain } from "../../IPC/main"
    import T from "../helpers/T.svelte"
    import InputRow from "../input/InputRow.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
    import MaterialTextInput from "../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../inputs/MaterialToggleSwitch.svelte"
    import { activeHidPaths } from "./hid"

    export let value: HidValues = {}
    export let simple = false

    $: hid = value || {}

    let dispatch = createEventDispatcher()
    function change() {
        dispatch("change", hid)
    }

    function setHid(key: keyof HidValues, val: any) {
        hid[key] = val
        change()
    }

    let devices: any[] = []
    function formatDeviceLabel(d: any, allDevices: any[] = devices): string {
        if (!d) return "—"
        const baseName = d.product || d.manufacturer || "HID Device"
        const fullName = d.manufacturer && d.product && !d.product.toLowerCase().includes(d.manufacturer.toLowerCase()) ? `${d.manufacturer} - ${baseName}` : baseName

        // Check if there are multiple entries with the same vendorId and productId
        const duplicates = allDevices.filter((item) => item.vendorId === d.vendorId && item.productId === d.productId)
        if (duplicates.length > 1) {
            const iface = d.interface !== undefined && d.interface >= 0 ? `Interface ${d.interface}` : ""
            const col = d.path ? d.path.match(/Col\d+/i)?.[0] || "" : ""
            const usage = d.usagePage ? `Usage 0x${d.usagePage.toString(16).toUpperCase()}` : ""
            const details = [iface, col, usage].filter(Boolean).join(", ")
            return details ? `${fullName} (${details})` : `${fullName} [${(d.path || "").slice(-12)}]`
        }

        return fullName
    }

    function requestDevices() {
        requestMain(Main.GET_HID_DEVICES, undefined, (data) => {
            if (!data?.length) return
            devices = data
            const firstDevice = data.find((d) => !d.permission) || data[0]
            if (!hid.device && firstDevice?.path) {
                setHid("device", firstDevice.path)
                setHid("deviceName", formatDeviceLabel(firstDevice, data))
                sendMain(Main.RECEIVE_HID, { path: firstDevice.path })
            }
        })
    }

    let autoValues = true
    onMount(() => {
        autoValues = !hid.data?.length
        requestDevices()
        if (autoValues && hid.device) {
            sendMain(Main.RECEIVE_HID, { path: hid.device })
        }
    })

    function onDeviceChange(e: CustomEvent<string>) {
        const prevPath = hid.device
        const path = e.detail
        setHid("device", path)
        const found = devices.find((d) => d.path === path)
        if (found) {
            setHid("deviceName", formatDeviceLabel(found))
        }
        if (prevPath && prevPath !== path && !isDeviceUsedElsewhere(prevPath)) {
            sendMain(Main.CLOSE_HID, { path: prevPath })
        }
        if (autoValues) sendMain(Main.RECEIVE_HID, { path })
    }

    function isDeviceUsedElsewhere(path: string): boolean {
        if (!path) return false
        return activeHidPaths.has(path)
    }

    function toggleAutoValues(e: any) {
        autoValues = e.detail ?? e
        if (autoValues) {
            if (hid.device) sendMain(Main.RECEIVE_HID, { path: hid.device })
        } else {
            if (hid.device && !isDeviceUsedElsewhere(hid.device)) {
                sendMain(Main.CLOSE_HID, { path: hid.device })
            }
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
        // Let hidInListen reconcile device listeners once saved
        setTimeout(() => {
            if (hid.device && !isDeviceUsedElsewhere(hid.device)) {
                sendMain(Main.CLOSE_HID, { path: hid.device })
            }
        }, 150)
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
        <p style="font-size: 0.7em;opacity: 0.8;"><T id="hid.tip_input_monitoring" /></p>
        <MaterialButton variant="outlined" style="white-space: nowrap;" on:click={openInputMonitoringSettings}>Open System Settings</MaterialButton>
    </InputRow>
{:else if selectedDevice?.permission === "udev"}
    <InputRow>
        <p style="font-size: 0.7em;opacity: 0.8;"><T id="hid.tip_udev" replace={["/etc/udev/rules.d/70-freeshow-hid.rules"]} /></p>
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

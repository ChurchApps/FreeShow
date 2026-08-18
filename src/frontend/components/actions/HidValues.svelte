<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { Main } from "../../../types/IPC/Main"
    import { ToMain } from "../../../types/IPC/ToMain"
    import type { HidValues } from "../../../types/Show"
    import { destroyMain, receiveToMain, requestMain, sendMain } from "../../IPC/main"
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
            if (!hid.device && data[0]?.path) {
                setHid("device", data[0].path)
                setHid("deviceName", formatDeviceLabel(data[0], data))
                sendMain(Main.RECEIVE_HID, { path: data[0].path })
            }
        })
    }

    onMount(() => {
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

    let autoValues = true
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

        if (!hid.device && receivedPath) {
            setHid("device", receivedPath)
            const found = devices.find((d) => d.path?.toLowerCase() === receivedPath.toLowerCase())
            if (found) setHid("deviceName", formatDeviceLabel(found))
        }

        const isMatch = !hid.device || !receivedPath || hid.device.toLowerCase() === receivedPath.toLowerCase()
        if (isMatch) {
            setHid("data", receivedData)
        }
    })

    onDestroy(() => {
        destroyMain(listenerId)
        if (hid.device && !isDeviceUsedElsewhere(hid.device)) {
            sendMain(Main.CLOSE_HID, { path: hid.device })
        }
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
</script>

<MaterialDropdown label="settings.device" value={hid.device || ""} options={devices.map((d) => ({ value: d.path, label: formatDeviceLabel(d) }))} on:change={onDeviceChange} />

{#if !simple}
    <br />
{/if}

<MaterialToggleSwitch label="hid.auto_values" checked={autoValues} on:change={toggleAutoValues} />

<MaterialTextInput label="hid.data_bytes" value={dataString} on:change={onDataInput} />

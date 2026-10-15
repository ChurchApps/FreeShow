<script lang="ts">
    import { activePopup, audioRouting, icecastStatus, popupData, special } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    $: icecast = $special.icecast || {}
    $: isEnabled = icecast.enabled ?? true

    // Check if Icecast has any incoming audio routing connections
    $: connections = $audioRouting?.connections || []
    $: hasAudioSource = connections.some((c) => c.to === "icecast" || c.to?.includes("icecast"))

    $: isLive = isEnabled && !!$icecastStatus?.connected
    $: isConnecting = isEnabled && !isLive && !!$icecastStatus?.connecting
    $: statusError = isEnabled && !isLive && !isConnecting && $icecastStatus?.error

    function openNodeOptions() {
        popupData.set({ nodeId: "icecast", name: "Icecast", type: "icecast" })
        activePopup.set("node_options")
    }
</script>

{#if hasAudioSource}
    <div class="icecast-widget" class:disabled={!isEnabled}>
        <div class="content" title={statusError || (isLive ? "Stream Active" : isConnecting ? "Connecting..." : isEnabled ? "Idle / Ready" : "Disabled")}>
            <Icon id="broadcast" color={isLive ? "#2ecc71" : isConnecting ? "#f39c12" : statusError ? "#e74c3c" : ""} white={!isLive && !isConnecting && !statusError} style="opacity: {isEnabled ? 1 : 0.5};" />
            <span class="name">Icecast</span>
            <span class="status-indicator" class:active={isLive} class:connecting={isConnecting} class:error={!!statusError} title={statusError || (isLive ? "Stream Active" : isConnecting ? "Connecting..." : isEnabled ? "Idle / Ready" : "Disabled")}>
                {isLive ? "LIVE" : isConnecting ? "CONNECTING..." : statusError ? "ERROR" : isEnabled ? "STANDBY" : "OFF"}
            </span>
        </div>

        <div class="actions">
            <!-- <MaterialToggleSwitch label="" checked={isEnabled} on:change={() => toggleIcecast()} small /> -->
            <MaterialButton variant="outlined" icon="options" style="padding: 4px;" title="popup.node_options" on:click={openNodeOptions} />
        </div>
    </div>
{/if}

<style>
    .icecast-widget {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin: 5px;
        margin-top: -2px;
        padding: 5px 10px;
        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        color: var(--text);
        box-sizing: border-box;
        user-select: none;
        transition: opacity 0.2s ease;
    }

    .icecast-widget.disabled {
        opacity: 0.6;
    }

    .content {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
    }

    .name {
        font-weight: 500;
        font-size: 13px;
        flex-shrink: 0;
    }

    .status-indicator {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.5px;
        padding: 1px 5px;
        border-radius: 3px;
        background-color: var(--primary);
        color: var(--text-2, #888);
    }

    .status-indicator.active {
        background-color: #b60707;
        color: #fff;
    }

    .status-indicator.connecting {
        background-color: #ab8000;
        color: #fff;
    }

    .status-indicator.error {
        background-color: #c0392b;
        color: #fff;
    }

    .actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
    }
</style>

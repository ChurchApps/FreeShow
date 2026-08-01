<script lang="ts">
    // Non-blocking banner shown to remote/web clients when the socket connection
    // to the server drops. Reconnection is automatic (socket.io). Hidden entirely
    // for local Electron clients (connectionStatus stays null).
    import { connectionStatus } from "../../stores"

    $: offline = $connectionStatus === "disconnected" || $connectionStatus === "reconnecting"
</script>

{#if offline}
    <div class="connection-banner">Reconnecting to server…</div>
{/if}

<style>
    .connection-banner {
        position: fixed;
        inset-inline: 0;
        top: 0;
        z-index: 9999;
        padding: 4px 10px;
        text-align: center;
        font-size: 0.85em;
        color: white;
        background-color: var(--secondary, #e0154f);
        box-shadow: 0 2px 6px rgb(0 0 0 / 0.3);
    }
</style>

<script lang="ts">
    import { get } from "svelte/store"
    import { io } from "socket.io-client"
    import { getRemoteServerConfig, setRemoteServerConfig } from "../../../IPC/transport"
    import { saved } from "../../../stores"
    import { save } from "../../../utils/save"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import Title from "../../input/Title.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Tip from "../../main/Tip.svelte"

    // Desktop only: connect this client to a remote/headless FreeShow server.
    // In the web build the app is always a client of its serving origin.
    const isDesktop = (import.meta as any).env?.VITE_TARGET !== "web"

    const existing = getRemoteServerConfig()
    const connected = !!existing

    // keep what was typed if the user navigates away before connecting
    const DRAFT_KEY = "freeshow_remote_server_draft"
    const draft = (() => {
        try {
            return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}")
        } catch {
            return {}
        }
    })()

    let url = existing?.url || draft.url || "http://localhost:5540"
    let token = existing?.token || draft.token || ""

    function saveDraft() {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify({ url, token }))
        } catch {
            // non-fatal: the draft is a convenience only
        }
    }

    let testing = false
    let testResult = ""

    function testConnection() {
        if (!url) return
        testing = true
        testResult = ""
        const socket = io(url, { auth: token ? { token } : undefined, transports: ["websocket"], reconnection: false, timeout: 4000 })
        const finish = (msg: string) => {
            testing = false
            testResult = msg
            socket.close()
        }
        socket.on("connect", () => finish("ok"))
        socket.on("connect_error", (e: Error) => finish("fail: " + (e?.message || "error")))
        setTimeout(() => testing && finish("fail: timed out"), 5000)
    }

    // persist local changes before swapping transport (avoids losing unsaved edits), then reload
    function switchTransport(apply: () => void) {
        apply()
        if (!get(saved)) {
            save()
            setTimeout(() => location.reload(), 900)
        } else {
            location.reload()
        }
    }

    function connect() {
        if (!url) return
        switchTransport(() => setRemoteServerConfig({ enabled: true, url, token: token || undefined }))
    }

    function disconnect() {
        switchTransport(() => setRemoteServerConfig(null))
    }
</script>

{#if isDesktop}
    <Title label="Server connection" icon="connection" />

    {#if connected}
        <InputRow>
            <MaterialButton style="flex: 1;justify-content: flex-start;gap: 15px;" disabled>
                <Icon id="connection" size={1.1} />
                <span>Connected to <b>{existing?.url}</b></span>
            </MaterialButton>
            <MaterialButton icon="logout" on:click={disconnect} style="border-bottom: 2px solid var(--connected) !important;">Disconnect</MaterialButton>
        </InputRow>
        <Tip value="Disconnecting returns to this computer's local data." top={15} />
    {:else}
        <MaterialTextInput
            label="Server URL"
            value={url}
            placeholder="http://localhost:5540"
            on:change={(e) => {
                url = e.detail
                saveDraft()
            }}
        />
        <MaterialTextInput
            label="Token (optional)"
            value={token}
            placeholder="—"
            on:change={(e) => {
                token = e.detail
                saveDraft()
            }}
        />

        <InputRow>
            <MaterialButton on:click={testConnection} disabled={testing || !url}>
                {testing ? "Testing…" : "Test connection"}
            </MaterialButton>
            <MaterialButton icon="login" on:click={connect} style="flex: 1;" disabled={!url}>Connect</MaterialButton>
        </InputRow>

        {#if testResult === "ok"}
            <Tip type="info" value="Connection successful." top={12} />
        {:else if testResult}
            <Tip type="warning" value={"Could not connect (" + testResult.replace("fail: ", "") + ")."} top={12} />
        {/if}

        <Tip value="Connect to a FreeShow server to load and co-edit its shows. The app reloads when you connect." top={15} />
    {/if}
{/if}

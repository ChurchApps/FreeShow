<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { activePopup, alertMessage, cloudSyncData, statusIndicator } from "../../../stores"
    import { setupCloudSync, syncWithCloud } from "../../../utils/cloudSync"
    import { translateText } from "../../../utils/language"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import CloudSyncOptions from "./CloudSyncOptions.svelte"

    type Config = { endpoint?: string; region: string; bucket: string; prefix?: string; accessKeyId: string; secretAccessKey: string; pathStyle?: boolean }

    // the stored secret is never sent to the renderer
    let config: Omit<Config, "secretAccessKey"> | null = null
    let form: Config = getEmptyForm()
    let editing = false
    let connecting = false

    onMount(loadConfig)
    async function loadConfig() {
        config = (await requestMain(Main.S3_SYNC_GET_CONFIG)) || null
    }

    function getEmptyForm(): Config {
        return { endpoint: "", region: "", bucket: "", prefix: "", accessKeyId: "", secretAccessKey: "" }
    }

    function getLocation(c: { bucket: string; prefix?: string } | null) {
        if (!c) return ""
        return c.prefix ? `${c.bucket}/${c.prefix}` : c.bucket
    }

    $: s3SyncEnabled = !!$cloudSyncData.enabled && $cloudSyncData.id === "s3"
    $: pathStyle = form.pathStyle ?? !!form.endpoint?.trim()

    function edit() {
        form = { ...getEmptyForm(), ...(config || {}), secretAccessKey: "" }
        editing = true
    }

    function updateForm(key: keyof Config, value: any) {
        form = { ...form, [key]: value }
    }

    async function connect() {
        if (!form.bucket.trim() || !form.accessKeyId.trim() || (!config && !form.secretAccessKey.trim())) {
            alertMessage.set("Please fill in the bucket, access key ID and secret access key.")
            activePopup.set("alert")
            return
        }

        connecting = true
        const result = await requestMain(Main.S3_SYNC_SET_CONFIG, form)
        connecting = false

        if (!result?.success) {
            alertMessage.set("Could not connect to the S3 storage:<br>" + (result?.error || "Unknown error"))
            activePopup.set("alert")
            return
        }

        const previousLocation = $cloudSyncData.team?.id
        await loadConfig()
        editing = false
        form = getEmptyForm()

        // (re)check the new location for existing data
        if (!s3SyncEnabled || previousLocation !== getLocation(config)) enableSync()
    }

    async function disconnect() {
        await requestMain(Main.S3_SYNC_SET_CONFIG, null)
        if ($cloudSyncData.id === "s3") cloudSyncData.set({})
        config = null
    }

    function enableSync() {
        cloudSyncData.update((a) => ({ ...a, enabled: true, id: "s3" }))
        setupCloudSync(false, "s3")
    }

    function toggleSync(enabled: boolean) {
        if (enabled) {
            enableSync()
            return
        }

        cloudSyncData.update((a) => {
            a.enabled = false
            return a
        })
    }

    let resetValue = 0
    $: if ($activePopup) resetValue++
</script>

{#if editing}
    <MaterialTextInput label="cloud.s3_endpoint" title="cloud.s3_endpoint_tip" placeholder="https://s3.amazonaws.com" value={form.endpoint || ""} on:input={(e) => updateForm("endpoint", e.detail)} />
    <MaterialTextInput label="cloud.s3_region" placeholder="us-east-1" value={form.region} on:input={(e) => updateForm("region", e.detail)} />
    <MaterialTextInput label="cloud.s3_bucket" value={form.bucket} on:input={(e) => updateForm("bucket", e.detail)} />
    <MaterialTextInput label="cloud.s3_prefix" title="cloud.s3_prefix_tip" placeholder="freeshow" value={form.prefix || ""} on:input={(e) => updateForm("prefix", e.detail)} />
    <MaterialTextInput label="cloud.s3_access_key" value={form.accessKeyId} on:input={(e) => updateForm("accessKeyId", e.detail)} />
    <MaterialTextInput label="cloud.s3_secret_key" type="password" placeholder={config ? "••••••••" : ""} value={form.secretAccessKey} on:input={(e) => updateForm("secretAccessKey", e.detail)} />
    <MaterialToggleSwitch label="cloud.s3_path_style" title="cloud.s3_path_style_tip" checked={pathStyle} on:change={(e) => updateForm("pathStyle", e.detail)} />

    <InputRow>
        <MaterialButton variant="outlined" icon="close" style="flex: 1;" disabled={connecting} on:click={() => (editing = false)}>
            <T id="popup.cancel" />
        </MaterialButton>
        <MaterialButton variant="contained" icon="login" style="flex: 1;" disabled={connecting} on:click={connect}>
            <T id="settings.connect_to" replace={["S3"]} />
        </MaterialButton>
    </InputRow>
{:else if !config}
    <InputRow>
        <MaterialButton on:click={edit} style="flex: 1;" icon="login" title="cloud.s3_tip">
            <T id="settings.connect_to" replace={[translateText("cloud.s3")]} />
        </MaterialButton>
    </InputRow>
{:else}
    <InputRow>
        <MaterialButton on:click={disconnect} style="flex: 1;border-bottom: 2px solid var(--connected) !important;" icon="logout">
            <T id="settings.disconnect_from" replace={[getLocation(config)]} />
        </MaterialButton>
        <MaterialButton icon="edit" title="cloud.s3_edit" on:click={edit} />
        {#if s3SyncEnabled}
            <MaterialButton icon="cloud_sync" disabled={$statusIndicator === "syncing"} on:click={() => syncWithCloud()}>
                <T id="cloud.sync" />
            </MaterialButton>
        {/if}
    </InputRow>

    <InputRow arrow={s3SyncEnabled}>
        {#key resetValue}
            <MaterialToggleSwitch label="cloud.enable_sync" data={getLocation(config)} checked={s3SyncEnabled} style="flex: 1;" on:change={(e) => toggleSync(e.detail)} />
        {/key}

        <svelte:fragment slot="menu">
            <CloudSyncOptions />
        </svelte:fragment>
    </InputRow>
{/if}

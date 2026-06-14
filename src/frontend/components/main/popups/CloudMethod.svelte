<script lang="ts">
    import { activePopup, cloudSyncData } from "../../../stores"
    import { syncWithCloud } from "../../../utils/cloudSync"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Tip from "../Tip.svelte"

    let showMore = false
    $: multipleTeams = ($cloudSyncData.team?.count || 0) > 1
    $: options = [
        { name: "actions.merge", description: "cloud.merge_tip", icon: "merge", click: () => setMethod("merge") },
        { name: "cloud.read_only", description: "cloud.readonly_tip", icon: "cloud_download", click: () => setMethod("read_only") },
        ...(showMore || multipleTeams
            ? [
                  { name: "cloud.upload", description: "cloud.upload_tip", icon: "export", click: () => setMethod("upload") },
                  { name: "cloud.replace", description: "cloud.replace_tip", icon: "import", click: () => setMethod("replace") }
              ]
            : [])
    ]

    function updateData(key: string, value: any) {
        cloudSyncData.update((a) => {
            ;(a as any)[key] = value
            return a
        })
    }

    function setMethod(method: "merge" | "read_only" | "upload" | "replace") {
        updateData("cloudMethod", method)
        syncWithCloud(true)
        activePopup.set(null)
    }

    function cancel() {
        cloudSyncData.set({})
        activePopup.set(null)
    }
</script>

<Tip type="info" value="cloud.choose_method_tip" bottom={20} />

{#if !multipleTeams}
    <MaterialButton class="popup-options {showMore ? 'active' : ''}" style="inset-inline-end: 0;" icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} on:click={() => (showMore = !showMore)} white />
{/if}

<div style="display: flex;flex-direction: column;gap: 5px;">
    {#each options as option, i}
        <MaterialButton variant="outlined" style="{i === 2 ? 'margin-top: 5px;' : ''}justify-content: start;flex: 1;min-height: 50px;font-weight: normal;" on:click={option.click}>
            <Icon id={option.icon} size={2.4} white={i > 0} />

            <div style="display: flex;flex-direction: column;align-items: start;gap: 5px;margin-left: 10px;">
                <p style="font-size: 1.1em;">{translateText(option.name)}</p>
                <span style="opacity: 0.5;">{translateText(option.description)}</span>
            </div>
        </MaterialButton>
    {/each}
</div>

<MaterialButton variant="outlined" style="margin-top: 20px;" icon="close" on:click={cancel}>
    <T id="popup.cancel" />
</MaterialButton>

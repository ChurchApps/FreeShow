<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { ContentFile, ContentLibraryCategory } from "../../../../electron/contentProviders/base/types"
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { activeCanvaPresentation, mediaOptions, providerConnections } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"
    import CanvaLink from "./CanvaLink.svelte"
    import ContentLibraryBrowser from "./ContentLibraryBrowser.svelte"
    import CLogo from "./CLogo.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Link from "../../inputs/Link.svelte"
    import Icon from "../../helpers/Icon.svelte"

    onMount(() => {
        if (!$providerConnections.canva) {
            sendMain(Main.PROVIDER_STARTUP_LOAD, { providerId: "canva", scope: "folder:read design:content:read design:meta:read" })
        }
    })

    onDestroy(() => {
        activeCanvaPresentation.set(null)
    })

    function handleConnect() {
        sendMain(Main.PROVIDER_LOAD_SERVICES, { providerId: "canva", data: { canvaClientId, canvaClientSecret } })
    }

    export let searchValue = ""

    let canvaClientId = ""
    let canvaClientSecret = ""
    let currentCategory: ContentLibraryCategory | null = null

    $: activeCanvaPresentation.set(getPresentationData(currentCategory))

    function getPresentationData(category: ContentLibraryCategory | null) {
        const key = category?.key || ""
        if (!key.startsWith("presentation:")) return null

        const designId = key.replace("presentation:", "")
        if (!designId) return null

        return {
            designId,
            presentationName: category?.name || "Untitled presentation",
            slideCount: (category as any)?.slideCount,
            thumbnail: category?.thumbnail,
            providerId: "canva" as const
        }
    }

    function getContentCategory(item: ContentFile & { isPresentation?: boolean; slideCount?: number; isFolder?: boolean }) {
        if (item.isFolder && item.mediaId) {
            return {
                name: item.name || "Folder",
                thumbnail: item.thumbnail,
                key: item.mediaId
            } as ContentLibraryCategory
        }

        if (!item.isPresentation || !item.mediaId) return null

        return {
            name: item.name || "Untitled presentation",
            thumbnail: item.thumbnail,
            slideCount: item.slideCount,
            key: `presentation:${item.mediaId}`
        } as ContentLibraryCategory & { slideCount?: number }
    }
</script>

{#if $providerConnections.canva}
    <div style="position: relative;width: 100%; height: 100%; display: flex; flex-direction: column;">
        <div style="flex: 1; overflow: hidden;">
            <ContentLibraryBrowser providerId="canva" columns={$mediaOptions.columns} {searchValue} bind:currentCategory {getContentCategory} />
        </div>
    </div>
    <!-- <div style="position: absolute;bottom: 0;width: 100%;padding: 10px;display: flex;justify-content: center;">
        <p style="font-size: 0.8em;color: rgba(255 255 255 / 0.25);">Powered by Canva</p>
    </div> -->
{:else}
    <div class="gridgap">
        <Center style="flex-direction: column;">
            <div class="options">
                <!-- live presentation from a public link (no account needed) -->
                <section class="card">
                    <CanvaLink />
                </section>

                <!-- import slides as images through the Canva API -->
                <section class="card account">
                    <div class="title">
                        <p><T id="media.canva_connect_title" /></p>
                        <Link url="https://freeshow.app/docs/media#connecting-to-canva">
                            <T id="main.docs" />
                            <Icon id="launch" white />
                        </Link>
                    </div>
                    <p class="info"><T id="media.canva_connect_info" /></p>

                    <MaterialTextInput label="Client ID" value={canvaClientId} on:change={(e) => (canvaClientId = e.detail)} pasteBtn />
                    <MaterialTextInput label="Client secret" value={canvaClientSecret} disabled={!canvaClientId} type="password" on:change={(e) => (canvaClientSecret = e.detail)} pasteBtn />

                    <MaterialButton variant="outlined" disabled={!canvaClientId || !canvaClientSecret} on:click={handleConnect}>
                        <CLogo />
                        <T id="settings.connect_to" replace={["Canva"]} />
                    </MaterialButton>
                </section>
            </div>

            <!-- <p style="font-size: 0.8em;color: rgba(255 255 255 / 0.2);">Powered by Canva</p> -->
        </Center>
    </div>
{/if}

<style>
    .options {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
        max-width: 420px;
        padding: 15px 0;
    }

    .card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 14px;
        border-radius: 8px;
        background-color: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
    }

    .card.account {
        opacity: 0.85;
    }

    .title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        font-weight: 600;
    }

    .info {
        white-space: normal;
        overflow: visible;
        opacity: 0.7;
        font-size: 0.85em;
        line-height: 1.4;
    }

    .gridgap {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        padding: 5px;

        width: 100%;
        height: 100%;

        overflow-y: auto;
        overflow-x: hidden;
    }
</style>

<script lang="ts">
    import { popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialMultiChoice from "../../inputs/MaterialMultiChoice.svelte"
    import { registerPopupSubmit } from "../../../utils/popupSubmit"

    registerPopupSubmit(() => (!localType && !networkType ? null : confirm()))

    const localTypes = [
        { id: "window", name: translateText("settings.window"), icon: "hdmi", tip: "HDMI, DisplayPort" },
        { id: "blackmagic", name: "Blackmagic Design", icon: "blackmagic", tip: "DeckLink, UltraStudio" }
    ]

    const networkTypes = [
        { id: "ndi", name: "NDI®", icon: "ndi", tip: "IP, OBS" },
        { id: "webrtc", name: "WebRTC", icon: "broadcast", tip: "WHIP, restream.io" },
        { id: "rtmp", name: "RTMP", icon: "broadcast", tip: "YouTube, Twitch, Facebook Live" }
    ]

    let localType: string = ""
    let networkType: string = ""

    function confirm() {
        popupData.set({ id: "choose_output_type", value: { localType, networkType } })
    }
</script>

<div class="types">
    <div class="section">
        <p class="title">{translateText("settings.local_output")}</p>
        <MaterialMultiChoice options={localTypes} value={localType} on:click={(e) => (localType = e.detail)} highlightFirst={false} canDeselect />
    </div>

    <div class="section">
        <p class="title">{translateText("settings.network_output")}</p>
        <MaterialMultiChoice options={networkTypes} value={networkType} on:click={(e) => (networkType = e.detail)} highlightFirst={false} canDeselect />
    </div>
</div>

<MaterialButton variant="contained" disabled={!localType && !networkType} style="margin-top: 20px;width: 100%;" on:click={confirm}>
    {translateText("popup.confirm")}
</MaterialButton>

<style>
    .types {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .title {
        opacity: 0.7;
        font-size: 0.9em;
    }
</style>

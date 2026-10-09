<script lang="ts">
    import Icon from "../../../components/helpers/Icon.svelte"
    import { getLayoutRef } from "../../../components/helpers/show"
    import T from "../../../components/helpers/T.svelte"
    import FloatingInputs from "../../../components/input/FloatingInputs.svelte"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import { activeEdit, activePopup, activeShow, ai, popupData } from "../../../stores"

    function openChatPopup() {
        let sessionKey = "slide"
        let targetType: "slide" | "overlay" | "template" = "slide"

        if ($activeEdit.type === "overlay" && $activeEdit.id) {
            targetType = "overlay"
            sessionKey = `overlay_${$activeEdit.id}`
        } else if ($activeEdit.type === "template" && $activeEdit.id) {
            targetType = "template"
            sessionKey = `template_${$activeEdit.id}`
        } else if ($activeEdit.slide !== undefined && $activeEdit.slide !== null) {
            targetType = "slide"
            const showId = $activeShow?.id || $activeEdit.showId || ""
            const ref = getLayoutRef(showId)
            const slideId = ref[$activeEdit.slide]?.id || `slide_${$activeEdit.slide}`
            sessionKey = `show_${showId}_slide_${slideId}`
        }

        popupData.set({
            sessionKey,
            targetType,
            popupTitle: "interaction.generate_slide"
        })
        activePopup.set("ai_chat")
    }
</script>

{#if ($ai?.llm?.provider || "none") !== "none"}
    <FloatingInputs side="center" gradient>
        <MaterialButton class="smartButton" title="popup.ai_chat" on:click={openChatPopup}>
            <Icon id="ai" size={1.3} gradient />
            <T id="interaction.generate_slide" />
        </MaterialButton>
    </FloatingInputs>
{/if}

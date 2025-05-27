<!-- WIP the text editor relies on text information to match with previous, and inserts empty afterwards, so this will break things -->

<!-- <script lang="ts">
    import { includeEmptySlides } from "../../stores"
    import Checkbox from "../inputs/Checkbox.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"

    const isChecked = (e: any) => e.target.checked
</script>

<div class="bottom">
    <CombinedInput>
        <p style="flex: 1;">Include empty slides</p>
        <span style="flex: 0;padding: 0 10px;" class="alignRight">
            <Checkbox checked={$includeEmptySlides} on:change={(e) => includeEmptySlides.set(isChecked(e))} />
        </span>
    </CombinedInput>
</div>

<style>
    .bottom {
        display: flex;
        flex-direction: column;
    }
</style> -->

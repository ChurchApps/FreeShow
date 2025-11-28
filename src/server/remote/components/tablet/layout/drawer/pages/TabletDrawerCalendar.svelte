<script lang="ts">
    import { dictionary } from "../../../../../util/stores"
    import { translate } from "../../../../../util/helpers"
</script>

<div class="main">
    <div style="padding: 20px; text-align: center; opacity: 0.5;">
        {translate("remote.no_content", $dictionary)}
    </div>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        background-color: var(--primary-darker);
    }
</style>

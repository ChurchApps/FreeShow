<script lang="ts">
    import { translate } from "../../remote/util/helpers"
    import { dictionary } from "../../remote/util/stores"
</script>

<div class="center">
    {translate("remote.loading", $dictionary)}
</div>

<style>
    .center {
        display: flex;
        align-items: center;
        justify-content: center;

        width: 100%;
        height: 100%;

        opacity: 0.7;
    }
</style>

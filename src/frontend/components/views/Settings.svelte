<script lang="ts">
  import LocaleSwitcher from "../settings/LocaleSwitcher.svelte"
  import ThemeSwitcher from "../settings/ThemeSwitcher.svelte"
</script>

<div>
  <ThemeSwitcher />
  <LocaleSwitcher />
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
  }
</style>

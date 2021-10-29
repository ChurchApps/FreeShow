<script lang="ts">
  import LocaleSwitcher from "./LocaleSwitcher.svelte"
  import ThemeSwitcher from "./ThemeSwitcher.svelte"
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

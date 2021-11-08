<script lang="ts">
  import LocaleSwitcher from "./LocaleSwitcher.svelte"
  import Screens from "./Screens.svelte"
  import ThemeSwitcher from "./ThemeSwitcher.svelte"
</script>

<div>
  <!-- TODO: tabs... -->
  <!-- general, screen, edit, remote -->
  <ThemeSwitcher />
  <LocaleSwitcher />
  <Screens />
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
  }
</style>

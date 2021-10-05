<script>
  import LocaleSwitcher from "./controllers/LocaleSwitcher.svelte";
  import ThemeSwitcher from "./controllers/ThemeSwitcher.svelte";
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
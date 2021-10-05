<script>
  export let mode;
</script>

<div>
  <button title="Switch to live view" on:click={() => mode = 'live'}>Live</button>
  <button title="Go to editor" on:click={() => mode = 'edit'}>Edit</button>
  <button title="Go to stage" on:click={() => mode = 'stage'}>Stage</button>
</div>
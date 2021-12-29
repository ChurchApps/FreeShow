<section>
  <slot />
</section>

<style>
  section :global(h6) {
    color: var(--text);
    text-transform: uppercase;
    text-align: center;
    font-size: 0.9em;
    margin-top: 10px;
    margin-bottom: 20px;
  }

  section :global(.line) {
    display: flex;
    align-items: center;
    background-color: var(--primary-darker);
    flex-flow: wrap;
  }

  section :global(.gap) {
    display: flex;
    gap: 10px;
  }

  section :global(.titles) {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
  }

  section :global(p) {
    width: 100%;
    opacity: 0.8;
    align-self: center;
    font-size: 0.9em;
  }

  section :global(hr) {
    width: 100%;
    height: 2px;
    background-color: var(--primary-lighter);
    border: none;
    margin: 20px 0;
  }
</style>

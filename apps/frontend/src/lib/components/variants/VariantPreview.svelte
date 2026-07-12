<script lang="ts">
  import { Button } from '$lib/components/ui/button';

  let {
    previewUrl = null,
    variantName = '',
    isActive = false,
    onActivate,
    onDelete,
  }: {
    previewUrl: string | null;
    variantName: string;
    isActive: boolean;
    onActivate: () => Promise<void>;
    onDelete: () => Promise<void>;
  } = $props();

  let fullscreen = $state(false);

  function toggleFullscreen() {
    fullscreen = !fullscreen;
  }
</script>

{#if previewUrl}
  <div class="variant-preview rounded-lg border" class:fixed={fullscreen} class:inset-0={fullscreen} class:z-50={fullscreen} class:bg-background={fullscreen}>
    <div class="flex items-center justify-between p-3 border-b">
      <div class="flex items-center gap-2">
        <h3 class="font-semibold">{variantName}</h3>
        {#if isActive}
          <span class="text-xs bg-green-100 text-green-700 rounded px-2 py-0.5">Active</span>
        {/if}
      </div>
      <div class="flex gap-2">
        <button onclick={toggleFullscreen} class="p-1 hover:bg-muted rounded text-sm" title={fullscreen ? 'Exit' : 'Fullscreen'}>
          {fullscreen ? '[-]' : '[ ]'}
        </button>
        {#if !isActive}
          <Button size="sm" onclick={onActivate}>Activate</Button>
        {/if}
        <Button size="sm" variant="destructive" onclick={onDelete}>Delete</Button>
      </div>
    </div>
    <iframe
      src={previewUrl}
      class="w-full border-0"
      class:h-full={fullscreen}
      class:h-96={!fullscreen}
      title={variantName}
    ></iframe>
  </div>
{/if}

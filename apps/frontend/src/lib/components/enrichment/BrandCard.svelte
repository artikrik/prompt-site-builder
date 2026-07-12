<script lang="ts">
  import type { EnrichmentData } from '@prompt-site-builder/shared';
  import { Badge } from '$lib/components/ui/badge';

  let { data = null }: { data: EnrichmentData | null } = $props();

  let colors = $derived(
    [
      data?.brandColors?.primary,
      data?.brandColors?.secondary,
      data?.brandColors?.accent,
    ].filter(Boolean) as string[]
  );

  let stats = $derived(
    data?.stats ? Object.entries(data.stats).filter(([, v]) => v != null) : []
  );
</script>

{#if data}
  <div class="brand-card rounded-lg border p-4 space-y-4">
    <!-- Logo -->
    {#if data.logoUrl}
      <img src={data.logoUrl} alt="Logo" class="h-16 w-16 rounded-full object-cover" />
    {:else}
      <div class="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold">
        {data.toneOfVoice?.style?.[0] || '?'}
      </div>
    {/if}

    <!-- Brand Colors -->
    {#if colors.length > 0}
      <div class="flex gap-2 items-center">
        <span class="text-sm text-muted-foreground">Colors:</span>
        {#each colors as color}
          <div class="flex items-center gap-1">
            <div class="h-5 w-5 rounded border" style="background: {color}" title={color}></div>
            <span class="text-xs font-mono">{color}</span>
          </div>
        {/each}
        {#if data.brandColors?.extractedFrom}
          <span class="text-xs text-muted-foreground">from {data.brandColors.extractedFrom}</span>
        {/if}
      </div>
    {/if}

    <!-- Tone of Voice -->
    {#if data.toneOfVoice}
      <div class="flex flex-wrap gap-2">
        <Badge variant="secondary">{data.toneOfVoice.style}</Badge>
        <Badge variant="secondary">{data.toneOfVoice.formality}</Badge>
        {#if data.toneOfVoice.emojiUsage}
          <Badge variant="outline">Emoji: {data.toneOfVoice.emojiUsage}</Badge>
        {/if}
      </div>
      {#if data.toneOfVoice.keyPhrases?.length}
        <div class="flex flex-wrap gap-1">
          {#each data.toneOfVoice.keyPhrases as phrase}
            <Badge variant="outline" class="text-xs">{phrase}</Badge>
          {/each}
        </div>
      {/if}
    {/if}

    <!-- Stats -->
    {#if stats.length > 0}
      <div class="grid grid-cols-2 gap-2 text-sm">
        {#each stats as [key, value]}
          <div class="flex justify-between bg-muted rounded px-2 py-1">
            <span class="text-muted-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
            <span class="font-medium">{value}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

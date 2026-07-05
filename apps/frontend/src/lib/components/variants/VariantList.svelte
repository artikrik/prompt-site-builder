<script lang="ts">
  import type { VariantListItem } from '$lib/stores/variants';
  import VariantCard from './VariantCard.svelte';
  import { cn } from '$lib/utils';

  interface Props {
    variants: VariantListItem[];
    activeVariantId?: string | null;
    onActivate: (variantId: string) => void;
    onDelete: (variantId: string) => void;
    isLoading: boolean;
    class?: string;
  }

  let { variants: items, activeVariantId, onActivate, onDelete, isLoading, class: className = '' }: Props = $props();
</script>

<div class={cn('space-y-3', className)}>
  <div class="flex items-center justify-between">
    <h3 class="text-sm font-semibold">
      Variants
      {#if items.length > 0}
        <span class="text-muted-foreground font-normal">({items.length})</span>
      {/if}
    </h3>
  </div>

  {#if isLoading}
    <p class="text-sm text-muted-foreground py-4 text-center">Loading variants...</p>
  {:else if items.length === 0}
    <p class="text-sm text-muted-foreground py-4 text-center">
      No variants yet. Generate a site to create one.
    </p>
  {:else}
    {#each items as variant (variant.id)}
      <VariantCard
        {variant}
        isActive={variant.id === activeVariantId}
        {onActivate}
        {onDelete}
      />
    {/each}
  {/if}
</div>

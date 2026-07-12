<script lang="ts">
  import { resolve } from '$app/paths';
  import type { VariantListItem } from '$lib/stores/variants';
  import Card from '$lib/components/ui/card/card.svelte';
  import CardContent from '$lib/components/ui/card/card-content.svelte';
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import { cn } from '$lib/utils';

  interface Props {
    variant: VariantListItem;
    isActive: boolean;
    onActivate: (variantId: string) => void;
    onDelete: (variantId: string) => void;
    class?: string;
  }

  let { variant, isActive, onActivate, onDelete, class: className = '' }: Props = $props();
  let isDeleting = $state(false);

  function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
    switch (status) {
      case 'PUBLISHED': return 'default';
      case 'GENERATED': return 'secondary';
      case 'GENERATING': return 'outline';
      default: return 'outline';
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('uk-UA', { dateStyle: 'short' });
  }
</script>

<Card class={cn('relative', className, isActive && 'ring-2 ring-primary')}>
  <CardContent class="p-4">
    <div class="flex items-start justify-between">
      <div class="space-y-1 flex-1">
        <div class="flex items-center gap-2">
          <a href={resolve(`/dashboard/variants/${variant.id}`)} class="font-semibold text-sm hover:underline">{variant.variantName}</a>
          <Badge variant={statusVariant(variant.status)} class="text-xs">
            {variant.status}
          </Badge>
          {#if isActive}
            <Badge class="text-xs bg-green-100 text-green-700">Active</Badge>
          {/if}
        </div>
        <div class="text-xs text-muted-foreground space-y-0.5">
          {#if variant.modelUsed}<div>Model: {variant.modelUsed}</div>{/if}
          {#if variant.imageModel}<div>Image: {variant.imageModel}</div>{/if}
          {#if variant.themeName}<div>Theme: {variant.themeName}</div>{/if}
          <div>Created: {formatDate(variant.createdAt)}</div>
        </div>
      </div>

      <div class="flex gap-1.5 ml-3">
        {#if !isActive && variant.status === 'GENERATED'}
          <button
            onclick={() => onActivate(variant.id)}
            class="rounded bg-primary px-2 py-1 text-xs text-white hover:opacity-90"
          >
            Activate
          </button>
        {/if}
        {#if !isActive || variant.status !== 'PUBLISHED'}
          <button
            onclick={() => { isDeleting = true; onDelete(variant.id); }}
            disabled={isDeleting}
            class="rounded border px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            Delete
          </button>
        {/if}
      </div>
    </div>
  </CardContent>
</Card>

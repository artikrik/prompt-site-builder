<script lang="ts">
  /* global window */
  import { page } from '$app/stores';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { variants, type SiteVariant } from '$lib/stores/variants';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { ArrowLeft } from '@lucide/svelte';

  let variant = $state<(SiteVariant & { project?: any; assets?: any[] }) | null>(null);
  let isLoading = $state(true);

  let variantId = $derived(($page.params as Record<string, string>).variantId);

  onMount(async () => {
    try {
      variant = await variants.fetchById(variantId);
    } finally {
      isLoading = false;
    }
  });

  function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
    switch (status) {
      case 'PUBLISHED': return 'default';
      case 'GENERATED': return 'secondary';
      case 'GENERATING': return 'outline';
      default: return 'outline';
    }
  }

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('uk-UA', { dateStyle: 'long', timeStyle: 'short' });
  }

  function getConfigPreview(hugoConfig: any): string {
    if (!hugoConfig || typeof hugoConfig !== 'object') return '{}';
    if (typeof hugoConfig === 'string') return hugoConfig;
    if (hugoConfig?.config) return hugoConfig.config;
    return JSON.stringify(hugoConfig, null, 2);
  }
</script>

<svelte:head><title>Variant Details - Prompt Site Builder</title></svelte:head>

<div class="space-y-6">
  <div>
    <Button variant="ghost" size="sm" onclick={() => window.history.back()}>
      <ArrowLeft class="w-4 h-4 mr-2" />
      Back
    </Button>
  </div>

  {#if isLoading}
    <div class="text-center py-12 text-muted-foreground">Loading...</div>
  {:else if !variant}
    <div class="text-center py-12 text-muted-foreground">Variant not found</div>
  {:else}
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{variant.variantName}</h1>
        <p class="text-muted-foreground">
          {#if variant.project}
            Project: <a href={resolve(`/dashboard/projects/${variant.projectId}`)} class="underline" data-sveltekit-reload>{variant.project.slug}</a>
          {/if}
        </p>
      </div>
      <Badge variant={statusVariant(variant.status)} class="text-base">{variant.status}</Badge>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card.Root>
        <Card.Header>
          <Card.Title>Generation Details</Card.Title>
        </Card.Header>
        <Card.Content>
          <dl class="space-y-3">
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Model</dt>
              <dd>{variant.modelUsed || '—'}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Image Model</dt>
              <dd>{variant.imageModel || '—'}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Theme</dt>
              <dd>{variant.themeName || '—'}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Created</dt>
              <dd>{formatDate(variant.createdAt)}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Updated</dt>
              <dd>{formatDate(variant.updatedAt)}</dd>
            </div>
            {#if variant.publishedAt}
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Published</dt>
                <dd>{formatDate(variant.publishedAt)}</dd>
              </div>
            {/if}
            {#if variant.previewUrl}
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Preview URL</dt>
                <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<dd><a href={variant.previewUrl} class="underline text-primary" target="_blank" rel="noreferrer">{variant.previewUrl}</a></dd>
              </div>
            {/if}
          </dl>
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Card.Title>Assets</Card.Title>
        </Card.Header>
        <Card.Content>
          {#if variant.assets && variant.assets.length > 0}
            <div class="space-y-2">
              {#each variant.assets as asset (asset.filePath)}
                <div class="text-sm flex justify-between">
                  <span class="text-muted-foreground">{asset.assetType}</span>
                  <span class="font-mono text-xs">{asset.filePath}</span>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-sm text-muted-foreground">No assets generated yet.</p>
          {/if}
        </Card.Content>
      </Card.Root>

      <Card.Root class="lg:col-span-2">
        <Card.Header>
          <Card.Title>Hugo Configuration</Card.Title>
        </Card.Header>
        <Card.Content>
          <pre class="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96 font-mono">{getConfigPreview(variant.hugoConfig)}</pre>
        </Card.Content>
      </Card.Root>

      {#if variant.content && Object.keys(variant.content).length > 0}
        <Card.Root class="lg:col-span-2">
          <Card.Header>
            <Card.Title>Generated Content</Card.Title>
          </Card.Header>
          <Card.Content>
            <div class="space-y-4">
              {#each Object.entries(variant.content) as [page, body] (page)}
                {#if typeof body === 'string' && body.length > 0}
                  <details>
                    <summary class="text-sm font-medium cursor-pointer">{page}</summary>
                    <pre class="bg-muted p-3 rounded-md text-xs overflow-auto max-h-48 mt-1">{body}</pre>
                  </details>
                {/if}
              {/each}
            </div>
          </Card.Content>
        </Card.Root>
      {/if}
    </div>
  {/if}
</div>

<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Check, X, Settings, Zap } from '@lucide/svelte';
  import {
    type ProjectAddon,
    type AddonType,
    ADDON_LABELS,
    ADDON_DESCRIPTIONS,
    ADDON_PRICES,
    ADDON_ICONS,
  } from '$lib/stores/addons';

  interface Props {
    addonType: AddonType;
    addon?: ProjectAddon | null;
    isLoading?: boolean;
    onActivate?: (addonType: AddonType) => void;
    onDeactivate?: (addonType: AddonType) => void;
    onConfigure?: (addonType: AddonType) => void;
  }

  let {
    addonType,
    addon = null,
    isLoading = false,
    onActivate,
    onDeactivate,
    onConfigure,
  }: Props = $props();

  let icon = $derived(ADDON_ICONS[addonType]);
  let label = $derived(ADDON_LABELS[addonType]);
  let description = $derived(ADDON_DESCRIPTIONS[addonType]);
  let price = $derived(ADDON_PRICES[addonType]);
  let isActive = $derived(addon?.status === 'ACTIVE');

  function getStatusVariant(): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (!addon) return 'outline';
    switch (addon.status) {
      case 'ACTIVE': return 'default';
      case 'SUSPENDED': return 'destructive';
      default: return 'secondary';
    }
  }
</script>

<Card.Root class={isActive ? 'border-primary/30' : ''}>
  <Card.Header>
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-2xl">{icon}</span>
        <div>
          <Card.Title>{label}</Card.Title>
          <Card.Description class="mt-1">{description}</Card.Description>
        </div>
      </div>
      <div class="flex items-center gap-2">
        {#if addon}
          <Badge variant={getStatusVariant()}>{addon.status}</Badge>
        {/if}
      </div>
    </div>
  </Card.Header>
  <Card.Content>
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <span class="text-lg font-semibold">{price} UAH<span class="text-sm text-muted-foreground font-normal">/month</span></span>
        {#if isActive}
          <span class="text-sm text-muted-foreground flex items-center gap-1">
            <Check class="w-4 h-4 text-green-600" />
            Active since {addon?.activatedAt ? new Date(addon.activatedAt).toLocaleDateString() : '—'}
          </span>
        {/if}
      </div>
      <div class="flex items-center gap-2">
        {#if isActive && onConfigure}
          <Button variant="outline" size="sm" onclick={() => onConfigure(addonType)} disabled={isLoading}>
            <Settings class="w-4 h-4 mr-1" />
            Configure
          </Button>
        {/if}
        {#if isActive && onDeactivate}
          <Button variant="outline" size="sm" onclick={() => onDeactivate(addonType)} disabled={isLoading}>
            <X class="w-4 h-4 mr-1" />
            Deactivate
          </Button>
        {:else if !isActive && onActivate}
          <Button size="sm" onclick={() => onActivate(addonType)} disabled={isLoading}>
            <Zap class="w-4 h-4 mr-1" />
            Activate
          </Button>
        {/if}
      </div>
    </div>
  </Card.Content>
</Card.Root>

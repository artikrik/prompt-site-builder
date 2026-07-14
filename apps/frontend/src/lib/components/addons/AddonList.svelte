<script lang="ts">
  import AddonCard from './AddonCard.svelte';
  import type { ProjectAddon, AddonType } from '$lib/stores/addons';

  const ALL_ADDON_TYPES: AddonType[] = ['ONLINE_PAYMENT', 'ONLINE_BOOKING', 'CONTENT_MANAGEMENT'];

  interface Props {
    projectId: string;
    addons?: ProjectAddon[];
    isLoading?: boolean;
    onActivate?: (addonType: AddonType) => void;
    onDeactivate?: (addonType: AddonType) => void;
    onConfigure?: (addonType: AddonType) => void;
  }

  let {
    addons = [],
    isLoading = false,
    onActivate,
    onDeactivate,
    onConfigure,
  }: Props = $props();

  function getAddon(type: AddonType): ProjectAddon | null {
    return addons.find((a) => a.addonType === type) || null;
  }
</script>

<div class="space-y-3">
  {#each ALL_ADDON_TYPES as type (type)}
    <AddonCard
      addonType={type}
      addon={getAddon(type)}
      {isLoading}
      {onActivate}
      {onDeactivate}
      {onConfigure}
    />
  {/each}
</div>

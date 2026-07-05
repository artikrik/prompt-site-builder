<!-- apps/frontend/src/lib/components/settings/ModelSelector.svelte -->
<script lang="ts">
  import type { ContentModel, ImageModel } from '@prompt-site-builder/shared';

  interface Props {
    type: 'content' | 'image';
    provider: string;
    model: string;
    models: (ContentModel | ImageModel)[];
    onProviderChange: (provider: string) => void;
    onModelChange: (model: string) => void;
  }

  let { type, provider, model, models, onProviderChange, onModelChange }: Props = $props();

  let providers = $derived([...new Set(models.map((m) => m.provider))]);
  let filteredModels = $derived(models.filter((m) => m.provider === provider));

  let providerLabels: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    deepseek: 'DeepSeek',
    mimo: 'MiMo',
    bfl: 'BFL',
  };

  function formatPrice(m: ContentModel | ImageModel): string {
    if (type === 'content') {
      const cm = m as ContentModel;
      return `$${cm.inputPrice}/$${cm.outputPrice} per 1M`;
    }
    const im = m as ImageModel;
    return `$${im.pricePerImage}/image`;
  }
</script>

<div class="space-y-4">
  <div>
    <label class="text-sm font-medium">{type === 'content' ? 'Provider' : 'Image Provider'}</label>
    <select
      value={provider}
      onchange={(e) => onProviderChange(e.currentTarget.value)}
      class="w-full rounded-md border px-3 py-2 text-sm"
    >
      {#each providers as p (p)}
        <option value={p}>{providerLabels[p] ?? p}</option>
      {/each}
    </select>
  </div>

  <div>
    <label class="text-sm font-medium">{type === 'content' ? 'Model' : 'Image Model'}</label>
    <select
      value={model}
      onchange={(e) => onModelChange(e.currentTarget.value)}
      class="w-full rounded-md border px-3 py-2 text-sm"
    >
      {#each filteredModels as m (m.id)}
        <option value={m.id}>
          {m.label} — {m.role} ({formatPrice(m)})
        </option>
      {/each}
    </select>
  </div>
</div>

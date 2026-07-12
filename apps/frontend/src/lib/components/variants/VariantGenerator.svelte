<script lang="ts">
  import { Button } from '$lib/components/ui/button';

  let {
    models = [],
    imageModels = [],
    themes = [],
    onGenerate,
    generating = false,
  }: {
    models: string[];
    imageModels: string[];
    themes: { name: string; label: string }[];
    onGenerate: (config: { model: string; imageModel: string; theme: string }) => Promise<void>;
    generating: boolean;
  } = $props();

  let selectedModel = $state(models[0] || 'gpt-4o');
  let selectedImageModel = $state(imageModels[0] || 'dall-e-3');
  let selectedTheme = $state(themes[0]?.name || '');

  async function handleGenerate() {
    await onGenerate({
      model: selectedModel,
      imageModel: selectedImageModel,
      theme: selectedTheme,
    });
  }
</script>

<div class="variant-generator rounded-lg border p-4 space-y-4">
  <h3 class="font-semibold">Generate New Variant</h3>

  <div class="grid grid-cols-3 gap-3">
    <label class="space-y-1">
      <span class="text-sm">LLM Model</span>
      <select bind:value={selectedModel} class="w-full rounded border p-2 text-sm">
        {#each models as model}
          <option value={model}>{model}</option>
        {/each}
      </select>
    </label>

    <label class="space-y-1">
      <span class="text-sm">Image Model</span>
      <select bind:value={selectedImageModel} class="w-full rounded border p-2 text-sm">
        {#each imageModels as model}
          <option value={model}>{model}</option>
        {/each}
      </select>
    </label>

    <label class="space-y-1">
      <span class="text-sm">Theme</span>
      <select bind:value={selectedTheme} class="w-full rounded border p-2 text-sm">
        {#each themes as theme}
          <option value={theme.name}>{theme.label}</option>
        {/each}
      </select>
    </label>
  </div>

  <Button onclick={handleGenerate} disabled={generating} class="w-full">
    {generating ? 'Generating...' : 'Generate Variant'}
  </Button>
</div>

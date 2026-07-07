<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client.js';
  import ApiKeyInput from '$lib/components/settings/ApiKeyInput.svelte';
  import ModelSelector from '$lib/components/settings/ModelSelector.svelte';
  import type { AppSettings, ContentModel, ImageModel } from '@prompt-site-builder/shared';

  let settings = $state<AppSettings | null>(null);
  let contentModels = $state<ContentModel[]>([]);
  let imageModels = $state<ImageModel[]>([]);
  let saveStatus = $state<'idle' | 'saving' | 'saved'>('idle');
  let loading = $state(true);
  let error = $state('');

  onMount(async () => {
    try {
      settings = await api.get<AppSettings>('/settings');
      const modelData = await api.get<{ content: ContentModel[]; image: ImageModel[] }>('/settings/models');
      contentModels = modelData.content;
      imageModels = modelData.image;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load settings';
    } finally {
      loading = false;
    }
  });

  async function saveSettings() {
    if (!settings) return;
    saveStatus = 'saving';
    await api.put('/settings', {
      llmProvider: settings.llmProvider,
      llmModel: settings.llmModel,
      imageProvider: settings.imageProvider,
      imageModel: settings.imageModel,
    });
    saveStatus = 'saved';
    // Status stays 'saved' until next action
  }

  async function saveApiKey(key: string, value: string) {
    if (!settings) return;
    await api.put('/settings', { [key]: value });
  }

  function handleProviderChange(provider: string) {
    if (!settings) return;
    settings.llmProvider = provider as AppSettings['llmProvider'];
    const providerModels = contentModels.filter((m) => m.provider === provider);
    if (providerModels.length > 0) {
      settings.llmModel = providerModels[0].id;
    }
  }

  function handleImageProviderChange(provider: string) {
    if (!settings) return;
    settings.imageProvider = provider as AppSettings['imageProvider'];
    const providerModels = imageModels.filter((m) => m.provider === provider);
    if (providerModels.length > 0) {
      settings.imageModel = providerModels[0].id;
    }
  }
</script>

<svelte:head><title>Settings - Prompt Site Builder</title></svelte:head>

<div class="space-y-8 p-6">
  <h1 class="text-2xl font-bold">Settings</h1>

  {#if loading}
    <p class="text-muted-foreground">Loading settings...</p>
  {:else if error}
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
      <h2 class="text-lg font-semibold text-destructive">Access Denied</h2>
      <p class="mt-2 text-muted-foreground">{error}</p>
      <p class="mt-1 text-sm text-muted-foreground">You need administrator privileges to access settings. Contact your system administrator.</p>
    </div>
  {:else if settings}
    <!-- Section 1: API Keys -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">API Keys</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <ApiKeyInput
          label="OpenAI API Key"
          placeholder="sk-..."
          value=""
          maskedPreview={settings.openaiApiKey ?? ''}
          onChange={(v: string) => saveApiKey('openaiApiKey', v)}
        />
        <ApiKeyInput
          label="Anthropic API Key"
          placeholder="sk-ant-..."
          value=""
          maskedPreview={settings.anthropicApiKey ?? ''}
          onChange={(v: string) => saveApiKey('anthropicApiKey', v)}
        />
        <ApiKeyInput
          label="Google API Key"
          placeholder="AIza..."
          value=""
          maskedPreview={settings.googleApiKey ?? ''}
          onChange={(v: string) => saveApiKey('googleApiKey', v)}
        />
        <ApiKeyInput
          label="DeepSeek API Key"
          placeholder="sk-..."
          value=""
          maskedPreview={settings.deepseekApiKey ?? ''}
          onChange={(v: string) => saveApiKey('deepseekApiKey', v)}
        />
        <ApiKeyInput
          label="MiMo API Key"
          placeholder="..."
          value=""
          maskedPreview={settings.mimoApiKey ?? ''}
          onChange={(v: string) => saveApiKey('mimoApiKey', v)}
        />
        <ApiKeyInput
          label="BFL API Key"
          placeholder="..."
          value=""
          maskedPreview={settings.bflApiKey ?? ''}
          onChange={(v: string) => saveApiKey('bflApiKey', v)}
        />
      </div>
    </section>

    <!-- Section 2: Model Defaults -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Model Defaults</h2>
      <div class="grid gap-6 md:grid-cols-2">
        <ModelSelector
          type="content"
          provider={settings.llmProvider}
          model={settings.llmModel}
          models={contentModels}
          onProviderChange={handleProviderChange}
          onModelChange={(m: string) => { if (settings) settings.llmModel = m; }}
        />
        <ModelSelector
          type="image"
          provider={settings.imageProvider}
          model={settings.imageModel}
          models={imageModels}
          onProviderChange={handleImageProviderChange}
          onModelChange={(m: string) => { if (settings) settings.imageModel = m; }}
        />
      </div>
    </section>

    <!-- Section 3: Integrations Status -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Integrations Status</h2>
      <div class="grid gap-4 md:grid-cols-3">
        <div class="rounded-lg border p-4">
          <h3 class="font-medium">EasyWeek</h3>
          <p class="text-sm text-muted-foreground">Per-lead configuration</p>
        </div>
        <div class="rounded-lg border p-4">
          <h3 class="font-medium">WayForPay</h3>
          <p class="text-sm text-muted-foreground">Per-lead configuration</p>
        </div>
        <div class="rounded-lg border p-4">
          <h3 class="font-medium">Monobank</h3>
          <p class="text-sm text-muted-foreground">Per-lead configuration</p>
        </div>
      </div>
    </section>

    <button
      onclick={saveSettings}
      disabled={saveStatus === 'saving'}
      class="rounded-md bg-primary px-6 py-2 text-white"
    >
      {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Settings'}
    </button>
  {/if}
</div>

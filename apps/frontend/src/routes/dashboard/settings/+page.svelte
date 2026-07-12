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

  onMount(async () => {
    settings = await api.get<AppSettings>('/settings');
    // Fetch models from API instead of importing CJS module (Rollup compat)
    const modelData = await api.get<{ content: ContentModel[]; image: ImageModel[] }>('/settings/models');
    contentModels = modelData.content;
    imageModels = modelData.image;
    loading = false;
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

    <!-- Section 2: Enrichment API Keys -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Enrichment API Keys</h2>
      <p class="text-sm text-muted-foreground">Keys for lead enrichment from Instagram, Facebook, and Google Maps</p>

      <details class="rounded-lg border bg-muted/30 p-4 text-sm">
        <summary class="cursor-pointer font-medium">How to obtain API keys (click to expand)</summary>
        <div class="mt-3 space-y-3 text-muted-foreground">
          <div>
            <strong class="text-foreground">Facebook App ID + Secret + Access Token:</strong>
            <ol class="list-decimal pl-4 mt-1 space-y-1">
              <li>Go to <a href="https://developers.facebook.com/" target="_blank" class="text-primary underline">developers.facebook.com</a> → Create App → Type: "Business"</li>
              <li>App ID + Secret: Settings → Basic → copy App ID and App Secret</li>
              <li>Access Token: Tools → Graph API Explorer → select your app → generate User Token with <code>pages_read_engagement</code> permission</li>
              <li>For production: submit App Review for <code>pages_read_engagement</code> (2-7 days)</li>
            </ol>
          </div>
          <div>
            <strong class="text-foreground">Google Maps API Key:</strong>
            <ol class="list-decimal pl-4 mt-1 space-y-1">
              <li>Go to <a href="https://console.cloud.google.com/apis/" target="_blank" class="text-primary underline">Google Cloud Console</a> → APIs & Services → Credentials</li>
              <li>Create API Key → restrict to: Places API, Geocoding API</li>
              <li>Enable APIs: Places API, Maps JavaScript API, Geocoding API</li>
            </ol>
          </div>
          <div>
            <strong class="text-foreground">Instagram Access Token (optional):</strong>
            <ol class="list-decimal pl-4 mt-1 space-y-1">
              <li>Requires Facebook App with Instagram Basic Display API configured</li>
              <li>Facebook App → Products → Instagram Basic Display → generate token</li>
              <li>If not set: system uses unauthenticated scraping (limited data)</li>
            </ol>
          </div>
        </div>
      </details>

      <div class="grid gap-4 md:grid-cols-2">
        <ApiKeyInput
          label="Facebook App ID"
          placeholder="123456789..."
          value=""
          maskedPreview={settings.facebookAppId ?? ''}
          onChange={(v: string) => saveApiKey('facebookAppId', v)}
        />
        <ApiKeyInput
          label="Facebook App Secret"
          placeholder="abc123..."
          value=""
          maskedPreview={settings.facebookAppSecret ?? ''}
          onChange={(v: string) => saveApiKey('facebookAppSecret', v)}
        />
        <ApiKeyInput
          label="Facebook Access Token"
          placeholder="EAA..."
          value=""
          maskedPreview={settings.facebookAccessToken ?? ''}
          onChange={(v: string) => saveApiKey('facebookAccessToken', v)}
        />
        <ApiKeyInput
          label="Google Maps API Key"
          placeholder="AIza..."
          value=""
          maskedPreview={settings.googleMapsApiKey ?? ''}
          onChange={(v: string) => saveApiKey('googleMapsApiKey', v)}
        />
        <ApiKeyInput
          label="Instagram Access Token"
          placeholder="IG..."
          value=""
          maskedPreview={settings.instagramAccessToken ?? ''}
          onChange={(v: string) => saveApiKey('instagramAccessToken', v)}
        />
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="flex items-center gap-3 rounded-lg border p-4">
          <input
            type="checkbox"
            checked={settings.enrichmentAutoRun}
            onchange={(e: any) => saveApiKey('enrichmentAutoRun', e.target.checked ? 'true' : 'false')}
            class="h-4 w-4"
          />
          <div>
            <p class="font-medium">Auto-Run Enrichment</p>
            <p class="text-sm text-muted-foreground">Auto-enrich leads on creation</p>
          </div>
        </label>
        <label class="rounded-lg border p-4">
          <p class="font-medium mb-1">Default Sources</p>
          <p class="text-sm text-muted-foreground mb-2">Comma-separated: instagram,facebook,googleMaps</p>
          <input
            type="text"
            value={settings.enrichmentDefaultSources ?? 'instagram,facebook,googleMaps'}
            onchange={(e: any) => saveApiKey('enrichmentDefaultSources', e.target.value)}
            class="w-full rounded border p-2 text-sm"
            placeholder="instagram,facebook,googleMaps"
          />
        </label>
      </div>
    </section>

    <!-- Section 3: Model Defaults -->
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

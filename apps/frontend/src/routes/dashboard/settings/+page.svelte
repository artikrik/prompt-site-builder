<script lang="ts">
  /* global console */
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { api } from '$lib/api/client.js';

  let settings = $state({
    llmProvider: 'openai',
    defaultTheme: 'hugo-theme-zen',
    baseDomain: 'sitenow.pp.ua',
    hugoSitesPath: '/var/www/client-sites',
    widgets: {
      easyweekEnabled: false,
      wayforpayEnabled: false,
      monobankEnabled: false,
    },
  });

  let loading = $state(true);
  let saving = $state(false);
  let message = $state('');

  const providerOptions = [
    { value: 'anthropic', label: 'Anthropic Claude' },
    { value: 'openai', label: 'OpenAI GPT-4o' },
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'mimo', label: 'Mimo AI' },
  ];

  let providerLabel = $derived(providerOptions.find((o) => o.value === settings.llmProvider)?.label ?? 'OpenAI GPT-4o');

  onMount(async () => {
    try {
      const data = await api.get<any>('/settings');
      settings = { ...settings, ...data };
    } catch (_e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load settings:', _e);
    } finally {
      loading = false;
    }
  });

  async function handleSave() {
    saving = true;
    message = '';
    try {
      await api.put('/settings', settings);
      message = 'Settings saved successfully';
    } catch {
      message = 'Failed to save settings';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head><title>Settings - Prompt Site Builder</title></svelte:head>

<div class="space-y-6">
  <h1 class="text-2xl font-bold tracking-tight">Settings</h1>

  {#if loading}
    <p class="text-muted-foreground">Loading settings...</p>
  {:else}
    <Card.Root>
      <Card.Header>
        <Card.Title>AI Configuration</Card.Title>
        <Card.Description>Configure LLM provider and theme defaults.</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="space-y-2">
          <Label for="llm-provider">LLM Provider</Label>
          <Select.Root type="single" bind:value={settings.llmProvider}>
            <Select.Trigger class="w-full">{providerLabel}</Select.Trigger>
            <Select.Content>
              {#each providerOptions as option (option.value)}
                <Select.Item value={option.value}>{option.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="space-y-2">
          <Label for="domain">Base Domain</Label>
          <Input id="domain" bind:value={settings.baseDomain} placeholder="sitenow.pp.ua" />
          <p class="text-sm text-muted-foreground">Client sites: [slug].{settings.baseDomain}</p>
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Widget Integrations</Card.Title>
        <Card.Description>Status of external service integrations.</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-3">
        <div class="flex items-center justify-between">
          <span>EasyWeek Booking</span>
          <span class={settings.widgets.easyweekEnabled ? 'text-green-600' : 'text-red-500'}>
            {settings.widgets.easyweekEnabled ? 'Connected' : 'Not configured'}
          </span>
        </div>
        <div class="flex items-center justify-between">
          <span>WayForPay Payments</span>
          <span class={settings.widgets.wayforpayEnabled ? 'text-green-600' : 'text-red-500'}>
            {settings.widgets.wayforpayEnabled ? 'Connected' : 'Not configured'}
          </span>
        </div>
        <div class="flex items-center justify-between">
          <span>Monobank Payments</span>
          <span class={settings.widgets.monobankEnabled ? 'text-green-600' : 'text-red-500'}>
            {settings.widgets.monobankEnabled ? 'Connected' : 'Not configured'}
          </span>
        </div>
      </Card.Content>
    </Card.Root>

    <div class="flex items-center justify-between">
      {#if message}
        <p class="text-sm text-green-600">{message}</p>
      {/if}
      <Button onclick={handleSave} disabled={saving} class="ml-auto">
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  {/if}
</div>

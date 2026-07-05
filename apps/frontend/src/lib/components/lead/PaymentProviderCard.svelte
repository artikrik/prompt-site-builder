<!-- apps/frontend/src/lib/components/lead/PaymentProviderCard.svelte -->
<script lang="ts">
  interface Props {
    name: string;
    enabled: boolean;
    apiKey: string;
    apiKeyMasked: string;
    apiKeyLabel: string;
    extraFields: Array<{ label: string; value: string; onChange: (v: string) => void }>;
    webhookUrl: string;
    onToggle: (enabled: boolean) => void;
    onApiKeyChange: (key: string) => void;
  }

  let {
    name, enabled, apiKey, apiKeyMasked, apiKeyLabel,
    extraFields, webhookUrl, onToggle, onApiKeyChange,
  }: Props = $props();

  let isEditingKey = $state(false);
  let keyInput = $state('');
</script>

<div class="rounded-lg border p-4 space-y-3">
  <div class="flex items-center justify-between">
    <h3 class="font-semibold">{name}</h3>
    <button
      onclick={() => onToggle(!enabled)}
      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
      class:bg-primary={enabled}
      class:bg-muted={!enabled}
    >
      <span
        class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
        class:translate-x-6={enabled}
        class:translate-x-1={!enabled}
      />
    </button>
  </div>

  {#if enabled}
    <div class="space-y-2">
      <!-- API Key -->
      <div>
        <label class="text-sm">{apiKeyLabel}</label>
        {#if isEditingKey}
          <div class="flex gap-2 mt-1">
            <input type="password" bind:value={keyInput} class="flex-1 rounded-md border px-2 py-1 text-sm" />
            <button onclick={() => { onApiKeyChange(keyInput); isEditingKey = false; }} class="text-sm text-primary">Save</button>
          </div>
        {:else if apiKey}
          <div class="flex gap-2 mt-1">
            <code class="flex-1 rounded-md bg-muted px-2 py-1 text-sm">{apiKeyMasked}</code>
            <button onclick={() => { keyInput = ''; isEditingKey = true; }} class="text-sm">Change</button>
          </div>
        {:else}
          <div class="flex gap-2 mt-1">
            <input type="password" bind:value={keyInput} placeholder="Enter API key" class="flex-1 rounded-md border px-2 py-1 text-sm" />
            <button onclick={() => { onApiKeyChange(keyInput); keyInput = ''; }} class="text-sm text-primary">Save</button>
          </div>
        {/if}
      </div>

      <!-- Extra fields (e.g., WayForPay Merchant) -->
      {#each extraFields as field (field.label)}
        <div>
          <label class="text-sm">{field.label}</label>
          <input
            type="text"
            value={field.value}
            oninput={(e) => field.onChange(e.currentTarget.value)}
            class="w-full rounded-md border px-2 py-1 text-sm mt-1"
          />
        </div>
      {/each}

      <!-- Webhook URL -->
      <div>
        <label class="text-sm">Webhook URL</label>
        <code class="block rounded-md bg-muted px-2 py-1 text-xs mt-1 break-all">{webhookUrl}</code>
      </div>
    </div>
  {/if}
</div>

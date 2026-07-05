<script lang="ts">
  /* global console */
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { api } from '$lib/api/client.js';
  import PaymentProviderCard from '$lib/components/lead/PaymentProviderCard.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { ArrowLeft } from '@lucide/svelte';
  import type { Lead } from '@prompt-site-builder/shared';

  let lead = $state<Lead | null>(null);
  let isLoading = $state(true);
  let saveStatus = $state<'idle' | 'saving' | 'saved'>('idle');

  let leadId = $derived($page.params.id);

  onMount(async () => {
    try {
      lead = await api.get<Lead>(`/leads/${leadId}`);
    } catch {
      // eslint-disable-next-line no-console
      console.error('Failed to load lead');
    } finally {
      isLoading = false;
    }
  });

  function maskApiKey(key: string | null): string {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 3)}...${key.slice(-4)}`;
  }

  async function savePaymentConfig() {
    if (!lead) return;
    saveStatus = 'saving';
    await api.put(`/leads/${lead.id}`, {
      easyweekEnabled: lead.easyweekEnabled,
      easyweekApiKey: lead.easyweekApiKey,
      wayforpayEnabled: lead.wayforpayEnabled,
      wayforpayMerchant: lead.wayforpayMerchant,
      wayforpaySecret: lead.wayforpaySecret,
      monobankEnabled: lead.monobankEnabled,
      monobankApiKey: lead.monobankApiKey,
    });
    saveStatus = 'saved';
    // Status stays 'saved' until next action
  }

  function getWebhookUrl(provider: string): string {
    return `https://sitenow.pp.ua/api/webhooks/${provider}/${leadId}`;
  }
</script>

<svelte:head><title>Lead Details - Prompt Site Builder</title></svelte:head>

<div class="space-y-6">
  <div>
    <Button variant="ghost" size="sm" onclick={() => goto(resolve('/dashboard/leads'))}>
      <ArrowLeft class="w-4 h-4 mr-2" />
      Back to Leads
    </Button>
  </div>

  {#if isLoading}
    <div class="text-center py-12 text-muted-foreground">Loading...</div>
  {:else if !lead}
    <div class="text-center py-12 text-muted-foreground">Lead not found</div>
  {:else}
    <h1 class="text-2xl font-bold tracking-tight">{lead.businessName}</h1>

    <!-- Lead Info -->
    <section class="grid gap-4 md:grid-cols-2">
      <div><label class="text-sm text-muted-foreground">Phone</label><p>{lead.phone || '—'}</p></div>
      <div><label class="text-sm text-muted-foreground">Email</label><p>{lead.email || '—'}</p></div>
      <div><label class="text-sm text-muted-foreground">City</label><p>{lead.city || '—'}</p></div>
      <div><label class="text-sm text-muted-foreground">Category</label><p>{lead.category || '—'}</p></div>
      <div><label class="text-sm text-muted-foreground">Source</label><p>{lead.source}</p></div>
      <div><label class="text-sm text-muted-foreground">Status</label><p>{lead.status}</p></div>
    </section>

    <!-- Payment & Booking Configuration -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Site Services</h2>

      <PaymentProviderCard
        name="EasyWeek (Online Booking)"
        enabled={lead.easyweekEnabled}
        apiKey={lead.easyweekApiKey ?? ''}
        apiKeyMasked={maskApiKey(lead!.easyweekApiKey)}
        apiKeyLabel="API Key"
        extraFields={[]}
        webhookUrl={getWebhookUrl('easyweek')}
        onToggle={(v: boolean) => (lead!.easyweekEnabled = v)}
        onApiKeyChange={(k: string) => (lead!.easyweekApiKey = k)}
      />

      <PaymentProviderCard
        name="WayForPay (Payment)"
        enabled={lead.wayforpayEnabled}
        apiKey={lead.wayforpaySecret ?? ''}
        apiKeyMasked={maskApiKey(lead!.wayforpaySecret)}
        apiKeyLabel="Secret Key"
        extraFields={[{
          label: 'Merchant ID',
          value: lead.wayforpayMerchant ?? '',
          onChange: (v: string) => (lead!.wayforpayMerchant = v),
        }]}
        webhookUrl={getWebhookUrl('wayforpay')}
        onToggle={(v: boolean) => (lead!.wayforpayEnabled = v)}
        onApiKeyChange={(k: string) => (lead!.wayforpaySecret = k)}
      />

      <PaymentProviderCard
        name="Monobank (Payment)"
        enabled={lead.monobankEnabled}
        apiKey={lead.monobankApiKey ?? ''}
        apiKeyMasked={maskApiKey(lead!.monobankApiKey)}
        apiKeyLabel="API Key"
        extraFields={[]}
        webhookUrl={getWebhookUrl('monobank')}
        onToggle={(v: boolean) => (lead!.monobankEnabled = v)}
        onApiKeyChange={(k: string) => (lead!.monobankApiKey = k)}
      />
    </section>

    <div>
      <Button
        onclick={savePaymentConfig}
        disabled={saveStatus === 'saving'}
      >
        {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Services'}
      </Button>
    </div>
  {/if}
</div>

<script lang="ts">
  /* global console, window */
  import { onMount } from 'svelte';
  import { leads } from '$lib/stores/leads';
  import { projects } from '$lib/stores/projects';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { t } from '$lib/i18n/uk';
  import { CATEGORY_LABELS } from '$lib/i18n/categories';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import { Plus, Search, Trash2, Loader2 } from '@lucide/svelte';

  let search = $state('');
  let statusFilter = $state('');
  let showCreateModal = $state(false);
  let deletingId = $state<string | null>(null);
  let newLead = $state({
    businessName: '',
    source: 'manual',
    category: '',
    phone: '',
    email: '',
    city: '',
    region: '',
    country: 'Україна',
    socialUrls: [''],
  });

  const sourceOptions = [
    { value: 'manual', label: 'Вручну' },
    { value: 'google-maps', label: 'Google Maps' },
    { value: 'social-media', label: 'Соцмережі' },
  ];

  const statusOptions = [
    { value: '', label: 'Всі статуси' },
    { value: 'NEW', label: t.status.NEW },
    { value: 'CONTACTED', label: t.status.CONTACTED },
    { value: 'QUALIFIED', label: t.status.QUALIFIED },
    { value: 'CONVERTED', label: t.status.CONVERTED },
    { value: 'REJECTED', label: t.status.REJECTED },
  ];

  const categoryOptions = CATEGORY_LABELS.map((c: string) => ({ value: c, label: c }));

  let sourceLabel = $derived(sourceOptions.find((o) => o.value === newLead.source)?.label ?? 'Вручну');
  let statusLabel = $derived(statusOptions.find((o) => o.value === statusFilter)?.label ?? 'Всі статуси');
  let categoryLabel = $derived(newLead.category || 'Оберіть категорію');

  onMount(() => { leads.fetchAll(); });

  function addSocialUrl() { newLead.socialUrls = [...newLead.socialUrls, '']; }
  function removeSocialUrl(index: number) { newLead.socialUrls = newLead.socialUrls.filter((_, i) => i !== index); }

  async function handleSearch() {
    await leads.fetchAll({ search, status: statusFilter || undefined });
  }

  async function handleCreate() {
    try {
      const filteredUrls = newLead.socialUrls.filter(url => url.trim() !== '');
      await leads.create({ ...newLead, socialUrls: filteredUrls });
      showCreateModal = false;
      newLead = { businessName: '', source: 'manual', category: '', phone: '', email: '', city: '', region: '', country: 'Україна', socialUrls: [''] };
    } catch {
      console.error('Failed to create lead');
    }
  }

  async function createProject(leadId: string) {
    try {
      const project = await projects.create(leadId);
      goto(resolve(`/dashboard/projects/${project.id}`));
    } catch {
      console.error('Failed to create project');
    }
  }

  async function handleDeleteLead(leadId: string, leadName: string) {
    if (!window.confirm(`Видалити ліда "${leadName}"? Це також видалить пов'язані проекти.`)) return;
    deletingId = leadId;
    try {
      await leads.remove(leadId);
    } catch {
      console.error('Failed to delete lead');
    }
    deletingId = null;
  }

  function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
      case 'NEW': return 'secondary';
      case 'CONTACTED': return 'outline';
      case 'QUALIFIED': return 'default';
      case 'CONVERTED': return 'default';
      case 'REJECTED': return 'destructive';
      default: return 'outline';
    }
  }
</script>

<svelte:head><title>{t.leads.title} - {t.app.name}</title></svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold tracking-tight">{t.leads.title}</h1>
    <Dialog.Root bind:open={showCreateModal}>
      <Dialog.Trigger>
        <Button>
          <Plus class="size-4 mr-2" />
          {t.leads.addLead}
        </Button>
      </Dialog.Trigger>
      <Dialog.Content class="max-w-lg">
        <Dialog.Header>
          <Dialog.Title>{t.leads.createLead}</Dialog.Title>
          <Dialog.Description>Заповніть інформацію про бізнес.</Dialog.Description>
        </Dialog.Header>
        <form onsubmit={(e) => { e.preventDefault(); handleCreate(); }} class="space-y-4">
          <div class="space-y-2">
            <Label for="businessName">{t.leads.businessName} *</Label>
            <Input id="businessName" bind:value={newLead.businessName} required placeholder="Стоматологія ДентПро" />
          </div>
          <div class="space-y-2">
            <Label>{t.leads.category}</Label>
            <Select.Root type="single" bind:value={newLead.category}>
              <Select.Trigger class="w-full">{categoryLabel}</Select.Trigger>
              <Select.Content>
                {#each categoryOptions as option (option.value)}
                  <Select.Item value={option.value}>{option.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="city">{t.leads.city}</Label>
              <Input id="city" bind:value={newLead.city} placeholder="Київ" />
            </div>
            <div class="space-y-2">
              <Label for="region">{t.leads.region}</Label>
              <Input id="region" bind:value={newLead.region} placeholder="Київська область" />
            </div>
          </div>
          <div class="space-y-2">
            <Label for="country">{t.leads.country}</Label>
            <Input id="country" bind:value={newLead.country} placeholder="Україна" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="phone">{t.leads.phone}</Label>
              <Input id="phone" bind:value={newLead.phone} placeholder="+380..." />
            </div>
            <div class="space-y-2">
              <Label for="email">{t.leads.email}</Label>
              <Input id="email" bind:value={newLead.email} type="email" placeholder="info@example.com" />
            </div>
          </div>
          <div class="space-y-2">
            <Label>{t.leads.socialLinks}</Label>
            {#each newLead.socialUrls as _, i (i)}
              <div class="flex gap-2">
                <Input bind:value={newLead.socialUrls[i]} placeholder="https://instagram.com/..." />
                {#if newLead.socialUrls.length > 1}
                  <Button type="button" variant="ghost" size="icon" onclick={() => removeSocialUrl(i)}>
                    <Trash2 class="size-4" />
                  </Button>
                {/if}
              </div>
            {/each}
            <Button type="button" variant="outline" size="sm" onclick={addSocialUrl}>
              <Plus class="size-3 mr-1" /> {t.leads.addSocialLink}
            </Button>
          </div>
          <div class="space-y-2">
            <Label>{t.leads.source}</Label>
            <Select.Root type="single" bind:value={newLead.source}>
              <Select.Trigger class="w-full">{sourceLabel}</Select.Trigger>
              <Select.Content>
                {#each sourceOptions as option (option.value)}
                  <Select.Item value={option.value}>{option.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <Dialog.Footer>
            <Button type="button" variant="outline" onclick={() => { showCreateModal = false; }}>{t.common.cancel}</Button>
            <Button type="submit">{t.leads.createLead}</Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  </div>

  <Card.Root>
    <Card.Content class="pt-6">
      <div class="flex items-center gap-4 mb-6">
        <div class="relative flex-1">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input bind:value={search} onkeyup={handleSearch} placeholder={t.leads.searchLeads} class="pl-9" />
        </div>
        <Select.Root type="single" bind:value={statusFilter} onValueChange={handleSearch}>
          <Select.Trigger class="w-40">{statusLabel}</Select.Trigger>
          <Select.Content>
            {#each statusOptions as option (option.value)}
              <Select.Item value={option.value}>{option.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>

      {#if $leads.isLoading}
        <div class="text-center py-12 text-muted-foreground">{t.common.loading}</div>
      {:else if $leads.leads.length === 0}
        <div class="text-center py-12 text-muted-foreground">{t.leads.noLeads}</div>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Бізнес</Table.Head>
              <Table.Head>Контакти</Table.Head>
              <Table.Head>Локація</Table.Head>
              <Table.Head>{t.leads.status}</Table.Head>
              <Table.Head class="text-right">{t.common.actions}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each $leads.leads as lead (lead.id)}
              <Table.Row class="cursor-pointer hover:bg-muted/50" onclick={() => goto(resolve(`/dashboard/leads/${lead.id}`))}>
                <Table.Cell>
                  <div class="font-medium">{lead.businessName}</div>
                  <div class="text-sm text-muted-foreground">{lead.category || '—'}</div>
                </Table.Cell>
                <Table.Cell>
                  <div class="text-sm">{lead.phone || '—'}</div>
                  <div class="text-sm text-muted-foreground">{lead.email || '—'}</div>
                </Table.Cell>
                <Table.Cell class="text-sm">{lead.city || lead.region || '—'}</Table.Cell>
                <Table.Cell>
                  <Badge variant={getStatusVariant(lead.status)}>{t.status[lead.status as keyof typeof t.status] ?? lead.status}</Badge>
                </Table.Cell>
                <Table.Cell class="text-right">
                  <Button variant="ghost" size="sm" onclick={(e) => { e.stopPropagation(); createProject(lead.id); }}>Створити сайт</Button>
                  <Button variant="ghost" size="icon" class="text-destructive hover:text-destructive" onclick={(e) => { e.stopPropagation(); handleDeleteLead(lead.id, lead.businessName); }} disabled={deletingId === lead.id}>
                    {#if deletingId === lead.id}<Loader2 class="size-4 animate-spin" />{:else}<Trash2 class="size-4" />{/if}
                  </Button>
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

/* global console, window, alert, document */
<script lang="ts">
  import { onMount } from 'svelte';
  import { leads } from '$lib/stores/leads';
  import { projects } from '$lib/stores/projects';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import { Plus, Search } from '@lucide/svelte';

  let search = $state('');
  let statusFilter = $state('');
  let showCreateModal = $state(false);
  let newLead = $state({ businessName: '', source: 'manual', category: '' });

  const sourceOptions = [
    { value: 'manual', label: 'Manual' },
    { value: 'google-maps', label: 'Google Maps' },
    { value: 'social-media', label: 'Social Media' },
  ];

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'NEW', label: 'New' },
    { value: 'CONTACTED', label: 'Contacted' },
    { value: 'QUALIFIED', label: 'Qualified' },
    { value: 'CONVERTED', label: 'Converted' },
    { value: 'REJECTED', label: 'Rejected' },
  ];

  let sourceLabel = $derived(sourceOptions.find((o) => o.value === newLead.source)?.label ?? 'Manual');
  let statusLabel = $derived(statusOptions.find((o) => o.value === statusFilter)?.label ?? 'All Status');

  onMount(() => { leads.fetchAll(); });

  async function handleSearch() {
    await leads.fetchAll({ search, status: statusFilter || undefined });
  }

  async function handleCreate() {
    try {
      await leads.create(newLead);
      showCreateModal = false;
      newLead = { businessName: '', source: 'manual', category: '' };
    } catch {
      // eslint-disable-next-line no-console
      console.error('Failed to create lead');
    }
  }

  async function createProject(leadId: string) {
    try {
      const project = await projects.create(leadId);
      goto(resolve(`/dashboard/projects/${project.id}`));
    } catch {
      // eslint-disable-next-line no-console
      console.error('Failed to create project');
    }
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

<svelte:head><title>Leads - Prompt Site Builder</title></svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold tracking-tight">Leads</h1>
    <Dialog.Root bind:open={showCreateModal}>
      <Dialog.Trigger>
        <Button>
          <Plus class="size-4 mr-2" />
          Add Lead
        </Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Add New Lead</Dialog.Title>
          <Dialog.Description>Create a new lead to generate a website for.</Dialog.Description>
        </Dialog.Header>
        <form onsubmit={(e) => { e.preventDefault(); handleCreate(); }} class="space-y-4">
          <div class="space-y-2">
            <Label for="businessName">Business Name *</Label>
            <Input id="businessName" bind:value={newLead.businessName} required placeholder="Enter business name" />
          </div>
          <div class="space-y-2">
            <Label for="category">Category</Label>
            <Input id="category" bind:value={newLead.category} placeholder="e.g., Restaurant, Salon" />
          </div>
          <div class="space-y-2">
            <Label>Source</Label>
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
            <Button type="button" variant="outline" onclick={() => { showCreateModal = false; }}>Cancel</Button>
            <Button type="submit">Create Lead</Button>
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
          <Input bind:value={search} onkeyup={handleSearch} placeholder="Search leads..." class="pl-9" />
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
        <div class="text-center py-12 text-muted-foreground">Loading...</div>
      {:else if $leads.leads.length === 0}
        <div class="text-center py-12 text-muted-foreground">No leads found</div>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Business</Table.Head>
              <Table.Head>Contact</Table.Head>
              <Table.Head>Location</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head class="text-right">Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each $leads.leads as lead (lead.id)}
              <Table.Row>
                <Table.Cell>
                  <div class="font-medium">{lead.businessName}</div>
                  <div class="text-sm text-muted-foreground">{lead.category || 'N/A'}</div>
                </Table.Cell>
                <Table.Cell>
                  <div class="text-sm">{lead.phone || 'N/A'}</div>
                  <div class="text-sm text-muted-foreground">{lead.email || 'N/A'}</div>
                </Table.Cell>
                <Table.Cell class="text-sm">{lead.city || lead.address || 'N/A'}</Table.Cell>
                <Table.Cell>
                  <Badge variant={getStatusVariant(lead.status)}>{lead.status}</Badge>
                </Table.Cell>
                <Table.Cell class="text-right">
                  <Button variant="ghost" size="sm" onclick={() => createProject(lead.id)}>Create Site</Button>
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

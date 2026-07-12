<script lang="ts">
  /* global fetch, window */
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { leads, type Lead } from '$lib/stores/leads';
  import { projects } from '$lib/stores/projects';
  import { t } from '$lib/i18n/uk';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { ArrowLeft, Plus } from '@lucide/svelte';

  let lead = $state<Lead | null>(null);
  let leadProjects = $state<Array<{ id: string; status: string; slug: string; createdAt: string }>>([]);
  let isLoading = $state(true);
  let activeTab = $state<'details' | 'enrichment' | 'projects' | 'scraping'>('details');

  onMount(async () => {
    try {
      lead = await leads.fetchOne($page.params.id!);
      try {
        const res = await fetch(`/api/projects?leadId=${lead!.id}`);
        if (res.ok) leadProjects = await res.json();
      } catch { leadProjects = []; }
    } finally {
      isLoading = false;
    }
  });

  async function handleCreateProject() {
    if (!lead) return;
    try {
      const project = await projects.create(lead.id);
      goto(resolve(`/dashboard/projects/${project.id}`));
    } catch { /* handled */ }
  }

  function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
      case 'PUBLISHED': return 'default';
      case 'GENERATING': return 'secondary';
      case 'FAILED': return 'destructive';
      default: return 'outline';
    }
  }

  const tabs = [
    { id: 'details' as const, label: t.leads.tabs.details },
    { id: 'enrichment' as const, label: t.leads.tabs.enrichment },
    { id: 'projects' as const, label: t.leads.tabs.projects },
    { id: 'scraping' as const, label: t.leads.tabs.scraping },
  ];
</script>

<svelte:head><title>{lead?.businessName || t.leads.title} - {t.app.name}</title></svelte:head>

<div class="space-y-6">
  <Button variant="ghost" size="sm" onclick={() => goto(resolve('/dashboard/leads'))}>
    <ArrowLeft class="size-4 mr-2" /> {t.common.back}
  </Button>

  {#if isLoading}
    <div class="text-center py-12 text-muted-foreground">{t.common.loading}</div>
  {:else if !lead}
    <div class="text-center py-12 text-muted-foreground">{t.leads.noLeads}</div>
  {:else}
    <div class="flex border-b gap-1">
      {#each tabs as tab (tab.id)}
        <button
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
            {activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}"
          onclick={() => { activeTab = tab.id; }}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    {#if activeTab === 'details'}
      <Card.Root>
        <Card.Header>
          <Card.Title>{lead.businessName}</Card.Title>
          <div class="flex items-center gap-2 mt-1">
            <Badge variant={lead.status === 'NEW' ? 'secondary' : lead.status === 'CONVERTED' ? 'default' : lead.status === 'REJECTED' ? 'destructive' : 'outline'}>
              {t.status[lead.status as keyof typeof t.status] ?? lead.status}
            </Badge>
          </div>
        </Card.Header>
        <Card.Content>
          <dl class="grid grid-cols-2 gap-4">
            <div class="flex justify-between"><dt class="text-muted-foreground">{t.leads.phone}</dt><dd>{lead.phone || '—'}</dd></div>
            <div class="flex justify-between"><dt class="text-muted-foreground">{t.leads.email}</dt><dd>{lead.email || '—'}</dd></div>
            <div class="flex justify-between"><dt class="text-muted-foreground">{t.leads.city}</dt><dd>{lead.city || '—'}</dd></div>
            <div class="flex justify-between"><dt class="text-muted-foreground">{t.leads.region}</dt><dd>{lead.region || '—'}</dd></div>
            <div class="flex justify-between"><dt class="text-muted-foreground">{t.leads.country}</dt><dd>{lead.country || '—'}</dd></div>
            <div class="flex justify-between"><dt class="text-muted-foreground">{t.leads.category}</dt><dd>{lead.category || '—'}</dd></div>
            <div class="flex justify-between"><dt class="text-muted-foreground">{t.leads.source}</dt><dd>{lead.source}</dd></div>
            <div class="col-span-2">
              <dt class="text-muted-foreground mb-1">{t.leads.socialLinks}</dt>
              <dd>
                {#if lead.socialUrls && lead.socialUrls.length > 0}
                  <ul class="space-y-1">
                    {#each lead.socialUrls as url, i (i)}
                      <li><button onclick={() => window.open(url, '_blank')} class="text-blue-600 hover:underline text-sm">{url}</button></li>
                    {/each}
                  </ul>
                {:else}—{/if}
              </dd>
            </div>
          </dl>
        </Card.Content>
      </Card.Root>
    {:else if activeTab === 'enrichment'}
      <Card.Root>
        <Card.Header><Card.Title>{t.enrichment.title}</Card.Title></Card.Header>
        <Card.Content>
          {#if lead.enrichmentData}
            <pre class="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96">{JSON.stringify(lead.enrichmentData, null, 2)}</pre>
          {:else}
            <p class="text-muted-foreground">{t.enrichment.never}</p>
          {/if}
        </Card.Content>
      </Card.Root>
    {:else if activeTab === 'projects'}
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold">{t.leads.tabs.projects}</h2>
          <Button onclick={handleCreateProject}>
            <Plus class="size-4 mr-2" /> {t.projects.generate}
          </Button>
        </div>
        {#if leadProjects.length === 0}
          <div class="text-center py-12 text-muted-foreground">{t.projects.noProjects}</div>
        {:else}
          <div class="grid gap-4">
            {#each leadProjects as project (project.id)}
              <Card.Root class="cursor-pointer hover:shadow-md transition-shadow" onclick={() => goto(resolve(`/dashboard/projects/${project.id}`))}>
                <Card.Content class="flex items-center justify-between py-4">
                  <div>
                    <div class="font-medium">{project.slug}.sitenow.pp.ua</div>
                    <div class="text-sm text-muted-foreground">{new Date(project.createdAt).toLocaleDateString()}</div>
                  </div>
                  <Badge variant={getStatusVariant(project.status)}>{t.status[project.status as keyof typeof t.status] ?? project.status}</Badge>
                </Card.Content>
              </Card.Root>
            {/each}
          </div>
        {/if}
      </div>
    {:else if activeTab === 'scraping'}
      <Card.Root>
        <Card.Header><Card.Title>{t.scraping.title}</Card.Title></Card.Header>
        <Card.Content>
          <p class="text-muted-foreground">{t.scraping.noResults}</p>
        </Card.Content>
      </Card.Root>
    {/if}
  {/if}
</div>

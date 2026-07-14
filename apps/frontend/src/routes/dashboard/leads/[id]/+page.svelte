<script lang="ts">
  /* global window, HTMLInputElement */
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { leads, type Lead } from '$lib/stores/leads';
  import { projects } from '$lib/stores/projects';
  import { api } from '$lib/api/client';
  import { t } from '$lib/i18n/uk';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import EnrichmentPanel from '$lib/components/enrichment/EnrichmentPanel.svelte';
  import { ArrowLeft, Plus, Loader2, Play } from '@lucide/svelte';

  let lead = $state<Lead | null>(null);
  let leadProjects = $state<Array<{ id: string; status: string; slug: string; createdAt: string }>>([]);
  let isLoading = $state(true);
  let activeTab = $state<'details' | 'enrichment' | 'projects' | 'scraping'>('details');

  onMount(async () => {
    try {
      lead = await leads.fetchOne($page.params.id!);
      try {
        leadProjects = await api.get<Array<{ id: string; leadId: string; status: string; slug: string; createdAt: string }>>(`/projects?leadId=${lead!.id}`);
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

  let scrapePlatforms = $state({ instagram: true, facebook: true, googleMaps: true });
  let scrapingBusy = $state(false);
  let scrapeResult = $state<Record<string, unknown> | null>(null);

  async function handleStartScraping() {
    if (!lead || scrapingBusy) return;
    scrapingBusy = true;
    try {
      const selected = Object.entries(scrapePlatforms).filter(([, v]) => v).map(([k]) => k);
      const result = await leads.scrape(lead.id, selected as Array<'instagram' | 'facebook' | 'googleMaps'>);
      scrapeResult = result as unknown as Record<string, unknown> || { jobId: 'started' };
    } catch { scrapeResult = { error: 'Failed to start scraping' }; }
    scrapingBusy = false;
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
      <EnrichmentPanel
        data={lead.enrichmentData as any}
        sources={lead.enrichmentSources || []}
        enrichedAt={lead.enrichedAt || null}
      />
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
      <div class="space-y-4">
        <Card.Root>
          <Card.Header><Card.Title>{t.scraping.title}</Card.Title></Card.Header>
          <Card.Content class="space-y-4">
            <p class="text-sm text-muted-foreground">{t.scraping.selectPlatforms}</p>
            <div class="flex gap-4 flex-wrap">
              {#each ['instagram', 'facebook', 'googleMaps'] as platform (platform)}
                <label class="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={scrapePlatforms[platform as keyof typeof scrapePlatforms]}
                    onchange={(e) => { scrapePlatforms[platform as keyof typeof scrapePlatforms] = (e.target as HTMLInputElement).checked; }}
                    class="rounded"
                  />
                  {platform}
                </label>
              {/each}
            </div>
            <Button onclick={handleStartScraping} disabled={scrapingBusy}>
              {#if scrapingBusy}<Loader2 class="size-4 mr-2 animate-spin" />{/if}
              <Play class="size-4 mr-2" /> {scrapingBusy ? t.scraping.scraping : t.scraping.runScraping}
            </Button>
          </Card.Content>
        </Card.Root>

        {#if scrapeResult}
          <Card.Root>
            <Card.Header><Card.Title>{t.scraping.results}</Card.Title></Card.Header>
            <Card.Content class="space-y-4">
              {#if scrapeResult.error}
                <p class="text-red-600 text-sm">{scrapeResult.error as string}</p>
              {:else if scrapeResult.jobId}
                <p class="text-sm text-muted-foreground">{t.notifications.scrapingStarted} (Job: {scrapeResult.jobId as string})</p>
              {/if}

              {#if lead.scrapedPhotos && lead.scrapedPhotos.length > 0}
                <div>
                  <h4 class="text-sm font-semibold mb-2">{t.scraping.photos} ({lead.scrapedPhotos.length})</h4>
                  <div class="flex gap-2 flex-wrap">
                    {#each lead.scrapedPhotos as photo (photo)}
                      <img src={photo} alt="" class="w-20 h-20 rounded object-cover border" />
                    {/each}
                  </div>
                </div>
              {/if}

              {#if lead.scrapedReviews && lead.scrapedReviews.length > 0}
                <div>
                  <h4 class="text-sm font-semibold mb-2">{t.scraping.reviews} ({lead.scrapedReviews.length})</h4>
                  <div class="space-y-2 max-h-60 overflow-y-auto">
                    {#each lead.scrapedReviews as review, i (i)}
                      <div class="text-xs border-l-2 pl-2 border-muted">
                        <span class="font-medium">{(review as Record<string, unknown>).author || 'Anonymous'}</span>
                        <span class="text-yellow-500 ml-1">{'★'.repeat(Math.round((review as Record<string, unknown>).rating as number || 0))}</span>
                        <p class="text-muted-foreground">{((review as Record<string, unknown>).text as string)?.slice(0, 150)}</p>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if lead.scrapedContacts && Object.keys(lead.scrapedContacts).length > 0}
                <div>
                  <h4 class="text-sm font-semibold mb-2">{t.scraping.contacts}</h4>
                  <dl class="grid grid-cols-2 gap-2 text-xs">
                    {#each Object.entries(lead.scrapedContacts) as [key, value] (key)}
                      <div class="flex justify-between"><dt class="text-muted-foreground">{key}</dt><dd>{value as string}</dd></div>
                    {/each}
                  </dl>
                </div>
              {/if}

              {#if lead.scrapedHours && Object.keys(lead.scrapedHours).length > 0}
                <div>
                  <h4 class="text-sm font-semibold mb-2">{t.scraping.hours}</h4>
                  <dl class="grid grid-cols-2 gap-2 text-xs">
                    {#each Object.entries(lead.scrapedHours) as [day, hours] (day)}
                      <div class="flex justify-between"><dt class="text-muted-foreground">{day}</dt><dd>{hours as string}</dd></div>
                    {/each}
                  </dl>
                </div>
              {/if}

              {#if !lead.scrapedPhotos?.length && !lead.scrapedReviews?.length && !Object.keys(lead.scrapedContacts || {}).length && !Object.keys(lead.scrapedHours || {}).length && !scrapeResult.error}
                <p class="text-muted-foreground text-sm">{t.scraping.noResults}</p>
              {/if}
            </Card.Content>
          </Card.Root>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<script lang="ts">
  /* eslint-disable no-undef */
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n/uk';
  import { api } from '$lib/api/client';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { RefreshCw, Search, Copy, Check } from '@lucide/svelte';

  let activeTab = $state<'generation' | 'system' | 'scraping'>('generation');
  let selectedLog = $state<Record<string, unknown> | null>(null);
  let detailOpen = $state(false);
  let copied = $state(false);

  // Generation logs
  let genJobs = $state<Array<Record<string, unknown>>>([]);
  let genLoading = $state(false);
  let genStatus = $state('');

  // System logs
  let sysLogs = $state<Array<Record<string, unknown>>>([]);
  let sysTotal = $state(0);
  let sysLoading = $state(false);
  let sysLevel = $state('');
  let sysSearch = $state('');
  let sysOffset = $state(0);
  const PAGE_SIZE = 50;

  // Scraping logs
  let scrapeLogs = $state<Array<Record<string, unknown>>>([]);
  let scrapeTotal = $state(0);
  let scrapeLoading = $state(false);
  let scrapeSource = $state('');
  let scrapeStatus = $state('');
  let scrapeOffset = $state(0);

  const sourceOptions = [
    { value: '', label: 'Усі джерела' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'googleMaps', label: 'Google Maps' },
    { value: 'apify', label: 'Apify' },
    { value: 'enrichment', label: 'Enrichment' },
  ];

  const scrapeStatusOptions = [
    { value: '', label: 'Усі статуси' },
    { value: 'started', label: 'Розпочато' },
    { value: 'completed', label: 'Завершено' },
    { value: 'failed', label: 'Помилка' },
  ];

  const statusOptions = [
    { value: '', label: t.logs.allStatuses },
    { value: 'PENDING', label: t.status.PENDING },
    { value: 'PROCESSING', label: t.status.PROCESSING },
    { value: 'COMPLETED', label: t.status.COMPLETED },
    { value: 'FAILED', label: t.status.FAILED },
  ];

  const levelOptions = [
    { value: '', label: t.logs.allLevels },
    { value: 'ERROR', label: 'ERROR' },
    { value: 'WARN', label: 'WARN' },
    { value: 'INFO', label: 'INFO' },
  ];

  onMount(() => { loadGenerationLogs(); });

  async function loadGenerationLogs() {
    genLoading = true;
    try {
      const parts: string[] = ['limit=50'];
      if (genStatus) parts.push(`status=${encodeURIComponent(genStatus)}`);
      const query = parts.join('&');
      const data = await api.get<{ jobs: Array<Record<string, unknown>> }>(`/logs/generation?${query}`);
      genJobs = data.jobs || [];
    } catch { genJobs = []; }
    genLoading = false;
  }

  async function loadSystemLogs() {
    sysLoading = true;
    try {
      const parts: string[] = [];
      if (sysLevel) parts.push(`level=${encodeURIComponent(sysLevel)}`);
      if (sysSearch) parts.push(`search=${encodeURIComponent(sysSearch)}`);
      parts.push(`limit=${PAGE_SIZE}`);
      parts.push(`offset=${sysOffset}`);
      const query = parts.join('&');
      const data = await api.get<{ logs: Array<Record<string, unknown>>; total: number }>(`/logs/system?${query}`);
      sysLogs = data.logs || [];
      sysTotal = data.total || 0;
    } catch { sysLogs = []; }
    sysLoading = false;
  }

  async function loadScrapingLogs() {
    scrapeLoading = true;
    try {
      const parts: string[] = [];
      if (scrapeSource) parts.push(`source=${encodeURIComponent(scrapeSource)}`);
      if (scrapeStatus) parts.push(`status=${encodeURIComponent(scrapeStatus)}`);
      parts.push(`limit=${PAGE_SIZE}`);
      parts.push(`offset=${scrapeOffset}`);
      const query = parts.join('&');
      const data = await api.get<{ logs: Array<Record<string, unknown>>; total: number }>(`/logs/scraping?${query}`);
      scrapeLogs = data.logs || [];
      scrapeTotal = data.total || 0;
    } catch { scrapeLogs = []; }
    scrapeLoading = false;
  }

  function openDetail(log: Record<string, unknown>) {
    selectedLog = log;
    detailOpen = true;
    copied = false;
  }

  async function copyLog() {
    if (!selectedLog) return;
    const text = JSON.stringify(selectedLog, null, 2);
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }

  function getStatusBadge(status: string): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
      case 'COMPLETED': return 'default';
      case 'PROCESSING': return 'secondary';
      case 'FAILED': return 'destructive';
      default: return 'outline';
    }
  }

  function getLevelBadge(level: string): "default" | "secondary" | "destructive" | "outline" {
    switch (level) {
      case 'ERROR': return 'destructive';
      case 'WARN': return 'secondary';
      default: return 'outline';
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString('uk-UA');
  }

  function formatJson(obj: unknown): string {
    if (!obj) return '—';
    if (typeof obj === 'string') return obj;
    return JSON.stringify(obj, null, 2);
  }

  let statusLabel = $derived(statusOptions.find(o => o.value === genStatus)?.label ?? t.logs.allStatuses);
  let levelLabel = $derived(levelOptions.find(o => o.value === sysLevel)?.label ?? t.logs.allLevels);
</script>

<svelte:head><title>{t.nav.logs} - {t.app.name}</title></svelte:head>

<div class="space-y-6">
  <h1 class="text-2xl font-bold tracking-tight">{t.nav.logs}</h1>

  <div class="flex border-b gap-1">
    <button class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
      {activeTab === 'generation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}"
      onclick={() => { activeTab = 'generation'; }}>
      {t.logs.generationLogs}
    </button>
    <button class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
      {activeTab === 'system' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}"
      onclick={() => { activeTab = 'system'; loadSystemLogs(); }}>
      {t.logs.systemLogs}
    </button>
    <button class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
      {activeTab === 'scraping' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}"
      onclick={() => { activeTab = 'scraping'; loadScrapingLogs(); }}>
      {t.logs.scrapingLogs}
    </button>
  </div>

  {#if activeTab === 'generation'}
    <div class="flex items-center gap-4 mb-4">
      <Select.Root type="single" bind:value={genStatus} onValueChange={loadGenerationLogs}>
        <Select.Trigger class="w-40">{statusLabel}</Select.Trigger>
        <Select.Content>
          {#each statusOptions as o (o.value)}
            <Select.Item value={o.value}>{o.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <Button variant="outline" size="sm" onclick={loadGenerationLogs}>
        <RefreshCw class="size-4 mr-1" /> {t.logs.refresh}
      </Button>
    </div>

    <Card.Root>
      <Card.Content class="pt-6">
        {#if genLoading}
          <div class="text-center py-12 text-muted-foreground">{t.common.loading}</div>
        {:else if genJobs.length === 0}
          <div class="text-center py-12 text-muted-foreground">{t.common.noResults}</div>
        {:else}
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>{t.logs.project}</Table.Head>
                <Table.Head>{t.logs.type}</Table.Head>
                <Table.Head>{t.logs.status}</Table.Head>
                <Table.Head>{t.logs.time}</Table.Head>
                <Table.Head>{t.logs.error}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each genJobs as job, i (i)}
                <Table.Row class="cursor-pointer hover:bg-muted/50" onclick={() => openDetail(job)}>
                  <Table.Cell class="font-medium text-sm">{(job.project as any)?.slug || job.projectId as string}</Table.Cell>
                  <Table.Cell class="text-sm">{job.type as string}</Table.Cell>
                  <Table.Cell><Badge variant={getStatusBadge(job.status as string)}>{job.status as string}</Badge></Table.Cell>
                  <Table.Cell class="text-sm">{formatDate(job.createdAt as string)}</Table.Cell>
                  <Table.Cell class="text-sm text-red-600">{job.error as string || '—'}</Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        {/if}
      </Card.Content>
    </Card.Root>
  {:else if activeTab === 'system'}
    <div class="flex items-center gap-4 mb-4">
      <Select.Root type="single" bind:value={sysLevel} onValueChange={() => { sysOffset = 0; loadSystemLogs(); }}>
        <Select.Trigger class="w-32">{levelLabel}</Select.Trigger>
        <Select.Content>
          {#each levelOptions as o (o.value)}
            <Select.Item value={o.value}>{o.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <div class="relative flex-1 max-w-sm">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input bind:value={sysSearch} onkeyup={() => { sysOffset = 0; loadSystemLogs(); }} placeholder={t.common.search} class="pl-9" />
      </div>
      <span class="text-sm text-muted-foreground">{t.logs.total} {sysTotal}</span>
    </div>

    <Card.Root>
      <Card.Content class="pt-6">
        {#if sysLoading}
          <div class="text-center py-12 text-muted-foreground">{t.common.loading}</div>
        {:else if sysLogs.length === 0}
          <div class="text-center py-12 text-muted-foreground">{t.common.noResults}</div>
        {:else}
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>{t.logs.level}</Table.Head>
                <Table.Head>{t.logs.module}</Table.Head>
                <Table.Head>{t.logs.message}</Table.Head>
                <Table.Head>{t.logs.time}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each sysLogs as log, i (i)}
                <Table.Row class="cursor-pointer hover:bg-muted/50" onclick={() => openDetail(log)}>
                  <Table.Cell><Badge variant={getLevelBadge(log.level as string)}>{log.level as string}</Badge></Table.Cell>
                  <Table.Cell class="text-sm">{log.module as string}</Table.Cell>
                  <Table.Cell class="text-sm">{log.message as string}</Table.Cell>
                  <Table.Cell class="text-sm">{formatDate(log.createdAt as string)}</Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
          <div class="flex justify-between mt-4">
            <Button variant="outline" size="sm" disabled={sysOffset === 0} onclick={() => { sysOffset -= PAGE_SIZE; loadSystemLogs(); }}>{t.logs.prev}</Button>
            <Button variant="outline" size="sm" disabled={sysLogs.length < PAGE_SIZE} onclick={() => { sysOffset += PAGE_SIZE; loadSystemLogs(); }}>{t.logs.next}</Button>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  {:else if activeTab === 'scraping'}
    <div class="flex items-center gap-4 mb-4">
      <Select.Root type="single" bind:value={scrapeSource} onValueChange={() => { scrapeOffset = 0; loadScrapingLogs(); }}>
        <Select.Trigger class="w-40">{sourceOptions.find(o => o.value === scrapeSource)?.label || 'Усі джерела'}</Select.Trigger>
        <Select.Content>
          {#each sourceOptions as o (o.value)}
            <Select.Item value={o.value}>{o.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <Select.Root type="single" bind:value={scrapeStatus} onValueChange={() => { scrapeOffset = 0; loadScrapingLogs(); }}>
        <Select.Trigger class="w-32">{scrapeStatusOptions.find(o => o.value === scrapeStatus)?.label || 'Усі статуси'}</Select.Trigger>
        <Select.Content>
          {#each scrapeStatusOptions as o (o.value)}
            <Select.Item value={o.value}>{o.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <Button variant="outline" size="sm" onclick={loadScrapingLogs}>
        <RefreshCw class="size-4 mr-1" /> {t.logs.refresh}
      </Button>
      <span class="text-sm text-muted-foreground">{t.logs.total} {scrapeTotal}</span>
    </div>

    <Card.Root>
      <Card.Content class="pt-6">
        {#if scrapeLoading}
          <div class="text-center py-12 text-muted-foreground">{t.common.loading}</div>
        {:else if scrapeLogs.length === 0}
          <div class="text-center py-12 text-muted-foreground">{t.common.noResults}</div>
        {:else}
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>{t.logs.time}</Table.Head>
                <Table.Head>{t.logs.source}</Table.Head>
                <Table.Head>{t.logs.action}</Table.Head>
                <Table.Head>{t.logs.status}</Table.Head>
                <Table.Head>{t.logs.message}</Table.Head>
                <Table.Head>{t.logs.duration}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each scrapeLogs as log, i (i)}
                <Table.Row class="cursor-pointer hover:bg-muted/50" onclick={() => openDetail(log)}>
                  <Table.Cell class="text-sm">{formatDate(log.createdAt as string)}</Table.Cell>
                  <Table.Cell><Badge variant="outline">{log.source as string}</Badge></Table.Cell>
                  <Table.Cell class="text-sm">{log.action as string}</Table.Cell>
                  <Table.Cell>
                    <Badge variant={log.status === 'completed' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}>
                      {log.status as string}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell class="text-sm">{log.message as string || '—'}</Table.Cell>
                  <Table.Cell class="text-sm">{log.duration ? `${log.duration}ms` : '—'}</Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
          <div class="flex justify-between mt-4">
            <Button variant="outline" size="sm" disabled={scrapeOffset === 0} onclick={() => { scrapeOffset -= PAGE_SIZE; loadScrapingLogs(); }}>{t.logs.prev}</Button>
            <Button variant="outline" size="sm" disabled={scrapeLogs.length < PAGE_SIZE} onclick={() => { scrapeOffset += PAGE_SIZE; loadScrapingLogs(); }}>{t.logs.next}</Button>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  {/if}
</div>

<!-- Log Detail Dialog -->
<Dialog.Root bind:open={detailOpen}>
  <Dialog.Content class="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
    <Dialog.Header>
      <Dialog.Title class="flex items-center justify-between">
        <span>Деталі логу</span>
        <Button variant="ghost" size="sm" onclick={copyLog}>
          {#if copied}
            <Check class="size-4 mr-1" /> Скопійовано
          {:else}
            <Copy class="size-4 mr-1" /> Копіювати JSON
          {/if}
        </Button>
      </Dialog.Title>
    </Dialog.Header>
    <div class="flex-1 overflow-auto">
      {#if selectedLog}
        <!-- Key-value pairs -->
        <div class="space-y-3">
          {#each Object.entries(selectedLog) as [key, value] (key)}
            <div class="border rounded-lg p-3">
              <div class="text-xs font-medium text-muted-foreground uppercase mb-1">{key}</div>
              {#if value === null || value === undefined}
                <div class="text-sm text-muted-foreground">—</div>
              {:else if typeof value === 'object'}
                <pre class="text-sm whitespace-pre-wrap break-words font-mono bg-muted/50 p-2 rounded">{formatJson(value)}</pre>
              {:else}
                <div class="text-sm whitespace-pre-wrap break-words">{String(value)}</div>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Raw JSON -->
        <details class="mt-4">
          <summary class="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Сирий JSON</summary>
          <pre class="text-xs whitespace-pre-wrap break-words font-mono bg-muted/50 p-3 rounded mt-2 max-h-96 overflow-auto">{JSON.stringify(selectedLog, null, 2)}</pre>
        </details>
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>

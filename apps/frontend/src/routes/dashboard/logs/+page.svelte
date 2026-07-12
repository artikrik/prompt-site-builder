<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n/uk';
  import { api } from '$lib/api/client';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { RefreshCw, Search } from '@lucide/svelte';

  let activeTab = $state<'generation' | 'system'>('generation');

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
                <Table.Row>
                  <Table.Cell class="font-medium text-sm">{(job.project as any)?.slug || job.projectId as string}</Table.Cell>
                  <Table.Cell class="text-sm">{job.type as string}</Table.Cell>
                  <Table.Cell><Badge variant={getStatusBadge(job.status as string)}>{job.status as string}</Badge></Table.Cell>
                  <Table.Cell class="text-sm">{formatDate(job.createdAt as string)}</Table.Cell>
                  <Table.Cell class="text-sm text-red-600 max-w-48 truncate">{job.error as string || '—'}</Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        {/if}
      </Card.Content>
    </Card.Root>
  {:else}
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
                <Table.Row>
                  <Table.Cell><Badge variant={getLevelBadge(log.level as string)}>{log.level as string}</Badge></Table.Cell>
                  <Table.Cell class="text-sm">{log.module as string}</Table.Cell>
                  <Table.Cell class="text-sm max-w-96 truncate">{log.message as string}</Table.Cell>
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
  {/if}
</div>

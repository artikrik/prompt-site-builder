<script lang="ts">
  /* global console, alert, window */
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { projects, type Project } from '$lib/stores/projects';
  import { api } from '$lib/api/client.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { ArrowLeft, ExternalLink } from '@lucide/svelte';

  let project = $state<Project | null>(null);
  let isLoading = $state(true);
  let selectedTheme = $state('auto');
  let themes = $state<Array<{ name: string; description: string; category: string }>>([]);
  let themeLabel = $derived(
    selectedTheme === 'auto'
      ? 'AI Auto-Select'
      : themes.find((t) => t.name === selectedTheme)?.name ?? selectedTheme
  );

  onMount(async () => {
    try {
      project = await projects.fetchOne($page.params.id);
      const themeList = await api.get<any[]>('/generation/themes');
      themes = themeList;
    } catch (_e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load:', _e);
    } finally {
      isLoading = false;
    }
  });

  async function handleGenerate() {
    if (!project) return;
    try {
      await projects.generate(project.id, selectedTheme);
      project = await projects.fetchOne(project.id);
    } catch {
      alert('Failed to start generation');
    }
  }

  function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
      case 'PUBLISHED': return 'default';
      case 'GENERATING': return 'secondary';
      case 'FAILED': return 'destructive';
      default: return 'outline';
    }
  }
</script>

<svelte:head><title>Project Details - Prompt Site Builder</title></svelte:head>

<div class="space-y-6">
  <div>
    <Button variant="ghost" size="sm" onclick={() => goto(resolve('/dashboard/projects'))} class="mb-4">
      <ArrowLeft class="w-4 h-4 mr-2" />
      Back to Projects
    </Button>
  </div>

  {#if isLoading}
    <div class="text-center py-12 text-muted-foreground">Loading...</div>
  {:else if !project}
    <div class="text-center py-12 text-muted-foreground">Project not found</div>
  {:else}
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{project.lead?.businessName || project.slug}</h1>
        <p class="text-muted-foreground">{project.slug}.sitenow.pp.ua</p>
      </div>
      <div class="flex items-center gap-3">
        <Badge variant={getStatusVariant(project.status)}>{project.status}</Badge>
        {#if project.status === 'DRAFT'}
          <div class="flex items-center gap-2">
            <Select.Root type="single" bind:value={selectedTheme}>
              <Select.Trigger class="w-48">{themeLabel}</Select.Trigger>
              <Select.Content>
                <Select.Item value="auto">AI Auto-Select</Select.Item>
                {#each themes as theme (theme.name)}
                  <Select.Item value={theme.name}>{theme.name}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
            <Button onclick={handleGenerate}>Generate Site</Button>
          </div>
        {/if}
        {#if project.status === 'PUBLISHED' && project.publishedUrl}
          <Button onclick={() => window.open(project.publishedUrl, '_blank')}>
            <ExternalLink class="w-4 h-4 mr-2" />
            View Live Site
          </Button>
        {/if}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card.Root>
        <Card.Header>
          <Card.Title>Site Information</Card.Title>
        </Card.Header>
        <Card.Content>
          <dl class="space-y-3">
            <div class="flex justify-between"><dt class="text-muted-foreground">Domain</dt><dd>{project.slug}.sitenow.pp.ua</dd></div>
            <div class="flex justify-between"><dt class="text-muted-foreground">Status</dt><dd>{project.status}</dd></div>
            <div class="flex justify-between"><dt class="text-muted-foreground">Theme</dt><dd>{project.hugoConfig?.theme || 'hugo-theme-zen'}</dd></div>
            <div class="flex justify-between"><dt class="text-muted-foreground">Created</dt><dd>{new Date(project.createdAt).toLocaleString()}</dd></div>
            {#if project.publishedAt}
              <div class="flex justify-between"><dt class="text-muted-foreground">Published</dt><dd>{new Date(project.publishedAt).toLocaleString()}</dd></div>
            {/if}
          </dl>
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Card.Title>Hugo Configuration</Card.Title>
        </Card.Header>
        <Card.Content>
          <pre class="bg-muted p-4 rounded-md text-sm overflow-auto max-h-64">{JSON.stringify(project.hugoConfig, null, 2)}</pre>
        </Card.Content>
      </Card.Root>

      {#if project.status === 'PUBLISHED' && project.publishedUrl}
        <Card.Root class="lg:col-span-2">
          <Card.Header>
            <Card.Title>Site Preview</Card.Title>
          </Card.Header>
          <Card.Content>
            <iframe src={project.publishedUrl} class="w-full h-96 border border-border rounded-md" title="Site Preview"></iframe>
          </Card.Content>
        </Card.Root>
      {/if}
    </div>
  {/if}
</div>

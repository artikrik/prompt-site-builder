<script lang="ts">
  /* global console, alert, window */
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { projects, type Project } from '$lib/stores/projects';
  import { variants, type VariantListItem } from '$lib/stores/variants';
  import { api } from '$lib/api/client.js';
  import { t } from '$lib/i18n/uk';
  import VariantList from '$lib/components/variants/VariantList.svelte';
  import VariantGenerator from '$lib/components/variants/VariantGenerator.svelte';
  import AddonList from '$lib/components/addons/AddonList.svelte';
  import { addons, type ProjectAddon, type AddonType } from '$lib/stores/addons';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { ArrowLeft, ExternalLink } from '@lucide/svelte';

  let project = $state<Project | null>(null);
  let isLoading = $state(true);
  let selectedTheme = $state('auto');
  let themes = $state<Array<{ name: string; description: string; category: string }>>([]);
  let projectVariants = $state<VariantListItem[]>([]);
  let variantsLoading = $state(false);
  let activeVariantId = $state<string | null>(null);
  let projectAddons = $state<ProjectAddon[]>([]);
  let addonsLoading = $state(false);
  let showAdvancedGenerator = $state(false);
  let isGenerating = $state(false);

  let themeLabel = $derived(
    selectedTheme === 'auto'
      ? 'AI Auto-Select'
      : themes.find((t) => t.name === selectedTheme)?.name ?? selectedTheme
  );

  onMount(async () => {
    try {
      project = await projects.fetchOne($page.params.id!);
      activeVariantId = (project as any).activeVariantId || null;
      const themeList = await api.get<any[]>('/generation/themes');
      themes = themeList;
      await Promise.all([loadVariants(), loadAddons()]);
    } catch (_e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load:', _e);
    } finally {
      isLoading = false;
    }
  });

  async function loadVariants() {
    if (!project) return;
    variantsLoading = true;
    projectVariants = await variants.fetchForProject(project.id);
    variantsLoading = false;
  }

  async function loadAddons() {
    if (!project) return;
    addonsLoading = true;
    projectAddons = await addons.fetchForProject(project.id);
    addonsLoading = false;
  }

  async function handleActivateAddon(addonType: AddonType) {
    if (!project) return;
    try {
      await addons.activate(project.id, addonType);
      projectAddons = await addons.fetchForProject(project.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to activate add-on');
    }
  }

  async function handleDeactivateAddon(addonType: AddonType) {
    if (!project) return;
    if (!window.confirm(`Deactivate ${addonType}? This will stop monthly billing.`)) return;
    try {
      await addons.deactivate(project.id, addonType);
      projectAddons = await addons.fetchForProject(project.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to deactivate add-on');
    }
  }

  async function handleConfigureAddon(_addonType: AddonType) {
    // Configure modal not yet implemented in template
  }

  async function handleVariantGenerate(config: { model: string; imageModel: string; theme: string }) {
    if (!project) return;
    isGenerating = true;
    try {
      // Pass model/imageModel via the API call
      await api.post(`/generation/${project.id}/generate`, {
        theme: config.theme || 'auto',
        model: config.model,
        imageModel: config.imageModel,
      });
      project = await projects.fetchOne(project.id);
      activeVariantId = (project as any).activeVariantId || null;
      await loadVariants();
    } catch {
      alert('Failed to generate variant');
    } finally {
      isGenerating = false;
    }
  }

  async function handleGenerate() {
    if (!project) return;
    try {
      await projects.generate(project.id, selectedTheme);
      project = await projects.fetchOne(project.id);
      activeVariantId = (project as any).activeVariantId || null;
      await loadVariants();
    } catch {
      alert('Failed to start generation');
    }
  }

  async function handleActivate(variantId: string) {
    try {
      await variants.activate(variantId);
      activeVariantId = variantId;
      projectVariants = projectVariants.map((v) => ({
        ...v,
        status: v.id === variantId ? 'PUBLISHED' : (v.status === 'PUBLISHED' ? 'GENERATED' : v.status),
      }));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to activate variant');
    }
  }

  async function handleDelete(variantId: string) {
    if (!project) return;
    try {
      await variants.remove(variantId, project.id);
      projectVariants = projectVariants.filter((v) => v.id !== variantId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete variant');
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

<svelte:head><title>{project?.lead?.businessName || t.projects.title} - {t.app.name}</title></svelte:head>

<div class="space-y-6">
  <div>
    <Button variant="ghost" size="sm" onclick={() => goto(resolve('/dashboard/projects'))} class="mb-4">
      <ArrowLeft class="w-4 h-4 mr-2" />
      {t.common.back}
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
        {#if project.status === 'DRAFT' || project.status === 'PUBLISHED' || project.status === 'GENERATED'}
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
            <Button variant="outline" size="sm" onclick={() => showAdvancedGenerator = !showAdvancedGenerator}>
              {showAdvancedGenerator ? 'Hide Advanced' : 'Advanced'}
            </Button>
          </div>
        {/if}
        {#if project.status === 'PUBLISHED' && project.publishedUrl}
          <Button onclick={() => window.open(project!.publishedUrl!, '_blank')}>
            <ExternalLink class="w-4 h-4 mr-2" />
            {t.projects.viewSite}
          </Button>
        {/if}
      </div>
    </div>

    {#if showAdvancedGenerator}
      <div class="mt-4">
        <VariantGenerator
          models={['gpt-4o', 'gpt-4-turbo', 'claude-sonnet-4-20250514', 'deepseek-v4-pro', 'gemini-2.5-pro']}
          imageModels={['dall-e-3', 'imagen-3', 'flux-pro']}
          themes={themes.map((t) => ({ name: t.name, label: t.name }))}
          generating={isGenerating}
          onGenerate={handleVariantGenerate}
        />
      </div>
    {/if}

    <!-- Variants Section -->
    <section>
      <VariantList
        variants={projectVariants}
        {activeVariantId}
        onActivate={handleActivate}
        onDelete={handleDelete}
        isLoading={variantsLoading}
      />
    </section>

    <!-- Add-ons Section -->
    <section class="mt-6">
      <h2 class="text-xl font-semibold mb-4">Add-on Services</h2>
      <AddonList
        projectId={project.id}
        addons={projectAddons}
        isLoading={addonsLoading}
        onActivate={handleActivateAddon}
        onDeactivate={handleDeactivateAddon}
        onConfigure={handleConfigureAddon}
      />
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <Card.Root>
        <Card.Header>
          <Card.Title>Site Information</Card.Title>
        </Card.Header>
        <Card.Content>
          <dl class="space-y-3">
            <div class="flex justify-between"><dt class="text-muted-foreground">Domain</dt><dd>{project.slug}.sitenow.pp.ua</dd></div>
            <div class="flex justify-between"><dt class="text-muted-foreground">Status</dt><dd>{project.status}</dd></div>
            <div class="flex justify-between"><dt class="text-muted-foreground">Theme</dt><dd>{project.hugoConfig?.theme || 'hugo-theme-zen'}</dd></div>
            <div class="flex justify-between"><dt class="text-muted-foreground">Active Variant</dt><dd>{activeVariantId ? activeVariantId.slice(0, 8) + '...' : 'None'}</dd></div>
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
            <Button onclick={() => window.open(project!.publishedUrl!, '_blank')}>
            <ExternalLink class="w-4 h-4 mr-2" /> {t.projects.viewSite}
          </Button>
          </Card.Content>
        </Card.Root>
      {/if}
    </div>
  {/if}
</div>

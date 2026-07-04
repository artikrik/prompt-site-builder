<script lang="ts">
  import { onMount } from 'svelte';
  import { projects } from '$lib/stores/projects';
  import { goto } from '$app/navigation';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import { ExternalLink, Eye } from '@lucide/svelte';

  onMount(() => { projects.fetchAll(); });

  function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
      case 'PUBLISHED': return 'default';
      case 'GENERATING': return 'secondary';
      case 'FAILED': return 'destructive';
      default: return 'outline';
    }
  }

  async function handleGenerate(projectId: string) {
    try { await projects.generate(projectId); } catch { alert('Failed to start generation'); }
  }
</script>

<svelte:head><title>Projects - Prompt Site Builder</title></svelte:head>

<div class="space-y-6">
  <h1 class="text-2xl font-bold tracking-tight">Projects</h1>

  <Card.Root>
    <Card.Content class="pt-6">
      {#if $projects.isLoading}
        <div class="text-center py-12 text-muted-foreground">Loading...</div>
      {:else if $projects.projects.length === 0}
        <div class="text-center py-12 text-muted-foreground">No projects yet. Go to Leads to create your first project.</div>
      {:else}
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Project</Table.Head>
              <Table.Head>Domain</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Created</Table.Head>
              <Table.Head class="text-right">Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each $projects.projects as project}
              <Table.Row>
                <Table.Cell>
                  <div class="font-medium">{project.lead?.businessName || project.slug}</div>
                  <div class="text-sm text-muted-foreground">{project.lead?.category || 'N/A'}</div>
                </Table.Cell>
                <Table.Cell class="text-sm">{project.slug}.sitenow.pp.ua</Table.Cell>
                <Table.Cell>
                  <Badge variant={getStatusVariant(project.status)}>{project.status}</Badge>
                </Table.Cell>
                <Table.Cell class="text-sm">{new Date(project.createdAt).toLocaleDateString()}</Table.Cell>
                <Table.Cell class="text-right space-x-2">
                  {#if project.status === 'DRAFT'}
                    <Button variant="ghost" size="sm" onclick={() => handleGenerate(project.id)}>Generate</Button>
                  {/if}
                  {#if project.status === 'PUBLISHED' && project.publishedUrl}
                    <Button variant="ghost" size="sm" onclick={() => window.open(project.publishedUrl, '_blank')}>
                      <ExternalLink class="size-4 mr-1" />
                      View Site
                    </Button>
                  {/if}
                  <Button variant="ghost" size="sm" onclick={() => goto(`/dashboard/projects/${project.id}`)}>
                    <Eye class="size-4" />
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

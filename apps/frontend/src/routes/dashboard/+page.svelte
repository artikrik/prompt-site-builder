/* global console, window, alert, document */
<script lang="ts">
  import { onMount } from 'svelte';
  import { leads } from '$lib/stores/leads';
  import { projects } from '$lib/stores/projects';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Users, AlertTriangle, FolderOpen, CheckCircle } from '@lucide/svelte';

  let stats = $state({
    totalLeads: 0,
    newLeads: 0,
    activeProjects: 0,
    publishedSites: 0,
  });

  onMount(async () => {
    await Promise.all([leads.fetchAll(), projects.fetchAll()]);
    stats = {
      totalLeads: $leads.leads.length,
      newLeads: $leads.leads.filter((l) => l.status === 'NEW').length,
      activeProjects: $projects.projects.filter((p) => ['DRAFT', 'GENERATING'].includes(p.status)).length,
      publishedSites: $projects.projects.filter((p) => p.status === 'PUBLISHED').length,
    };
  });
</script>

<svelte:head>
  <title>Dashboard - Prompt Site Builder</title>
</svelte:head>

<div class="space-y-6">
  <h1 class="text-2xl font-bold tracking-tight">Dashboard Overview</h1>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <Card.Root>
      <Card.Header class="flex flex-row items-center justify-between pb-2">
        <Card.Title class="text-sm font-medium text-muted-foreground">Total Leads</Card.Title>
        <Users class="w-4 h-4 text-muted-foreground" />
      </Card.Header>
      <Card.Content>
        <div class="text-2xl font-bold">{stats.totalLeads}</div>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header class="flex flex-row items-center justify-between pb-2">
        <Card.Title class="text-sm font-medium text-muted-foreground">New Leads</Card.Title>
        <AlertTriangle class="w-4 h-4 text-muted-foreground" />
      </Card.Header>
      <Card.Content>
        <div class="text-2xl font-bold text-yellow-600">{stats.newLeads}</div>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header class="flex flex-row items-center justify-between pb-2">
        <Card.Title class="text-sm font-medium text-muted-foreground">Active Projects</Card.Title>
        <FolderOpen class="w-4 h-4 text-muted-foreground" />
      </Card.Header>
      <Card.Content>
        <div class="text-2xl font-bold text-blue-600">{stats.activeProjects}</div>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header class="flex flex-row items-center justify-between pb-2">
        <Card.Title class="text-sm font-medium text-muted-foreground">Published Sites</Card.Title>
        <CheckCircle class="w-4 h-4 text-muted-foreground" />
      </Card.Header>
      <Card.Content>
        <div class="text-2xl font-bold text-green-600">{stats.publishedSites}</div>
      </Card.Content>
    </Card.Root>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>Recent Projects</Card.Title>
    </Card.Header>
    <Card.Content>
      {#if $projects.projects.length === 0}
        <p class="text-muted-foreground text-center py-8">No projects yet. Create your first project from the Leads page.</p>
      {:else}
        <div class="space-y-4">
          {#each $projects.projects.slice(0, 5) as project (project.id)}
            <div class="flex items-center justify-between p-4 border border-border rounded-lg">
              <div>
                <p class="font-medium">{project.lead?.businessName || project.slug}</p>
                <p class="text-sm text-muted-foreground">{project.slug}.sitenow.pp.ua</p>
              </div>
              <div class="flex items-center gap-3">
                <Badge variant={project.status === 'PUBLISHED' ? 'default' : project.status === 'GENERATING' ? 'secondary' : 'outline'}>
                  {project.status}
                </Badge>
                {#if project.publishedUrl}
                  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
                  <a href={project.publishedUrl ?? '#'} target="_blank" rel="noopener noreferrer" class="text-sm text-primary underline">View Site</a>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

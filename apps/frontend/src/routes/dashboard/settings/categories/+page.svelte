<script lang="ts">
  import { t } from '$lib/i18n/uk';
  import { BUSINESS_CATEGORIES, type CategoryWithTheme } from '$lib/i18n/categories';
  import { api } from '$lib/api/client';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { Pencil } from '@lucide/svelte';

  let categories = $state<CategoryWithTheme[]>(BUSINESS_CATEGORIES);
  let editingCategory = $state<string | null>(null);
  let showEditor = $state(false);
  let contentPrompt = $state('');
  let designPrompt = $state('');
  let competitorPrompt = $state('');
  let isLoadingPrompts = $state(false);

  async function openEditor(category: string) {
    editingCategory = category;
    showEditor = true;
    isLoadingPrompts = true;
    try {
      const prompts = await api.get<{ contentPrompt: string; designPrompt: string; competitorPrompt: string }>(
        `/categories/${encodeURIComponent(category)}/prompts`
      );
      contentPrompt = prompts.contentPrompt;
      designPrompt = prompts.designPrompt;
      competitorPrompt = prompts.competitorPrompt;
    } catch { /* use defaults */ }
    isLoadingPrompts = false;
  }

  async function handleSave() {
    if (!editingCategory) return;
    await api.put(`/categories/${encodeURIComponent(editingCategory)}/prompts`, {
      contentPrompt,
      designPrompt,
      competitorPrompt,
    });
    showEditor = false;
    editingCategory = null;
  }
</script>

<svelte:head><title>{t.categories.title} - {t.app.name}</title></svelte:head>

<div class="space-y-6">
  <h1 class="text-2xl font-bold tracking-tight">{t.categories.title}</h1>

  <Card.Root>
    <Card.Content class="pt-6">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>{t.leads.category}</Table.Head>
            <Table.Head>{t.categories.theme}</Table.Head>
            <Table.Head class="text-right">{t.common.actions}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each categories as cat (cat.category)}
            <Table.Row>
              <Table.Cell class="font-medium">{cat.category}</Table.Cell>
              <Table.Cell><Badge variant="outline">{cat.theme}</Badge></Table.Cell>
              <Table.Cell class="text-right">
                <Button variant="ghost" size="sm" onclick={() => openEditor(cat.category)}>
                  <Pencil class="size-3 mr-1" /> {t.common.edit}
                </Button>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </Card.Content>
  </Card.Root>

  <Dialog.Root bind:open={showEditor}>
    <Dialog.Content class="max-w-2xl">
      <Dialog.Header>
        <Dialog.Title>{t.categories.editPrompts}: {editingCategory}</Dialog.Title>
      </Dialog.Header>
      {#if isLoadingPrompts}
        <div class="py-8 text-center text-muted-foreground">{t.common.loading}</div>
      {:else}
        <div class="space-y-4">
          <div class="space-y-2">
            <label for="contentPrompt" class="text-sm font-medium">{t.categories.contentPrompt}</label>
            <textarea id="contentPrompt" bind:value={contentPrompt} rows={6}
              class="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"></textarea>
          </div>
          <div class="space-y-2">
            <label for="designPrompt" class="text-sm font-medium">{t.categories.designPrompt}</label>
            <textarea id="designPrompt" bind:value={designPrompt} rows={4}
              class="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"></textarea>
          </div>
          <div class="space-y-2">
            <label for="competitorPrompt" class="text-sm font-medium">{t.categories.competitorPrompt}</label>
            <textarea id="competitorPrompt" bind:value={competitorPrompt} rows={6}
              class="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"></textarea>
          </div>
        </div>
      {/if}
      <Dialog.Footer>
        <Button variant="outline" onclick={() => { showEditor = false; }}>{t.common.cancel}</Button>
        <Button onclick={handleSave}>{t.common.save}</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
</div>

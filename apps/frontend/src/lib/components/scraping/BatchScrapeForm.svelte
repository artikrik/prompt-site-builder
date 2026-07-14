<script lang="ts">
  /* eslint-disable no-undef */
  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import Card from '$lib/components/ui/card/card.svelte';
  import CardHeader from '$lib/components/ui/card/card-header.svelte';
  import CardTitle from '$lib/components/ui/card/card-title.svelte';
  import CardContent from '$lib/components/ui/card/card-content.svelte';
  import { api } from '$lib/api/client';

  interface ScrapeItem {
    city: string;
    category: string;
    limit: number;
  }

  let items: ScrapeItem[] = $state([{ city: '', category: '', limit: 20 }]);
  let isSubmitting = $state(false);
  let result = $state<{ jobs: Array<{ jobId: string; city: string; category: string }> } | null>(null);
  let error = $state('');

  function addItem() {
    items = [...items, { city: '', category: '', limit: 20 }];
  }

  function removeItem(index: number) {
    items = items.filter((_, i) => i !== index);
  }

  async function handleSubmit() {
    const validItems = items.filter((i) => i.city && i.category);
    if (validItems.length === 0) return;

    isSubmitting = true;
    error = '';
    try {
      result = await api.post<{ jobs: Array<{ jobId: string; city: string; category: string }> }>('/scraping/batch', { items: validItems });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Batch scrape failed';
      console.error('Batch scrape failed:', e);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<Card>
  <CardHeader>
    <CardTitle>Масовий збір лідів</CardTitle>
  </CardHeader>
  <CardContent>
    <form onsubmit={handleSubmit} class="space-y-4">
      {#each items as item, index (index)}
        <div class="flex gap-2 items-end">
          <div class="flex-1">
            <Label for="city-{index}">Місто</Label>
            <Input id="city-{index}" bind:value={item.city} placeholder="Київ" />
          </div>
          <div class="flex-1">
            <Label for="category-{index}">Категорія</Label>
            <Input id="category-{index}" bind:value={item.category} placeholder="салон краси" />
          </div>
          <div class="w-24">
            <Label for="limit-{index}">Кількість</Label>
            <Input id="limit-{index}" type="number" bind:value={item.limit} min="1" max="50" />
          </div>
          {#if items.length > 1}
            <Button type="button" variant="outline" onclick={() => removeItem(index)}>
              Видалити
            </Button>
          {/if}
        </div>
      {/each}

      <div class="flex gap-2">
        <Button type="button" variant="outline" onclick={addItem}>
          + Додати рядок
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Запуск...' : 'Запустити збір'}
        </Button>
      </div>
    </form>

    {#if error}
      <div class="mt-4 p-4 bg-red-50 dark:bg-red-950 rounded">
        <p class="text-sm text-red-600">{error}</p>
      </div>
    {/if}

    {#if result}
      <div class="mt-4 p-4 bg-green-50 dark:bg-green-950 rounded">
        <p class="font-medium">Запущено {result.jobs.length} завдань:</p>
        <ul class="list-disc pl-4 mt-2">
          {#each result.jobs as job (job.jobId)}
            <li>{job.city} / {job.category} (ID: {job.jobId})</li>
          {/each}
        </ul>
      </div>
    {/if}
  </CardContent>
</Card>

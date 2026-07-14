<script lang="ts">
  /* eslint-disable no-undef */
  import { onMount } from 'svelte';
  import Card from '$lib/components/ui/card/card.svelte';
  import CardHeader from '$lib/components/ui/card/card-header.svelte';
  import CardTitle from '$lib/components/ui/card/card-title.svelte';
  import CardContent from '$lib/components/ui/card/card-content.svelte';
  import Badge from '$lib/components/ui/badge/badge.svelte';

  interface Template {
    name: string;
    category: string;
    description: string;
  }

  let templates = $state<Template[]>([]);
  let selectedCategory = $state<string>('');
  let isLoading = $state(true);
  let selectedTemplate = $state<Template | null>(null);

  const categories = [
    { value: '', label: 'Всі категорії' },
    { value: 'medical', label: 'Медицина' },
    { value: 'salon', label: 'Салони краси' },
    { value: 'construction', label: 'Будівництво' },
    { value: 'auto', label: 'Автосервіс' },
  ];

  onMount(async () => {
    await loadTemplates();
  });

  async function loadTemplates() {
    isLoading = true;
    try {
      const params = selectedCategory ? `?category=${selectedCategory}` : '';
      const response = await fetch(`/api/templates${params}`);
      templates = await response.json();
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      isLoading = false;
    }
  }

  function selectTemplate(template: Template) {
    selectedTemplate = template;
  }

  function getCategoryLabel(category: string): string {
    return categories.find((c) => c.value === category)?.label || category;
  }
</script>

<Card>
  <CardHeader>
    <CardTitle>Шаблони сайтів</CardTitle>
  </CardHeader>
  <CardContent>
    <div class="mb-4">
      <select
        bind:value={selectedCategory}
        onchange={loadTemplates}
        class="w-full p-2 border rounded"
      >
        {#each categories as cat (cat.value)}
          <option value={cat.value}>{cat.label}</option>
        {/each}
      </select>
    </div>

    {#if isLoading}
      <div class="text-center py-8 text-muted-foreground">Завантаження...</div>
    {:else if templates.length === 0}
      <div class="text-center py-8 text-muted-foreground">Шаблонів не знайдено</div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each templates as template (template.name)}
          <Card
            class="cursor-pointer hover:border-primary transition-colors
                   {selectedTemplate?.name === template.name ? 'border-primary' : ''}"
            onclick={() => selectTemplate(template)}
          >
            <CardContent class="p-4">
              <div class="flex justify-between items-start mb-2">
                <h3 class="font-medium">{template.name}</h3>
                <Badge variant="secondary">{getCategoryLabel(template.category)}</Badge>
              </div>
              <p class="text-sm text-muted-foreground">{template.description}</p>
            </CardContent>
          </Card>
        {/each}
      </div>
    {/if}

    {#if selectedTemplate}
      <div class="mt-4 p-4 bg-muted rounded">
        <p class="font-medium">Вибрано: {selectedTemplate.name}</p>
        <p class="text-sm text-muted-foreground">{selectedTemplate.description}</p>
      </div>
    {/if}
  </CardContent>
</Card>

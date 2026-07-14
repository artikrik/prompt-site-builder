<script lang="ts">
  /* eslint-disable no-undef */
  import { onMount } from 'svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import Card from '$lib/components/ui/card/card.svelte';
  import CardHeader from '$lib/components/ui/card/card-header.svelte';
  import CardTitle from '$lib/components/ui/card/card-title.svelte';
  import CardContent from '$lib/components/ui/card/card-content.svelte';

  interface EditableSection {
    id: string;
    name: string;
    type: 'text' | 'richtext' | 'image' | 'list' | 'contact';
    content: Record<string, unknown>;
  }

  let { projectId }: { projectId: string } = $props();

  let sections = $state<EditableSection[]>([]);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let isRegenerating = $state(false);
  let activeSection = $state<string | null>(null);

  onMount(async () => {
    await loadSections();
  });

  async function loadSections() {
    isLoading = true;
    try {
      const response = await fetch(`/api/projects/${projectId}/editor`);
      sections = await response.json();
      if (sections.length > 0) {
        activeSection = sections[0].id;
      }
    } catch (error) {
      console.error('Failed to load sections:', error);
    } finally {
      isLoading = false;
    }
  }

  async function saveSection(section: EditableSection) {
    isSaving = true;
    try {
      await fetch(`/api/projects/${projectId}/editor/${section.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(section.content),
      });
    } catch (error) {
      console.error('Failed to save section:', error);
    } finally {
      isSaving = false;
    }
  }

  async function regenerateSite() {
    isRegenerating = true;
    try {
      await fetch(`/api/projects/${projectId}/editor/regenerate`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to regenerate site:', error);
    } finally {
      isRegenerating = false;
    }
  }

  function getSectionIcon(type: string): string {
    switch (type) {
      case 'text': return '📝';
      case 'richtext': return '📄';
      case 'image': return '🖼️';
      case 'list': return '📋';
      case 'contact': return '📞';
      default: return '📌';
    }
  }
</script>

<Card>
  <CardHeader>
    <CardTitle class="flex justify-between items-center">
      <span>Редактор сайту</span>
      <Button onclick={regenerateSite} disabled={isRegenerating}>
        {isRegenerating ? 'Перегенерація...' : 'Перегенерувати сайт'}
      </Button>
    </CardTitle>
  </CardHeader>
  <CardContent>
    {#if isLoading}
      <div class="text-center py-8 text-muted-foreground">Завантаження секцій...</div>
    {:else if sections.length === 0}
      <div class="text-center py-8 text-muted-foreground">Немає секцій для редагування</div>
    {:else}
      <div class="flex gap-4">
        <!-- Section list -->
        <div class="w-48 space-y-2">
          {#each sections as section (section.id)}
            <button
              class="w-full text-left p-2 rounded hover:bg-muted transition-colors
                     {activeSection === section.id ? 'bg-muted font-medium' : ''}"
              onclick={() => activeSection = section.id}
            >
              {getSectionIcon(section.type)} {section.name}
            </button>
          {/each}
        </div>

        <!-- Section editor -->
        <div class="flex-1">
          {#if activeSection}
            {@const section = sections.find((s) => s.id === activeSection)}
            {#if section}
              <div class="space-y-4">
                <h3 class="font-medium">{section.name}</h3>

                {#if section.id === 'hero'}
                  <div class="space-y-2">
                    <Label for="hero-title">Заголовок</Label>
                    <Input id="hero-title" bind:value={section.content.title} />
                    
                    <Label for="hero-subtitle">Підзаголовок</Label>
                    <Input id="hero-subtitle" bind:value={section.content.subtitle} />
                    
                    <Label for="hero-cta">Текст кнопки</Label>
                    <Input id="hero-cta" bind:value={section.content.ctaText} />
                  </div>

                {:else if section.id === 'about'}
                  <div class="space-y-2">
                    <Label for="about-content">Текст "Про нас"</Label>
                    <textarea
                      id="about-content"
                      bind:value={section.content.content}
                      rows="6"
                      class="w-full p-2 border rounded"
                    ></textarea>
                  </div>

                {:else if section.id === 'contact'}
                  <div class="space-y-2">
                    <Label for="contact-phone">Телефон</Label>
                    <Input id="contact-phone" bind:value={section.content.phone} />
                    
                    <Label for="contact-email">Email</Label>
                    <Input id="contact-email" bind:value={section.content.email} />
                    
                    <Label for="contact-address">Адреса</Label>
                    <Input id="contact-address" bind:value={section.content.address} />
                  </div>

                {:else}
                  <p class="text-muted-foreground">Редагування цієї секції поки не підтримується</p>
                {/if}

                <Button onclick={() => saveSection(section)} disabled={isSaving}>
                  {isSaving ? 'Збереження...' : 'Зберегти'}
                </Button>
              </div>
            {/if}
          {/if}
        </div>
      </div>
    {/if}
  </CardContent>
</Card>

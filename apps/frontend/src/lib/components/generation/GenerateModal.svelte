<script lang="ts">
  import { api } from '$lib/api/client';
  import ModelSelector from '$lib/components/settings/ModelSelector.svelte';
  import type { Lead, ContentModel, ImageModel } from '@prompt-site-builder/shared';

  interface Props {
    open: boolean;
    lead: Lead;
    projectId: string;
    defaultContentProvider: string;
    defaultContentModel: string;
    defaultImageProvider: string;
    defaultImageModel: string;
    models: { content: ContentModel[]; image: ImageModel[] };
    onClose: () => void;
  }

  let {
    open, lead, projectId,
    defaultContentProvider, defaultContentModel,
    defaultImageProvider, defaultImageModel,
    models, onClose,
  }: Props = $props();

  let contentProvider = $state(defaultContentProvider);
  let contentModel = $state(defaultContentModel);
  let imageProvider = $state(defaultImageProvider);
  let imageModel = $state(defaultImageModel);
  let isGenerating = $state(false);

  async function generate() {
    isGenerating = true;
    await api.post('/generation/generate', {
      projectId,
      leadId: lead.id,
      model: contentModel,
      imageModel,
    });
    onClose();
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={onClose}>
    <div class="w-full max-w-lg rounded-lg bg-white p-6 space-y-4" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-lg font-bold">Generate Site</h2>

      <!-- AI Models -->
      <ModelSelector
        type="content"
        provider={contentProvider}
        model={contentModel}
        models={models.content}
        onProviderChange={(p: string) => { contentProvider = p; contentModel = models.content.find((m: ContentModel | ImageModel) => m.provider === p)?.id ?? ''; }}
        onModelChange={(m: string) => (contentModel = m)}
      />
      <ModelSelector
        type="image"
        provider={imageProvider}
        model={imageModel}
        models={models.image}
        onProviderChange={(p: string) => { imageProvider = p; imageModel = models.image.find((m: ContentModel | ImageModel) => m.provider === p)?.id ?? ''; }}
        onModelChange={(m: string) => (imageModel = m)}
      />

      <!-- Site Services (read-only from lead) -->
      <div>
        <h3 class="text-sm font-medium mb-2">Site Services</h3>
        <div class="grid gap-2 text-sm">
          <div class="flex justify-between">
            <span>EasyWeek (Booking)</span>
            <span class={lead.easyweekEnabled ? 'text-green-600' : 'text-muted-foreground'}>
              {lead.easyweekEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div class="flex justify-between">
            <span>WayForPay (Payment)</span>
            <span class={lead.wayforpayEnabled ? 'text-green-600' : 'text-muted-foreground'}>
              {lead.wayforpayEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div class="flex justify-between">
            <span>Monobank (Payment)</span>
            <span class={lead.monobankEnabled ? 'text-green-600' : 'text-muted-foreground'}>
              {lead.monobankEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <button onclick={onClose} class="rounded-md border px-4 py-2 text-sm">Cancel</button>
        <button onclick={generate} disabled={isGenerating} class="rounded-md bg-primary px-4 py-2 text-sm text-white">
          {isGenerating ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </div>
  </div>
{/if}

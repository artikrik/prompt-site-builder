<script lang="ts">
  import { enrichment } from '$lib/stores/enrichment';
  import { cn } from '$lib/utils';

  interface Props {
    leadId: string;
    sources: string[];
    class?: string;
  }

  let { leadId, sources, class: className = '' }: Props = $props();
  let isEnriching = $state(false);
  let message = $state('');

  async function handleEnrich() {
    isEnriching = true;
    message = '';
    try {
      const result = await enrichment.enrichLead(leadId);
      if (result) {
        message = 'Enrichment started';
        // Poll for completion
        // eslint-disable-next-line no-undef
        setTimeout(() => enrichment.fetchForLead(leadId), 3000);
      }
    } catch {
      message = 'Failed to start enrichment';
    } finally {
      isEnriching = false;
    }
  }
</script>

<div class={cn('flex items-center gap-2', className)}>
  <button
    onclick={handleEnrich}
    disabled={isEnriching || sources.length === 0}
    class="rounded-md bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-50"
  >
    {isEnriching ? 'Enriching...' : 'Enrich from socials'}
  </button>
  {#if message}
    <span class="text-sm text-muted-foreground">{message}</span>
  {/if}
</div>

<script lang="ts">
  import type { SalesOpportunity } from '@prompt-site-builder/shared';

  let { opportunity }: { opportunity: SalesOpportunity } = $props();
</script>

<div class="opportunity-card rounded-lg border p-4 space-y-3">
  <div>
    <span class="text-xs font-medium text-red-500 uppercase">Gap</span>
    <p class="font-semibold">{opportunity.gap}</p>
  </div>

  <div class="grid grid-cols-2 gap-3 text-sm">
    <div class="bg-muted rounded p-2">
      <span class="text-xs text-muted-foreground">Current State</span>
      <p>{opportunity.currentState}</p>
    </div>
    <div class="bg-primary/10 rounded p-2">
      <span class="text-xs text-muted-foreground">Recommendation</span>
      <p>{opportunity.recommendation}</p>
    </div>
  </div>

  <div class="bg-yellow-50 dark:bg-yellow-950 rounded p-3 border border-yellow-200">
    <span class="text-xs font-medium">Pitch Angle</span>
    <p class="text-sm italic">"{opportunity.pitchAngle}"</p>
  </div>

  <div class="flex items-center gap-2">
    <span class="text-xs text-muted-foreground">Revenue Impact:</span>
    <span class="text-lg font-bold text-green-600">{opportunity.revenueImpact}</span>
  </div>

  {#if opportunity.scriptExcerpt}
    <details class="text-sm">
      <summary class="cursor-pointer text-muted-foreground">Script Excerpt</summary>
      <p class="mt-2 p-2 bg-muted rounded whitespace-pre-wrap">{opportunity.scriptExcerpt}</p>
    </details>
  {/if}
</div>

<script lang="ts">
  import type { CompetitorInfo } from '@prompt-site-builder/shared';
  import { Badge } from '$lib/components/ui/badge';

  let { competitor }: { competitor: CompetitorInfo } = $props();
</script>

<div class="competitor-card rounded-lg border p-4 space-y-3">
  <div class="flex items-center justify-between">
    <div>
      <h4 class="font-semibold">{competitor.name}</h4>
      {#if competitor.rating}
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <span>★ {competitor.rating}</span>
          <span>({competitor.reviewCount} reviews)</span>
          {#if competitor.distance}<span>{competitor.distance}</span>{/if}
        </div>
      {/if}
    </div>
    {#if competitor.website}
      <button onclick={() => globalThis.open(competitor.website, '_blank', 'noopener noreferrer')} class="text-sm text-primary hover:underline">Website ↗</button>
    {/if}
  </div>

  {#if competitor.websiteAnalysis}
    <div class="grid grid-cols-2 gap-2 text-sm">
      <div class="flex items-center gap-1">
        {#if competitor.websiteAnalysis.hasOnlineBooking}<span class="text-green-500">✓</span>{:else}<span class="text-red-500">✗</span>{/if}
        <span>Online Booking</span>
      </div>
      <div class="flex items-center gap-1">
        {#if competitor.websiteAnalysis.hasPriceList}<span class="text-green-500">✓</span>{:else}<span class="text-red-500">✗</span>{/if}
        <span>Price List</span>
      </div>
      <div class="flex items-center gap-1">
        {#if competitor.websiteAnalysis.hasPortfolio}<span class="text-green-500">✓</span>{:else}<span class="text-red-500">✗</span>{/if}
        <span>Portfolio</span>
      </div>
      <div class="flex items-center gap-1">
        {#if competitor.websiteAnalysis.hasReviews}<span class="text-green-500">✓</span>{:else}<span class="text-red-500">✗</span>{/if}
        <span>Reviews</span>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      {#if competitor.websiteAnalysis.strengths?.length}
        <div>
          <span class="text-xs font-medium text-green-600">Strengths</span>
          <ul class="text-sm list-disc pl-4">
            {#each competitor.websiteAnalysis.strengths as s (s)}<li>{s}</li>{/each}
          </ul>
        </div>
      {/if}
      {#if competitor.websiteAnalysis.weaknesses?.length}
        <div>
          <span class="text-xs font-medium text-red-600">Weaknesses</span>
          <ul class="text-sm list-disc pl-4">
            {#each competitor.websiteAnalysis.weaknesses as w (w)}<li>{w}</li>{/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}

  {#if competitor.services?.length}
    <div class="flex flex-wrap gap-2">
      {#each competitor.services as service (service.name)}
        <Badge variant="outline">{service.name}{#if service.price} — {service.price}{/if}</Badge>
      {/each}
    </div>
  {/if}

  {#if competitor.positioning}
    <p class="text-sm italic text-muted-foreground">"{competitor.positioning}"</p>
  {/if}

  {#if competitor.uniqueSellingPoints?.length}
    <div class="flex flex-wrap gap-1">
      {#each competitor.uniqueSellingPoints as usp (usp)}
        <Badge variant="secondary" class="text-xs">{usp}</Badge>
      {/each}
    </div>
  {/if}
</div>

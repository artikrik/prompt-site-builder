<script lang="ts">
  import type { EnrichmentData } from '$lib/stores/enrichment';
  import Card from '$lib/components/ui/card/card.svelte';
  import CardHeader from '$lib/components/ui/card/card-header.svelte';
  import CardTitle from '$lib/components/ui/card/card-title.svelte';
  import CardContent from '$lib/components/ui/card/card-content.svelte';
  import Badge from '$lib/components/ui/badge/badge.svelte';

  interface Props {
    data: EnrichmentData | null;
    sources: string[];
    enrichedAt: string | null;
  }

  let { data, sources, enrichedAt }: Props = $props();

  function formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function toneEmoji(usage: string): string {
    switch (usage) {
      case 'none': return '—';
      case 'sparse': return '🙂';
      case 'moderate': return '✨';
      case 'heavy': return '🎉';
      default: return '—';
    }
  }

  let hasData = $derived(data && (
    (data.services && data.services.length > 0) ||
    (data.reviews && data.reviews.length > 0) ||
    (data.photos && data.photos.length > 0) ||
    (data.brandColors && Object.keys(data.brandColors).length > 0) ||
    (data.toneOfVoice) ||
    (data.competitors && data.competitors.length > 0) ||
    (data.salesOpportunities && data.salesOpportunities.length > 0) ||
    (data.salesScript) ||
    (data.customerJourney) ||
    (data.stats && Object.keys(data.stats).length > 0) ||
    (data.businessHours && Object.keys(data.businessHours).length > 0)
  ));
</script>

<Card>
  <CardHeader>
    <CardTitle>Enrichment Data</CardTitle>
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Sources: {sources.length > 0 ? sources.join(', ') : 'None configured'}</span>
      <span>•</span>
      <span>Last enriched: {formatDate(enrichedAt)}</span>
    </div>
  </CardHeader>
  <CardContent>
    {#if !hasData}
      <p class="text-sm text-muted-foreground py-4 text-center">
        No enrichment data yet. Configure sources and click "Enrich".
      </p>
    {:else if data}
      <div class="grid gap-4">
        <!-- Tone of Voice -->
        {#if data.toneOfVoice}
          <div>
            <h4 class="text-sm font-semibold mb-1">Tone of Voice</h4>
            <div class="flex gap-2 flex-wrap">
              <Badge>Style: {data.toneOfVoice.style}</Badge>
              <Badge>Formality: {data.toneOfVoice.formality}</Badge>
              <Badge>Emoji: {toneEmoji(data.toneOfVoice.emojiUsage || 'none')} {data.toneOfVoice.emojiUsage || 'none'}</Badge>
            </div>
          </div>
        {/if}

        <!-- Brand Colors -->
        {#if data.brandColors}
          <div>
            <h4 class="text-sm font-semibold mb-1">Brand Colors</h4>
            <div class="flex gap-3">
              {#each Object.entries(data.brandColors) as [name, color] (name)}
                {#if color}
                  <div class="flex items-center gap-1.5 text-xs">
                    <span class="inline-block w-4 h-4 rounded border" style="background:{color}"></span>
                    {name}: {color}
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/if}

        <!-- Services -->
        {#if data.services && data.services.length > 0}
          <div>
            <h4 class="text-sm font-semibold mb-1">Services ({data.services.length})</h4>
            <div class="flex gap-1.5 flex-wrap">
              {#each data.services as svc (svc.name)}
                <Badge variant="outline">
                  {svc.name}{#if svc.price} — {svc.price}{/if}
                </Badge>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Business Hours -->
        {#if data.businessHours}
          <div>
            <h4 class="text-sm font-semibold mb-1">Business Hours</h4>
            <div class="text-xs text-muted-foreground grid grid-cols-2 gap-x-4">
              {#each Object.entries(data.businessHours) as [day, hours] (day)}
                <div class="flex justify-between"><span>{day}</span><span>{hours}</span></div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Reviews -->
        {#if data.reviews && data.reviews.length > 0}
          <div>
            <h4 class="text-sm font-semibold mb-1">Reviews ({data.reviews.length})</h4>
            <div class="space-y-2 max-h-40 overflow-y-auto">
              {#each data.reviews.slice(0, 5) as review (review.author)}
                <div class="text-xs border-l-2 pl-2 border-muted">
                  <span class="font-medium">{review.author}</span>
                  <span class="text-yellow-500 ml-1">{'★'.repeat(Math.round(review.rating || 0))}</span>
                  <p class="text-muted-foreground">{review.text.slice(0, 120)}</p>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Competitors -->
        {#if data.competitors && data.competitors.length > 0}
          <div>
            <h4 class="text-sm font-semibold mb-1">Competitors ({data.competitors.length})</h4>
            <div class="flex gap-1.5 flex-wrap">
              {#each data.competitors as comp (comp.name)}
                <Badge variant="secondary">
                  {comp.name}
                  {#if comp.rating} ⭐{comp.rating}{/if}
                  {#if comp.distance} ({comp.distance}m){/if}
                </Badge>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Sales Opportunities -->
        {#if data.salesOpportunities && data.salesOpportunities.length > 0}
          <div>
            <h4 class="text-sm font-semibold mb-1">Sales Opportunities</h4>
            <div class="space-y-2">
              {#each data.salesOpportunities as opp (opp.gap)}
                <div class="text-xs border rounded p-2">
                  <p class="font-medium">{opp.gap}</p>
                  <p class="text-muted-foreground">{opp.pitchAngle}</p>
                  {#if opp.revenueImpact}
                    <p class="text-green-600 font-medium mt-1">{opp.revenueImpact}</p>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Customer Journey -->
        {#if data.customerJourney}
          <div>
            <h4 class="text-sm font-semibold mb-1">Customer Journey</h4>
            <div class="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span class="font-medium">Booking:</span>
                <span class="text-muted-foreground">{(data.customerJourney.bookingChannels || []).join(', ') || '—'}</span>
              </div>
              <div>
                <span class="font-medium">Payment:</span>
                <span class="text-muted-foreground">{(data.customerJourney.paymentMethods || []).join(', ') || '—'}</span>
              </div>
              <div>
                <span class="font-medium">Messaging:</span>
                <span class="text-muted-foreground">{(data.customerJourney.messagingApps || []).join(', ') || '—'}</span>
              </div>
            </div>
          </div>
        {/if}

        <!-- Stats -->
        {#if data.stats && Object.keys(data.stats).length > 0}
          <div>
            <h4 class="text-sm font-semibold mb-1">Social Stats</h4>
            <div class="flex gap-3 flex-wrap text-xs">
              {#each Object.entries(data.stats) as [key, value] (key)}
                <Badge variant="outline">{key}: {value}</Badge>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Logo / Photos -->
        {#if data.logoUrl || (data.photos && data.photos.length > 0)}
          <div>
            <h4 class="text-sm font-semibold mb-1">Media</h4>
            <div class="flex gap-2">
              {#if data.logoUrl}
                <img src={data.logoUrl} alt="Logo" class="w-12 h-12 rounded object-cover border" />
              {/if}
              {#each (data.photos || []).slice(0, 4) as photo (photo)}
                <img src={photo} alt="" class="w-12 h-12 rounded object-cover border" />
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </CardContent>
</Card>

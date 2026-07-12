<script lang="ts">
  let { script }: { script: Record<string, any> | null } = $props();

  let activeTab = $state('opening');

  const tabs = [
    { key: 'opening', label: 'Opening' },
    { key: 'discovery', label: 'Discovery' },
    { key: 'valueProposition', label: 'Value' },
    { key: 'objections', label: 'Objections' },
    { key: 'closing', label: 'Closing' },
    { key: 'followUp', label: 'Follow-up' },
    { key: 'strategy', label: 'Strategy' },
  ];

  function copyText(text: string) {
    globalThis.navigator.clipboard.writeText(text);
  }
</script>

{#if script}
  <div class="sales-script rounded-lg border">
    <div class="flex border-b overflow-x-auto">
      {#each tabs as tab (tab.key)}
        <button
          class="px-3 py-2 text-sm font-medium whitespace-nowrap {activeTab === tab.key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}"
          onclick={() => activeTab = tab.key}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="p-4">
      {#if activeTab === 'opening' && script.opening}
        {@render copyBlock({ label: 'Greeting', text: script.opening.greeting, copyText })}
        {@render copyBlock({ label: 'Icebreaker', text: script.opening.icebreaker, copyText })}
        {@render copyBlock({ label: 'Hook', text: script.opening.hook, copyText })}

      {:else if activeTab === 'discovery' && script.discovery}
        <h4 class="font-medium mb-2">Qualification Questions</h4>
        {#each script.discovery.qualificationQuestions || [] as q (q.question)}
          <div class="mb-2 p-2 bg-muted rounded">
            <p class="font-medium text-sm">{q.question}</p>
            <p class="text-xs text-muted-foreground">{q.purpose}</p>
            <button class="text-xs text-primary mt-1" onclick={() => copyText(q.question)}>Copy</button>
          </div>
        {/each}

      {:else if activeTab === 'valueProposition' && script.valueProposition}
        {@render copyBlock({ label: 'Core Promise', text: script.valueProposition.corePromise, copyText })}
        {@render copyBlock({ label: 'Tailored', text: script.valueProposition.tailoredToBusiness, copyText })}
        {#each script.valueProposition.roiExamples || [] as roi (roi.scenario)}
          <div class="p-2 bg-muted rounded mb-2">
            <p class="text-sm font-medium">{roi.scenario}</p>
            <p class="text-sm text-green-600">{roi.result}</p>
          </div>
        {/each}

      {:else if activeTab === 'objections' && script.objections}
        <div class="space-y-3">
          {#each script.objections || [] as obj (obj.objection)}
            <div class="p-3 border rounded">
              <p class="font-semibold text-red-600">❌ "{obj.objection}"</p>
              <p class="text-xs text-muted-foreground">Root cause: {obj.rootCause}</p>
              <div class="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded">
                <p class="text-sm font-medium text-green-700">Response:</p>
                <p class="text-sm">{obj.response}</p>
              </div>
              <p class="text-xs mt-1"><strong>If they push back:</strong> {obj.followUp}</p>
              {#if obj.evidence}
                <p class="text-xs text-muted-foreground">Evidence: {obj.evidence}</p>
              {/if}
              <button class="text-xs text-primary mt-1" onclick={() => copyText(obj.response)}>Copy Response</button>
            </div>
          {/each}
        </div>

      {:else if activeTab === 'closing' && script.closing}
        {@render copyBlock({ label: 'Trial Closes', text: script.closing.trialCloses?.join('\n\n'), copyText })}
        {@render copyBlock({ label: 'Assumptive Close', text: script.closing.assumptiveClose, copyText })}
        {@render copyBlock({ label: 'Urgency Builder', text: script.closing.urgencyBuilder, copyText })}
        {@render copyBlock({ label: 'Alternative Close', text: script.closing.alternativeClose, copyText })}

      {:else if activeTab === 'followUp' && script.followUp}
        {@render copyBlock({ label: 'Same Day SMS', text: script.followUp.sameDaySms, copyText })}
        {@render copyBlock({ label: 'Next Day Email', text: script.followUp.nextDayEmail, copyText })}
        {@render copyBlock({ label: '3-Day Callback', text: script.followUp.threeDayCallback, copyText })}
        {@render copyBlock({ label: 'Referral Ask', text: script.followUp.referralAsk, copyText })}

      {:else if activeTab === 'strategy' && script.strategy}
        <div class="space-y-2 text-sm">
          <p><strong>Decision Maker:</strong> {script.strategy.targetDecisionMaker}</p>
          <p><strong>Best Time to Call:</strong> {script.strategy.bestTimeToCall}</p>
          <div><strong>Deal Breakers:</strong>
            <ul class="list-disc pl-4">{#each script.strategy.dealBreakers || [] as d (d)}<li>{d}</li>{/each}</ul>
          </div>
          <div><strong>Quick Wins:</strong>
            <ul class="list-disc pl-4">{#each script.strategy.quickWins || [] as w (w)}<li>{w}</li>{/each}</ul>
          </div>
          <div><strong>Competitive Advantages:</strong>
            <ul class="list-disc pl-4">{#each script.strategy.competitiveAdvantages || [] as a (a)}<li>{a}</li>{/each}</ul>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

{#snippet copyBlock(args: { label: string; text?: string; copyText: (t: string) => void })}
  {#if args.text}
    <div class="mb-3">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-muted-foreground">{args.label}</span>
        <button class="text-xs text-primary" onclick={() => args.copyText(args.text!)}>Copy</button>
      </div>
      <p class="text-sm mt-1 p-2 bg-muted rounded whitespace-pre-wrap">{args.text}</p>
    </div>
  {/if}
{/snippet}

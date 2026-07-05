<!-- apps/frontend/src/lib/components/settings/ApiKeyInput.svelte -->
<script lang="ts">
  interface Props {
    label: string;
    placeholder: string;
    maskedPreview: string;
    onChange: (_value: string) => void;
  }

  let { label, placeholder, maskedPreview, onChange }: Props = $props();

  let isEditing = $state(false);
  let inputValue = $state('');

  function startEditing() {
    inputValue = '';
    isEditing = true;
  }

  function saveKey() {
    onChange(inputValue);
    isEditing = false;
  }

  function clearKey() {
    onChange('');
    isEditing = false;
  }
</script>

<div class="space-y-2">
  <label class="text-sm font-medium">{label}</label>
  {#if isEditing}
    <div class="flex gap-2">
      <input
        type="password"
        bind:value={inputValue}
        placeholder={placeholder}
        class="flex-1 rounded-md border px-3 py-2 text-sm"
      />
      <button onclick={saveKey} class="rounded-md bg-primary px-3 py-2 text-sm text-white">Save</button>
      <button onclick={() => (isEditing = false)} class="rounded-md border px-3 py-2 text-sm">Cancel</button>
    </div>
  {:else if maskedPreview}
    <div class="flex items-center gap-2">
      <code class="flex-1 rounded-md bg-muted px-3 py-2 text-sm">{maskedPreview}</code>
      <button onclick={startEditing} class="rounded-md border px-3 py-2 text-sm">Change</button>
      <button onclick={clearKey} class="rounded-md border px-3 py-2 text-sm text-destructive">Clear</button>
    </div>
  {:else}
    <div class="flex gap-2">
      <input
        type="password"
        bind:value={inputValue}
        placeholder={placeholder}
        class="flex-1 rounded-md border px-3 py-2 text-sm"
      />
      <button onclick={saveKey} class="rounded-md bg-primary px-3 py-2 text-sm text-white">Save</button>
    </div>
  {/if}
</div>

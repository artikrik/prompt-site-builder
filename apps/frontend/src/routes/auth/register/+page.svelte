<script lang="ts">
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let isLoading = $state(false);
  let error = $state('');

  async function handleRegister() {
    isLoading = true;
    error = '';
    try {
      await auth.register(email, password, name);
      goto(resolve('/dashboard'));
    } catch (e) {
      error = e instanceof Error ? e.message : 'Registration failed';
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Register - Prompt Site Builder</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-background px-4">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <Card.Title class="text-2xl">Create your account</Card.Title>
      <Card.Description>
        Or <a href={resolve('/auth/login')} class="text-primary underline underline-offset-4">sign in to existing account</a>
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <form onsubmit={(e) => { e.preventDefault(); handleRegister(); }} class="space-y-4">
        {#if error}
          <div class="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>
        {/if}
        <div class="space-y-2">
          <Label for="name">Full name</Label>
          <Input id="name" type="text" bind:value={name} required />
        </div>
        <div class="space-y-2">
          <Label for="email">Email address</Label>
          <Input id="email" type="email" bind:value={email} required />
        </div>
        <div class="space-y-2">
          <Label for="password">Password</Label>
          <Input id="password" type="password" bind:value={password} required />
        </div>
        <Button type="submit" class="w-full" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
    </Card.Content>
  </Card.Root>
</div>

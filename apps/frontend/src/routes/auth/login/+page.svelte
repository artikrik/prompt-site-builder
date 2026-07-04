<script lang="ts">
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';

  let email = $state('');
  let password = $state('');
  let isLoading = $state(false);
  let error = $state('');

  async function handleLogin() {
    isLoading = true;
    error = '';
    try {
      await auth.login(email, password);
      goto(resolve('/dashboard'));
    } catch (e) {
      error = e instanceof Error ? e.message : 'Login failed';
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Login - Prompt Site Builder</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-background px-4">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <Card.Title class="text-2xl">Sign in to your account</Card.Title>
      <Card.Description>
        Or <a href='/auth/register' class="text-primary underline underline-offset-4">create a new account</a>
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <form onsubmit={(e) => { e.preventDefault(); handleLogin(); }} class="space-y-4">
        {#if error}
          <div class="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>
        {/if}
        <div class="space-y-2">
          <Label for="email">Email address</Label>
          <Input id="email" type="email" bind:value={email} placeholder="admin@promptsite.com" required />
        </div>
        <div class="space-y-2">
          <Label for="password">Password</Label>
          <Input id="password" type="password" bind:value={password} placeholder="••••••••" required />
        </div>
        <Button type="submit" class="w-full" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </Card.Content>
  </Card.Root>
</div>

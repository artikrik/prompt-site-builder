<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth, isAuthenticated } from '$lib/stores/auth';
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Separator from '$lib/components/ui/separator/index.js';
  import { Home, Users, FolderOpen, Settings, LogOut } from '@lucide/svelte';

  let { children } = $props();

  onMount(() => {
    auth.initialize();
    if (!$isAuthenticated) {
      goto('/auth/login');
    }
  });

  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: Home },
    { href: '/dashboard/leads', label: 'Leads', icon: Users },
    { href: '/dashboard/projects', label: 'Projects', icon: FolderOpen },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  ];

  function isActive(href: string, pathname: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }
</script>

<div class="min-h-screen bg-background flex">
  <aside class="w-64 border-r border-border flex flex-col">
    <div class="h-14 flex items-center px-4 border-b border-border">
      <h1 class="text-lg font-semibold">Prompt Site Builder</h1>
    </div>

    <nav class="flex-1 p-3 space-y-1">
      {#each navItems as item}
        {@const Icon = item.icon}
        <a
          href={item.href}
          class="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors
            {isActive(item.href, $page.url.pathname)
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
        >
          <Icon class="w-4 h-4" />
          {item.label}
        </a>
      {/each}
    </nav>

    <div class="p-3 border-t border-border">
      <Button variant="ghost" class="w-full justify-start gap-3" onclick={() => { auth.logout(); goto('/auth/login'); }}>
        <LogOut class="w-4 h-4" />
        Logout
      </Button>
    </div>
  </aside>

  <main class="flex-1 overflow-auto">
    <div class="p-6">
      {@render children()}
    </div>
  </main>
</div>

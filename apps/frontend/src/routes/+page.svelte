<script lang="ts">
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Search, Zap, Globe } from '@lucide/svelte';
</script>

<svelte:head>
  <title>Prompt Site Builder - AI-Powered B2B Site Generation</title>
  <meta name="description" content="Automated platform for generating SEO-optimized websites for B2B businesses" />
</svelte:head>

<div class="min-h-screen flex flex-col">
  <header class="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center">
          <h1 class="text-xl font-bold">Prompt Site Builder</h1>
        </div>
        <div class="flex items-center space-x-4">
          <Button variant="ghost" onclick={() => goto(resolve('/auth/login'))}>Login</Button>
          <Button onclick={() => goto(resolve('/auth/login'))}>Get Started</Button>
        </div>
      </div>
    </div>
  </header>

  <main class="flex-1">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div class="text-center space-y-6">
        <h2 class="text-4xl font-bold tracking-tight">AI-Powered B2B Website Generation</h2>
        <p class="text-xl text-muted-foreground max-w-3xl mx-auto">
          Automatically discover businesses without online presence and generate
          SEO-optimized websites with booking and payment integrations.
        </p>
        <div class="flex justify-center space-x-4">
          <Button size="lg" onclick={() => goto(resolve('/dashboard'))}>Open Dashboard</Button>
          <Button size="lg" variant="outline">Learn More</Button>
        </div>
      </div>

      <Separator class="my-20" />

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card.Root>
          <Card.Header>
            <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
              <Search class="w-6 h-6 text-primary" />
            </div>
            <Card.Title>Lead Discovery</Card.Title>
          </Card.Header>
          <Card.Content>
            <Card.Description>Find businesses without websites using Google Maps and social media scraping.</Card.Description>
          </Card.Content>
        </Card.Root>

        <Card.Root>
          <Card.Header>
            <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
              <Zap class="w-6 h-6 text-primary" />
            </div>
            <Card.Title>AI Generation</Card.Title>
          </Card.Header>
          <Card.Content>
            <Card.Description>Generate complete Hugo websites with SEO content and custom images using AI.</Card.Description>
          </Card.Content>
        </Card.Root>

        <Card.Root>
          <Card.Header>
            <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
              <Globe class="w-6 h-6 text-primary" />
            </div>
            <Card.Title>One-Click Publish</Card.Title>
          </Card.Header>
          <Card.Content>
            <Card.Description>Deploy to custom subdomains with automatic SSL and booking/payment widgets.</Card.Description>
          </Card.Content>
        </Card.Root>
      </div>
    </div>
  </main>

  <footer class="border-t border-border py-8">
    <div class="max-w-7xl mx-auto px-4 text-center text-muted-foreground text-sm">
      <p>&copy; 2024 Prompt Site Builder. All rights reserved.</p>
    </div>
  </footer>
</div>

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdir, writeFile, rm, access } from 'fs/promises';
import { join } from 'path';
import { HugoBuildResult, GeneratedSiteStructure } from '@prompt-site-builder/shared';
import { getThemeByName } from '../themes/theme-registry';

const execFileAsync = promisify(execFile);

@Injectable()
export class HugoCompilerService {
  private readonly logger = new Logger(HugoCompilerService.name);
  private readonly hugoBinary: string;
  private readonly sitesPath: string;
  private readonly themeCache = new Map<string, boolean>();

  constructor(private readonly configService: ConfigService) {
    this.hugoBinary = this.configService.get<string>('HUGO_BINARY_PATH', 'hugo');
    this.sitesPath = this.configService.get<string>('HUGO_SITES_PATH', '/var/www/client-sites');
  }

  async build(slug: string, structure: GeneratedSiteStructure, theme?: string, variantId?: string): Promise<HugoBuildResult> {
    const outputSlug = variantId ? `${slug}--${variantId}` : slug;
    const tempDir = join(this.sitesPath, `.temp-${outputSlug}`);

    try {
      // Create project structure
      await this.createProjectStructure(tempDir, structure);

      // Install theme if specified
      if (theme) {
        await this.installTheme(theme, tempDir);
      }

      // Run Hugo build
      const { stdout, stderr } = await execFileAsync(this.hugoBinary, ['--minify'], {
        cwd: tempDir,
        timeout: 120000, // 120 seconds for large themes
      });

      this.logger.log(`Hugo build output for ${outputSlug}: ${stdout}`);

      // Copy public/ to final location
      const publicDir = join(tempDir, 'public');
      const finalDir = join(this.sitesPath, outputSlug);

      await rm(finalDir, { recursive: true, force: true });
      await this.copyDirectory(publicDir, finalDir);

      // Cleanup temp directory
      await rm(tempDir, { recursive: true, force: true });

      return {
        success: true,
        outputDir: finalDir,
        errors: [],
        warnings: stderr ? [stderr] : [],
      };
    } catch (error) {
      this.logger.error(`Hugo build failed for ${outputSlug}: ${error}`);

      await rm(tempDir, { recursive: true, force: true }).catch(() => {});

      return {
        success: false,
        outputDir: '',
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      };
    }
  }

  async clean(slug: string): Promise<void> {
    const projectDir = join(this.sitesPath, slug);
    await rm(projectDir, { recursive: true, force: true });
  }

  private async installTheme(themeName: string, projectDir: string): Promise<void> {
    const theme = getThemeByName(themeName);
    if (!theme) {
      this.logger.warn(`Theme "${themeName}" not found in registry, skipping installation`);
      return;
    }

    const themesDir = join(projectDir, 'themes');
    const themeDir = join(themesDir, theme.name);

    try {
      await mkdir(themesDir, { recursive: true });

      // Check if theme is already cached
      const cacheKey = `${theme.name}-${theme.repoUrl}`;
      if (this.themeCache.has(cacheKey)) {
        this.logger.log(`Theme "${themeName}" found in cache`);
        // Copy from cache if available
        const cacheDir = join(this.sitesPath, '.theme-cache', theme.name);
        try {
          await access(cacheDir);
          await this.copyDirectory(cacheDir, themeDir);
          this.logger.log(`Theme "${themeName}" restored from cache`);
          return;
        } catch {
          // Cache not available, continue with download
        }
      }

      // Try git clone with retry (3 attempts)
      let gitSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await execFileAsync('git', ['clone', '--depth', '1', theme.repoUrl, themeDir], {
            timeout: 45000, // 45 seconds per attempt
          });
          this.logger.log(`Theme "${themeName}" installed via git clone (attempt ${attempt})`);
          gitSuccess = true;

          // Cache the theme for future use
          const cacheDir = join(this.sitesPath, '.theme-cache', theme.name);
          await mkdir(cacheDir, { recursive: true });
          await this.copyDirectory(themeDir, cacheDir);
          this.themeCache.set(cacheKey, true);

          return;
        } catch (gitError) {
          this.logger.warn(`Git clone attempt ${attempt} failed for "${themeName}": ${gitError}`);
          if (attempt < 3) {
            // Wait before retry (exponential backoff)
            await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
          }
        }
      }

      if (!gitSuccess) {
        // Fallback: download tarball
        try {
          const tarUrl = `${theme.repoUrl}/archive/refs/heads/main.tar.gz`;
          const response = await fetch(tarUrl);
          if (response.ok) {
            const tarPath = join(themesDir, `${theme.name}.tar.gz`);
            const buffer = Buffer.from(await response.arrayBuffer());
            await writeFile(tarPath, buffer);

            await execFileAsync('tar', ['-xzf', tarPath, '-C', themesDir], { timeout: 15000 });
            await rm(tarPath, { force: true });

            // Rename extracted directory
            const extractedDirs = await import('fs/promises').then((fs) =>
              fs.readdir(themesDir, { withFileTypes: true }),
            );
            const extractedDir = extractedDirs.find(
              (d) => d.isDirectory() && d.name !== theme.name && d.name.startsWith(theme.name.replace('hugo-', '')),
            );
            if (extractedDir) {
              const { rename } = await import('fs/promises');
              await rename(join(themesDir, extractedDir.name), themeDir);
            }

            this.logger.log(`Theme "${themeName}" installed via tarball`);
            return;
          }
        } catch (tarError) {
          this.logger.warn(`Tarball download failed for "${themeName}": ${tarError}`);
        }

        // Final fallback: create minimal theme stub
        this.logger.warn(`Creating minimal theme stub for "${themeName}"`);
        await this.createMinimalThemeStub(themeDir, themeName);
      }
    } catch (error) {
      this.logger.error(`Theme installation failed for "${themeName}": ${error}`);
      // Create minimal stub so Hugo doesn't fail
      await this.createMinimalThemeStub(themeDir, themeName).catch(() => {});
    }
  }

  private async createMinimalThemeStub(themeDir: string, themeName: string): Promise<void> {
    await mkdir(join(themeDir, 'layouts', '_default'), { recursive: true });
    await mkdir(join(themeDir, 'layouts', 'partials'), { recursive: true });
    await mkdir(join(themeDir, 'static', 'css'), { recursive: true });

    // baseof.html
    await writeFile(
      join(themeDir, 'layouts', '_default', 'baseof.html'),
      `<!DOCTYPE html>
<html lang="{{ .Site.LanguageCode }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ if .IsHome }}{{ .Site.Title }}{{ else }}{{ .Title }} | {{ .Site.Title }}{{ end }}</title>
  <meta name="description" content="{{ with .Description }}{{ . }}{{ else }}{{ .Site.Params.description }}{{ end }}">
  <link rel="stylesheet" href="/css/style.css">
  {{ template "_internal/opengraph.html" . }}
  {{ template "_internal/schema.html" . }}
</head>
<body>
  {{ partial "header.html" . }}
  <main>{{ block "main" . }}{{ end }}</main>
  {{ partial "footer.html" . }}
</body>
</html>`,
    );

    // index.html
    await writeFile(
      join(themeDir, 'layouts', 'index.html'),
      `{{ define "main" }}
<article>
  {{ .Content }}
</article>
{{ end }}`,
    );

    // single.html
    await writeFile(
      join(themeDir, 'layouts', '_default', 'single.html'),
      `{{ define "main" }}
<article>
  <h1>{{ .Title }}</h1>
  {{ .Content }}
</article>
{{ end }}`,
    );

    // list.html
    await writeFile(
      join(themeDir, 'layouts', '_default', 'list.html'),
      `{{ define "main" }}
<h1>{{ .Title }}</h1>
{{ .Content }}
{{ range .Pages }}
  <article>
    <h2><a href="{{ .Permalink }}">{{ .Title }}</a></h2>
    {{ .Summary }}
  </article>
{{ end }}
{{ end }}`,
    );

    // header partial
    await writeFile(
      join(themeDir, 'layouts', 'partials', 'header.html'),
      `<header>
  <nav>
    <a href="/"><strong>{{ .Site.Title }}</strong></a>
    {{ range .Site.Menus.main }}
      <a href="{{ .URL }}">{{ .Name }}</a>
    {{ end }}
  </nav>
</header>`,
    );

    // footer partial
    await writeFile(
      join(themeDir, 'layouts', 'partials', 'footer.html'),
      `<footer>
  <p>&copy; {{ now.Year }} {{ .Site.Title }}</p>
  {{ with .Site.Params.phone }}<p>Phone: {{ . }}</p>{{ end }}
  {{ with .Site.Params.email }}<p>Email: {{ . }}</p>{{ end }}
</footer>`,
    );

    // CSS
    await writeFile(
      join(themeDir, 'static', 'css', 'style.css'),
      `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Inter, system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1e293b; background: #fff; }
header { background: #1e293b; color: white; padding: 1rem 2rem; }
header nav { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 2rem; }
header a { color: #e2e8f0; text-decoration: none; }
header a:hover { color: white; }
main { max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
h1 { font-size: 2.5rem; margin-bottom: 1rem; color: #0f172a; }
h2 { font-size: 1.75rem; margin: 2rem 0 1rem; color: #1e293b; }
p { margin-bottom: 1rem; }
ul, ol { margin-left: 1.5rem; margin-bottom: 1rem; }
li { margin-bottom: 0.5rem; }
a { color: #2563eb; text-decoration: none; }
a:hover { text-decoration: underline; }
footer { background: #0f172a; color: #94a3b8; padding: 2rem; text-align: center; margin-top: 4rem; }`,
    );

    // theme.toml
    await writeFile(
      join(themeDir, 'theme.toml'),
      `name = "${themeName}"
description = "Auto-generated theme stub for ${themeName}"
min_version = "0.100.0"

[author]
  name = "Prompt Site Builder"`,
    );
  }

  private async createProjectStructure(dir: string, structure: GeneratedSiteStructure): Promise<void> {
    await mkdir(join(dir, 'content'), { recursive: true });
    await mkdir(join(dir, 'layouts'), { recursive: true });
    await mkdir(join(dir, 'layouts', 'partials'), { recursive: true });
    await mkdir(join(dir, 'layouts', 'shortcodes'), { recursive: true });
    await mkdir(join(dir, 'static', 'images'), { recursive: true });
    await mkdir(join(dir, 'archetypes'), { recursive: true });

    await writeFile(join(dir, 'hugo.toml'), structure.config);

    for (const file of structure.content) {
      await writeFile(join(dir, file.path), file.body);
    }

    for (const file of structure.layouts) {
      await writeFile(join(dir, file.path), file.body);
    }

    for (const file of structure.partials || []) {
      await writeFile(join(dir, file.path), file.body);
    }

    for (const file of structure.shortcodes || []) {
      await writeFile(join(dir, file.path), file.body);
    }

    for (const file of structure.static) {
      await writeFile(join(dir, file.path), file.body);
    }

    for (const asset of structure.assets) {
      await writeFile(join(dir, asset.path), asset.data);
    }

    await writeFile(
      join(dir, 'archetypes', 'default.md'),
      `---
title: "{{ replace .Name "-" " " | title }}"
date: {{ .Date }}
draft: true
---
`,
    );
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    const { mkdir: mkdirAsync, readdir, copyFile } = await import('fs/promises');
    const { join: joinPath } = await import('path');

    await mkdirAsync(dest, { recursive: true });
    const entries = await readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = joinPath(src, entry.name);
      const destPath = joinPath(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  }
}

import * as fs from 'fs';
import * as path from 'path';
import { createMockStats } from '../src/github-api';
import { renderRetroTvSvg } from '../src/svg-renderer';
import { resolveScreenPalette, resolveTVPalette } from '../src/themes';
import { ThemeConfig } from '../src/types';

async function generatePreviews() {
  console.log('[PREVIEW] Generating CathodeRayStats Theme Previews...');

  const previewDir = path.resolve(process.cwd(), 'preview');
  const previewSvgsDir = path.resolve(previewDir, 'svgs');
  const distDir = path.resolve(process.cwd(), 'dist');

  if (!fs.existsSync(previewSvgsDir)) {
    fs.mkdirSync(previewSvgsDir, { recursive: true });
  }
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const mockStats = createMockStats('YOUR-NAME');

  const themeMatrix: Array<{
    id: string;
    name: string;
    description: string;
    tvColor: string;
    screenColor: string;
    tvStyle: 'classic' | 'trinitron';
    showAntennas: boolean;
    channel?: ThemeConfig['channel'];
    knobType?: 'line' | 'dot';
  }> = [
    {
      id: 'default-white-charcoal',
      name: 'Monochrome Stealth (Default)',
      description: 'Classic B&W P4 Phosphor on Charcoal Cabinet',
      tvColor: 'charcoal',
      screenColor: 'white',
      tvStyle: 'classic',
      showAntennas: false,
      knobType: 'line',
    },
    {
      id: 'vintage-amber-walnut',
      name: 'Zenith Amber Walnut',
      description: 'IBM / Zenith P3 Amber Phosphor on 70s Walnut Woodgrain',
      tvColor: 'walnut',
      screenColor: 'yellow',
      tvStyle: 'classic',
      showAntennas: false,
      knobType: 'line',
    },
    {
      id: 'apple-green-beige',
      name: 'Apple II Terminal Putty',
      description: 'P1 Green Phosphor on 80s Computer Putty Beige',
      tvColor: 'beige',
      screenColor: 'green',
      tvStyle: 'classic',
      showAntennas: false,
      knobType: 'line',
    },
    {
      id: 'cyber-cyan-crimson',
      name: 'Cyberpunk Redline',
      description: 'Vibrant Halcyon Cyan Phosphor on Space Age Crimson',
      tvColor: 'crimson',
      screenColor: 'cyan',
      tvStyle: 'classic',
      showAntennas: false,
      knobType: 'line',
    },
    {
      id: 'synthwave-magenta-navy',
      name: 'Midnight Synthwave',
      description: 'Outrun Magenta Phosphor on Midnight Navy Chassis',
      tvColor: 'navy',
      screenColor: 'magenta',
      tvStyle: 'classic',
      showAntennas: false,
      knobType: 'line',
    },
    {
      id: 'classic-antennas-amber',
      name: 'Rabbit-Ear Vintage Console',
      description: 'Amber Phosphor with classic telescoping antennas',
      tvColor: 'walnut',
      screenColor: 'yellow',
      tvStyle: 'classic',
      showAntennas: true,
      knobType: 'line',
    },
    {
      id: 'trinitron-white-charcoal',
      name: 'Sony Trinitron Studio Monitor',
      description: 'Angular boxy monitor chassis with crisp white phosphor',
      tvColor: 'charcoal',
      screenColor: 'white',
      tvStyle: 'trinitron',
      showAntennas: false,
      knobType: 'line',
    },
  ];

  // Dedicated Knob Style Comparison Matrix
  const knobMatrix: Array<{
    id: string;
    name: string;
    description: string;
    knobType: 'line' | 'dot';
  }> = [
    {
      id: 'knob-style-line',
      name: 'Line Pointer Dial (Default)',
      description: 'Radial phosphor notch mark rotating and pointing to the channel tick marks',
      knobType: 'line',
    },
    {
      id: 'knob-style-dot',
      name: 'Glowing Dot Dial (Retro Indicator)',
      description: 'Recessed glowing indicator dot rotating on the metallic dial face',
      knobType: 'dot',
    },
  ];

  const channelFreezeMatrix: Array<{
    id: string;
    name: string;
    channel: ThemeConfig['channel'];
  }> = [
    { id: 'freeze-ch1-stats', name: 'Channel 1: System Stats', channel: '1' },
    { id: 'freeze-ch2-languages', name: 'Channel 2: Top Languages', channel: '2' },
    { id: 'freeze-ch3-showing', name: 'Channel 3: Now Showing', channel: '3' },
    { id: 'freeze-ch4-activity', name: 'Channel 4: Activity Heatmap', channel: '4' },
  ];

  // Generate Theme Matrix SVGs
  for (const item of themeMatrix) {
    const config: ThemeConfig = {
      screen: resolveScreenPalette(item.screenColor),
      tv: resolveTVPalette(item.tvColor),
      tvStyle: item.tvStyle,
      showAntennas: item.showAntennas,
      channelDuration: 4,
      channel: item.channel || 'all',
      username: 'YOUR-NAME',
      badgeLabel: '@YOUR-NAME',
      knobType: item.knobType || 'line',
    };

    const svg = renderRetroTvSvg(mockStats, config);
    fs.writeFileSync(path.join(previewSvgsDir, `${item.id}.svg`), svg, 'utf8');

    if (item.id === 'default-white-charcoal') {
      fs.writeFileSync(path.join(distDir, 'retro-tv.svg'), svg, 'utf8');
    }
  }

  // Generate Knob Comparison SVGs
  for (const item of knobMatrix) {
    const config: ThemeConfig = {
      screen: resolveScreenPalette('white'),
      tv: resolveTVPalette('charcoal'),
      tvStyle: 'classic',
      showAntennas: false,
      channelDuration: 4,
      channel: 'all',
      username: 'YOUR-NAME',
      badgeLabel: '@YOUR-NAME',
      knobType: item.knobType,
    };

    const svg = renderRetroTvSvg(mockStats, config);
    fs.writeFileSync(path.join(previewSvgsDir, `${item.id}.svg`), svg, 'utf8');
  }

  // Generate Channel Freeze SVGs
  for (const item of channelFreezeMatrix) {
    const config: ThemeConfig = {
      screen: resolveScreenPalette('white'),
      tv: resolveTVPalette('charcoal'),
      tvStyle: 'classic',
      showAntennas: false,
      channelDuration: 4,
      channel: item.channel,
      username: 'YOUR-NAME',
      badgeLabel: '@YOUR-NAME',
      knobType: 'line',
    };

    const svg = renderRetroTvSvg(mockStats, config);
    fs.writeFileSync(path.join(previewSvgsDir, `${item.id}.svg`), svg, 'utf8');
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CathodeRayStats — Theme Gallery & Documentation</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-bright: #f0f6fc;
      --accent: #58a6ff;
    }

    body.light-mode {
      --bg: #f6f8fa;
      --card-bg: #ffffff;
      --border: #d0d7de;
      --text: #57606a;
      --text-bright: #24292f;
      --accent: #0969da;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      padding: 2rem 1.5rem;
      transition: background-color 0.25s ease, color 0.25s ease;
    }

    header {
      max-width: 1100px;
      margin: 0 auto 2.5rem;
      text-align: center;
    }

    h1 {
      color: var(--text-bright);
      font-size: 2.2rem;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
    }

    p.subtitle {
      font-size: 1.1rem;
      color: var(--text);
      max-width: 700px;
      margin: 0 auto 1.5rem;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 2rem;
    }

    .btn {
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text-bright);
      padding: 0.55rem 1.1rem;
      font-size: 0.95rem;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.15s ease;
    }

    .btn:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .btn.active {
      background: var(--accent);
      color: #ffffff;
      border-color: var(--accent);
    }

    .section-title {
      max-width: 1100px;
      margin: 3rem auto 1.2rem;
      font-size: 1.4rem;
      color: var(--text-bright);
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.5rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 2rem;
      max-width: 1100px;
      margin: 0 auto;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: transform 0.2s ease, border-color 0.2s ease;
    }

    .card:hover {
      transform: translateY(-2px);
      border-color: var(--accent);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 1rem;
    }

    .card-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-bright);
    }

    .card-desc {
      font-size: 0.85rem;
      color: var(--text);
      margin-top: 0.2rem;
    }

    .card-badge {
      background: rgba(88, 166, 255, 0.15);
      color: var(--accent);
      border: 1px solid var(--accent);
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 12px;
      text-transform: uppercase;
    }

    .tv-container {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      background: transparent;
      padding: 0.5rem 0;
    }

    .tv-container img {
      width: 100%;
      height: auto;
      max-width: 600px;
      display: block;
    }

    .code-container {
      max-width: 1100px;
      margin: 1.5rem auto 2rem;
      background: #090d12;
      border: 1px solid #30363d;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    }

    .code-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.6rem 1rem;
      background: #161b22;
      border-bottom: 1px solid #30363d;
      font-size: 0.85rem;
      font-weight: 600;
      color: #8b949e;
    }

    .copy-btn {
      background: #21262d;
      border: 1px solid #30363d;
      color: #c9d1d9;
      padding: 0.25rem 0.65rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.15s ease;
    }

    .copy-btn:hover {
      border-color: #58a6ff;
      color: #58a6ff;
    }

    .code-block {
      background: #090d12;
      padding: 1.25rem 1.5rem;
      color: #e2e8f0;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 0.88rem;
      line-height: 1.6;
      white-space: pre;
      overflow-x: auto;
      margin: 0;
    }
  </style>
</head>
<body>
  <header>
    <h1>CathodeRayStats</h1>
    <p class="subtitle">Zero-dependency, animated retro CRT television widget displaying live GitHub statistics across 4 cycling channels.</p>
    <div class="toolbar">
      <button class="btn" id="toggle-theme" onclick="toggleCanvasTheme()">Toggle Light/Dark Background</button>
      <button class="btn active" onclick="scrollToSection('presets')">Theme Presets</button>
      <button class="btn" onclick="scrollToSection('knobs')">Knob Styles (Line vs Dot)</button>
      <button class="btn" onclick="scrollToSection('channels')">Channel Inspector</button>
      <button class="btn" onclick="scrollToSection('usage')">Setup Guide</button>
    </div>
  </header>

  <!-- THEME PRESETS SECTION -->
  <h2 class="section-title" id="presets">Theme & Cabinet Presets</h2>
  <div class="grid">
    ${themeMatrix.map(item => `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${item.name}</div>
            <div class="card-desc">${item.description}</div>
          </div>
          <span class="card-badge">${item.screenColor} / ${item.tvColor}</span>
        </div>
        <div class="tv-container">
          <img src="svgs/${item.id}.svg" alt="${item.name}" />
        </div>
      </div>
    `).join('')}
  </div>

  <!-- KNOB STYLES COMPARISON SECTION -->
  <h2 class="section-title" id="knobs">Rotary Knob Indicator Styles (Line vs Dot)</h2>
  <div class="grid">
    ${knobMatrix.map(item => `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${item.name}</div>
            <div class="card-desc">${item.description}</div>
          </div>
          <span class="card-badge">knob-type: '${item.knobType}'</span>
        </div>
        <div class="tv-container">
          <img src="svgs/${item.id}.svg" alt="${item.name}" />
        </div>
      </div>
    `).join('')}
  </div>

  <!-- CHANNEL INSPECTOR SECTION -->
  <h2 class="section-title" id="channels">Live Channel Inspector (Frozen Single Channels)</h2>
  <div class="grid">
    ${channelFreezeMatrix.map(item => `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${item.name}</div>
            <div class="card-desc">Static view of channel #${item.channel} without cycling</div>
          </div>
          <span class="card-badge">channel: '${item.channel}'</span>
        </div>
        <div class="tv-container">
          <img src="svgs/${item.id}.svg" alt="${item.name}" />
        </div>
      </div>
    `).join('')}
  </div>

  <!-- USAGE & WORKFLOW GUIDE -->
  <h2 class="section-title" id="usage">GitHub Actions Setup Guide</h2>
  
  <p style="max-width: 1100px; margin: 0 auto 0.75rem; font-size: 0.95rem; color: var(--text);">
    <strong>Step 1:</strong> Create <code>.github/workflows/cathoderaystats.yml</code> in your repository:
  </p>
  <div class="code-container">
    <div class="code-header">
      <span>.github/workflows/cathoderaystats.yml</span>
      <button class="copy-btn" onclick="copySnippet('workflow-code', this)">Copy Workflow</button>
    </div>
    <pre class="code-block" id="workflow-code">name: CathodeRayStats

on:
  schedule:
    - cron: '0 */6 * * *' # Updates every 6 hours
  workflow_dispatch:      # Allows manual trigger button in Actions tab

permissions:
  contents: write         # Needed to commit updated SVG back to repository

jobs:
  update-cathoderaystats:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Generate CathodeRayStats SVG
        uses: Cheese-Cheese/CathodeRayStats@v1
        with:
          username: \${{ github.repository_owner }}
          tv-color: charcoal      # charcoal, walnut, beige, mustard, crimson, navy, or #hex
          screen-color: white     # white, yellow, green, cyan, magenta, orange, or #hex
          knob-type: line         # line (radial tick mark) or dot (recessed indicator dot)
          show-antennas: false    # true / false
          channel-duration: 4     # seconds per channel</pre>
  </div>

  <p style="max-width: 1100px; margin: 1.5rem auto 0.5rem; font-size: 0.95rem; color: var(--text);">
    <strong>Step 2:</strong> Trigger the workflow once manually in GitHub Actions:
  </p>
  <div style="max-width: 1100px; margin: 0 auto 1.5rem; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.25rem; font-size: 0.9rem; line-height: 1.6; color: var(--text);">
    <ol style="margin-left: 1.25rem;">
      <li>Navigate to the <strong>Actions</strong> tab in your repository.</li>
      <li>In the left sidebar, click on <strong>CathodeRayStats</strong>.</li>
      <li>Click the <strong>Run workflow</strong> dropdown button on the right and select <strong>Run workflow</strong>.</li>
      <li>Wait ~30 seconds for the action to complete and commit <code>dist/retro-tv.svg</code> to your repo.</li>
    </ol>
  </div>

  <p style="max-width: 1100px; margin: 0 auto 0.75rem; font-size: 0.95rem; color: var(--text);">
    <strong>Step 3:</strong> Embed the animated SVG in your <code>README.md</code>:
  </p>
  <div class="code-container">
    <div class="code-header">
      <span>README.md</span>
      <button class="copy-btn" onclick="copySnippet('embed-code', this)">Copy Markdown</button>
    </div>
    <pre class="code-block" id="embed-code">&lt;p align="center"&gt;
  &lt;img src="./dist/retro-tv.svg" alt="CathodeRayStats Widget" width="650" /&gt;
&lt;/p&gt;</pre>
  </div>

  <script>
    function toggleCanvasTheme() {
      document.body.classList.toggle('light-mode');
    }

    function scrollToSection(id) {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }

    function copySnippet(elementId, button) {
      const code = document.getElementById(elementId)?.innerText;
      if (code) {
        navigator.clipboard.writeText(code).then(() => {
          const originalText = button.innerText;
          button.innerText = 'Copied!';
          setTimeout(() => {
            button.innerText = originalText;
          }, 2000);
        });
      }
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(previewDir, 'index.html'), htmlContent, 'utf8');
  console.log(`[PREVIEW] Gallery generated at: ${path.join(previewDir, 'index.html')}`);
}

generatePreviews().catch(err => {
  console.error('Error generating previews:', err);
  process.exit(1);
});

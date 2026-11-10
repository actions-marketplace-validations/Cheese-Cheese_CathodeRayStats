import { VT323_FONT_BASE64 } from './font-base64';
import { ThemeConfig, UserStats } from './types';

/**
 * Escapes characters for safe inclusion inside SVG XML.
 */
export function escapeXml(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats a number with thousands separators (e.g. 1,234).
 */
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Word wraps text into maxLines with maxCharsPerLine.
 */
export function wrapText(text: string, maxCharsPerLine: number = 34, maxLines: number = 3): string[] {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (lines.length >= maxLines) break;

    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      if (lines.length < maxLines) {
        if (word.length > maxCharsPerLine) {
          currentLine = word.slice(0, maxCharsPerLine - 3) + '...';
        } else {
          currentLine = word;
        }
      } else {
        currentLine = '';
        break;
      }
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (lines.length === maxLines && words.length > 0) {
    const totalChars = lines.join(' ').length;
    if (text.length > totalChars + 3) {
      let last = lines[maxLines - 1];
      if (last.length > maxCharsPerLine - 3) {
        last = last.slice(0, maxCharsPerLine - 3);
      }
      lines[maxLines - 1] = `${last.replace(/\.*$/, '')}...`;
    }
  }

  return lines;
}

/**
 * Generates segmented phosphor bar ticks
 */
export function generateSegmentedBar(percentage: number, totalSegments: number = 18): { filled: number; empty: number } {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filled = Math.round((clamped / 100) * totalSegments);
  return {
    filled,
    empty: Math.max(0, totalSegments - filled),
  };
}

/**
 * Renders the entire standalone animated Retro CRT TV SVG.
 */
export function renderRetroTvSvg(stats: UserStats, config: ThemeConfig): string {
  const { screen, tv, tvStyle, showAntennas, channelDuration, channel, username, badgeLabel, knobType = 'line' } = config;
  const isAnimated = channel === 'all';
  const totalDuration = channelDuration * 4;
  const badgeText = badgeLabel && badgeLabel.trim().length > 0
    ? badgeLabel.trim()
    : `@${username.toUpperCase()}`;

  const cabinetRx = tvStyle === 'trinitron' ? 12 : 30;

  const viewBoxY = showAntennas ? -85 : 0;
  const viewBoxHeight = showAntennas ? 585 : 500;
  const viewBoxWidth = 800;

  // Screen inner box
  const screenX = 46;
  const screenY = 44;
  const screenW = 526;
  const screenH = 412;

  // Dual CRT V-Sync Tracking Bars (Randomized parameters on each run)
  // Rect 1: 4% to 8% of screen height, 7s to 10s duration
  const h1Pct = 4 + Math.random() * 4;
  const vsyncH1 = Math.round((screenH * h1Pct) / 100);
  const vsyncDur1 = (7 + Math.random() * 3).toFixed(2);
  const vsyncDelay1 = (Math.random() * -3).toFixed(2);

  // Rect 2: 10% to 15% of screen height, 12s to 18s duration
  const h2Pct = 10 + Math.random() * 5;
  const vsyncH2 = Math.round((screenH * h2Pct) / 100);
  const vsyncDur2 = (12 + Math.random() * 6).toFixed(2);
  const vsyncDelay2 = (-5 - Math.random() * 5).toFixed(2);

  // Knobs coordinates
  const knobCenterX = 684;
  const chKnobCenterY = 118;
  const volKnobCenterY = 224;

  const channelAngles: Record<string, number> = {
    '1': -45,
    '2': -15,
    '3': 15,
    '4': 45,
  };
  const staticKnobAngle = channel !== 'all' ? (channelAngles[channel] ?? -45) : -45;

  const weeksToDisplay = stats.activityWeeks.slice(-26);
  let totalIn26Weeks = 0;
  weeksToDisplay.forEach(w => {
    w.contributionDays.forEach(d => {
      totalIn26Weeks += d.contributionCount;
    });
  });

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'FOURTH_QUARTILE':
        return { fill: screen.bright, opacity: '1.0', filter: 'url(#glow)' };
      case 'THIRD_QUARTILE':
        return { fill: screen.primary, opacity: '0.90', filter: 'none' };
      case 'SECOND_QUARTILE':
        return { fill: screen.primary, opacity: '0.65', filter: 'none' };
      case 'FIRST_QUARTILE':
        return { fill: screen.primary, opacity: '0.40', filter: 'none' };
      case 'NONE':
      default:
        return { fill: screen.dim, opacity: '0.25', filter: 'none' };
    }
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}" width="100%" height="100%">
  <defs>
    <style>
      @font-face {
        font-family: 'VT323';
        font-style: normal;
        font-weight: 400;
        src: url('data:font/woff2;base64,${VT323_FONT_BASE64}') format('woff2');
      }

      * {
        box-sizing: border-box;
      }

      .crt-text {
        font-family: 'VT323', monospace;
        letter-spacing: 0.5px;
        text-rendering: geometricPrecision;
      }

      .glow {
        filter: url(#glow);
      }

      .dim-glow {
        filter: url(#subtle-glow);
      }

      @keyframes led-pulse {
        0%, 100% { opacity: 0.95; }
        50% { opacity: 0.35; }
      }
      .power-led {
        animation: led-pulse 3s ease-in-out infinite;
      }

      /* Dual CRT V-Sync Tracking Bars Roll */
      @keyframes vsync-roll-1 {
        0% { transform: translateY(0); }
        100% { transform: translateY(${screenH + vsyncH1 * 2}px); }
      }

      @keyframes vsync-roll-2 {
        0% { transform: translateY(0); }
        100% { transform: translateY(${screenH + vsyncH2 * 2}px); }
      }

      .vsync-bar-1 {
        animation: vsync-roll-1 ${vsyncDur1}s linear ${vsyncDelay1}s infinite;
      }

      .vsync-bar-2 {
        animation: vsync-roll-2 ${vsyncDur2}s linear ${vsyncDelay2}s infinite;
      }

      ${isAnimated ? `
      @keyframes cycle-ch1 {
        0% { opacity: 1; visibility: visible; }
        24.4% { opacity: 1; }
        25% { opacity: 0; visibility: hidden; }
        99.4% { opacity: 0; }
        100% { opacity: 1; visibility: visible; }
      }

      @keyframes cycle-ch2 {
        0%, 24.4% { opacity: 0; visibility: hidden; }
        25% { opacity: 1; visibility: visible; }
        49.4% { opacity: 1; }
        50% { opacity: 0; visibility: hidden; }
        100% { opacity: 0; visibility: hidden; }
      }

      @keyframes cycle-ch3 {
        0%, 49.4% { opacity: 0; visibility: hidden; }
        50% { opacity: 1; visibility: visible; }
        74.4% { opacity: 1; }
        75% { opacity: 0; visibility: hidden; }
        100% { opacity: 0; visibility: hidden; }
      }

      @keyframes cycle-ch4 {
        0%, 74.4% { opacity: 0; visibility: hidden; }
        75% { opacity: 1; visibility: visible; }
        99.4% { opacity: 1; }
        100% { opacity: 0; visibility: hidden; }
      }

      .ch-1 { animation: cycle-ch1 ${totalDuration}s infinite; }
      .ch-2 { animation: cycle-ch2 ${totalDuration}s infinite; }
      .ch-3 { animation: cycle-ch3 ${totalDuration}s infinite; }
      .ch-4 { animation: cycle-ch4 ${totalDuration}s infinite; }

      @keyframes channel-glitch {
        0%, 24.5%, 25.5%, 49.5%, 50.5%, 74.5%, 75.5%, 99.5%, 100% {
          opacity: 0;
          transform: scaleY(1);
        }
        24.7%, 49.7%, 74.7%, 99.7% {
          opacity: 0.7;
          transform: scaleY(0.97);
        }
        24.9%, 49.9%, 74.9%, 99.9% {
          opacity: 0.85;
          transform: scaleY(0.94);
        }
      }

      .static-flash {
        animation: channel-glitch ${totalDuration}s infinite;
        transform-origin: center;
      }

      @keyframes rotate-knob {
        0%, 23.5% { transform: rotate(-45deg); }
        25%, 48.5% { transform: rotate(-15deg); }
        50%, 73.5% { transform: rotate(15deg); }
        75%, 98.5% { transform: rotate(45deg); }
        100% { transform: rotate(-45deg); }
      }

      .knob-marker-ch {
        transform-box: fill-box;
        transform-origin: center;
        animation: rotate-knob ${totalDuration}s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }
      ` : `
      .ch-1 { display: ${channel === '1' ? 'block' : 'none'}; }
      .ch-2 { display: ${channel === '2' ? 'block' : 'none'}; }
      .ch-3 { display: ${channel === '3' ? 'block' : 'none'}; }
      .ch-4 { display: ${channel === '4' ? 'block' : 'none'}; }
      .static-flash { display: none; }
      .knob-marker-ch {
        transform-box: fill-box;
        transform-origin: center;
        transform: rotate(${staticKnobAngle}deg);
      }
      `}
    </style>

    <!-- Phosphor Glow Filter -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.0" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <filter id="subtle-glow" x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur stdDeviation="0.9" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Subtle Static Noise Filter (Light analog CRT grain) -->
    <filter id="crt-static" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" result="noise" />
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.055 0" />
    </filter>

    <!-- Scanline Overlay Pattern (Light, non-obtrusive) -->
    <pattern id="scanlines" width="100" height="4" patternUnits="userSpaceOnUse">
      <line x1="0" y1="2" x2="100" y2="2" stroke="#000000" stroke-opacity="0.18" stroke-width="1.4" />
    </pattern>

    <!-- CRT Curved Glass Vignette (Softened edges, bright corners) -->
    <radialGradient id="crt-vignette" cx="50%" cy="50%" r="58%">
      <stop offset="75%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="94%" stop-color="#000000" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.45"/>
    </radialGradient>

    <!-- TV Bezel Shadow Gradient -->
    <linearGradient id="inner-bezel-shadow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.25"/>
      <stop offset="8%" stop-color="#000000" stop-opacity="0.05"/>
      <stop offset="95%" stop-color="#000000" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.30"/>
    </linearGradient>

    <!-- TV Cabinet Outer Boundary Clip -->
    <clipPath id="cabinet-clip">
      <rect x="18" y="18" width="764" height="464" rx="${cabinetRx}" />
    </clipPath>

    <!-- TV Cabinet 3D Bevel Gradient -->
    <linearGradient id="cabinet-bevel" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${tv.bezelLight}" stop-opacity="0.8"/>
      <stop offset="12%" stop-color="${tv.bezelLight}" stop-opacity="0.2"/>
      <stop offset="85%" stop-color="${tv.bezelDark}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${tv.bezelDark}" stop-opacity="0.9"/>
    </linearGradient>

    <!-- Metallic Knob Gradient -->
    <linearGradient id="metallic-dial" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4B5563"/>
      <stop offset="35%" stop-color="#1F2937"/>
      <stop offset="70%" stop-color="#374151"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>

    <!-- Knob Rim Gradient -->
    <radialGradient id="knob-rim">
      <stop offset="75%" stop-color="#1E232A"/>
      <stop offset="95%" stop-color="#0D1015"/>
      <stop offset="100%" stop-color="#374151"/>
    </radialGradient>

    <!-- Static Flash Gradient -->
    <linearGradient id="static-flash-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${screen.bright}" stop-opacity="0.35"/>
      <stop offset="48%" stop-color="${screen.primary}" stop-opacity="0.75"/>
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.9"/>
      <stop offset="52%" stop-color="${screen.primary}" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="${screen.bright}" stop-opacity="0.35"/>
    </linearGradient>
  </defs>

  <!-- RABBIT-EAR ANTENNAS (Optional) -->
  ${showAntennas ? `
  <g id="antennas">
    <ellipse cx="280" cy="18" rx="28" ry="8" fill="${tv.bezelDark}" stroke="${tv.bezelLight}" stroke-width="1.5" />
    <ellipse cx="280" cy="14" rx="20" ry="5" fill="#3A3F47" />
    <circle cx="280" cy="12" r="5" fill="#5A626E" />
    <line x1="274" y1="12" x2="175" y2="-70" stroke="#717D8A" stroke-width="4.5" stroke-linecap="round" />
    <line x1="274" y1="12" x2="175" y2="-70" stroke="#A0AAB5" stroke-width="1.5" stroke-linecap="round" />
    <circle cx="175" cy="-70" r="4.5" fill="#C5CED6" />
    <line x1="286" y1="12" x2="385" y2="-70" stroke="#717D8A" stroke-width="4.5" stroke-linecap="round" />
    <line x1="286" y1="12" x2="385" y2="-70" stroke="#A0AAB5" stroke-width="1.5" stroke-linecap="round" />
    <circle cx="385" cy="-70" r="4.5" fill="#C5CED6" />
  </g>
  ` : ''}

  <!-- RUBBER FEET -->
  <g id="rubber-feet">
    <path d="M 120 482 L 150 482 L 145 496 L 125 496 Z" fill="#0E1114" />
    <path d="M 640 482 L 670 482 L 665 496 L 645 496 Z" fill="#0E1114" />
  </g>

  <!-- TV CHASSIS CABINET -->
  <g id="cabinet">
    <!-- Outer Cabinet Body (Clipped to prevent any bevel corner leak) -->
    <g clip-path="url(#cabinet-clip)">
      <rect x="18" y="18" width="764" height="464" rx="${cabinetRx}" fill="${tv.body}" />
      <!-- Top Bevel Highlight (Clipped) -->
      <rect x="18" y="18" width="764" height="22" fill="${tv.bezelLight}" opacity="0.35" />
      <!-- Bottom Drop Shadow Lip (Clipped) -->
      <rect x="18" y="460" width="764" height="22" fill="${tv.bezelDark}" opacity="0.65" />
      <!-- Subtle Bevel Inset Stroke -->
      <rect x="18" y="18" width="764" height="464" rx="${cabinetRx}" fill="none" stroke="url(#cabinet-bevel)" stroke-width="4" />
    </g>
    <!-- Outer Bezel Border -->
    <rect x="18" y="18" width="764" height="464" rx="${cabinetRx}" fill="none" stroke="${tv.bezelDark}" stroke-width="3.5" />
  </g>

  <!-- CRT SCREEN RECESS & FRAME -->
  <g id="screen-frame">
    <rect x="34" y="32" width="550" height="436" rx="22" fill="${tv.bezelDark}" />
    <rect x="36" y="34" width="546" height="432" rx="20" fill="#0A0C0E" stroke="${tv.bezelLight}" stroke-width="1.5" stroke-opacity="0.25" />
    <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" rx="14" fill="${screen.bg}" />
  </g>

  <!-- CRT CHANNELS CONTENT -->
  <g id="screen-viewport" clip-path="url(#screen-clip)">
    <clipPath id="screen-clip">
      <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" rx="14" />
    </clipPath>

    <!-- Base CRT Phosphor Background -->
    <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" fill="${screen.bg}" />

    <!-- CHANNEL 01: STATS -->
    <g class="ch ch-1">
      <!-- Top Status Bar (Clean, no CH01) -->
      <text x="68" y="80" class="crt-text glow" fill="${screen.bright}" font-size="26" font-weight="bold">SYSTEM STATS</text>
      <!-- Live Status Indicator on Top Right -->
      <circle cx="538" cy="73" r="4" fill="${screen.bright}" class="glow" />
      <text x="526" y="80" class="crt-text" fill="${screen.dim}" font-size="16" text-anchor="end">SIGNAL ACTIVE</text>
      <line x1="68" y1="94" x2="548" y2="94" stroke="${screen.dim}" stroke-width="1.5" stroke-opacity="0.5" />

      <!-- Row 1: Contributions -->
      <g transform="translate(68, 126)">
        <text x="0" y="24" class="crt-text" fill="${screen.dim}" font-size="22" font-weight="bold">CONTRIBUTIONS</text>
        <line x1="170" y1="18" x2="330" y2="18" stroke="${screen.dim}" stroke-dasharray="3,4" stroke-opacity="0.35" />
        <text x="480" y="26" class="crt-text glow" fill="${screen.bright}" font-size="34" font-weight="bold" text-anchor="end">${formatNumber(stats.totalContributions)}</text>
      </g>
      <line x1="68" y1="174" x2="548" y2="174" stroke="${screen.dim}" stroke-width="1" stroke-opacity="0.3" />

      <!-- Row 2: Commits -->
      <g transform="translate(68, 200)">
        <text x="0" y="24" class="crt-text" fill="${screen.dim}" font-size="22" font-weight="bold">COMMITS</text>
        <line x1="120" y1="18" x2="330" y2="18" stroke="${screen.dim}" stroke-dasharray="3,4" stroke-opacity="0.35" />
        <text x="480" y="26" class="crt-text glow" fill="${screen.bright}" font-size="34" font-weight="bold" text-anchor="end">${formatNumber(stats.totalCommits)}</text>
      </g>
      <line x1="68" y1="248" x2="548" y2="248" stroke="${screen.dim}" stroke-width="1" stroke-opacity="0.3" />

      <!-- Row 3: Pull Requests -->
      <g transform="translate(68, 274)">
        <text x="0" y="24" class="crt-text" fill="${screen.dim}" font-size="22" font-weight="bold">PULL REQUESTS</text>
        <line x1="170" y1="18" x2="330" y2="18" stroke="${screen.dim}" stroke-dasharray="3,4" stroke-opacity="0.35" />
        <text x="480" y="26" class="crt-text glow" fill="${screen.bright}" font-size="34" font-weight="bold" text-anchor="end">${formatNumber(stats.totalPullRequests)}</text>
      </g>
      <line x1="68" y1="322" x2="548" y2="322" stroke="${screen.dim}" stroke-width="1" stroke-opacity="0.3" />

      <!-- Row 4: Followers -->
      <g transform="translate(68, 348)">
        <text x="0" y="24" class="crt-text" fill="${screen.dim}" font-size="22" font-weight="bold">FOLLOWERS</text>
        <line x1="130" y1="18" x2="330" y2="18" stroke="${screen.dim}" stroke-dasharray="3,4" stroke-opacity="0.35" />
        <text x="480" y="26" class="crt-text glow" fill="${screen.bright}" font-size="34" font-weight="bold" text-anchor="end">${formatNumber(stats.followers)}</text>
      </g>

      <!-- Bottom Signal Banner -->
      <g transform="translate(68, 418)">
        <text x="0" y="16" class="crt-text" fill="${screen.dim}" font-size="17">STATUS: ON AIR</text>
        <text x="480" y="16" class="crt-text" fill="${screen.dim}" font-size="17" text-anchor="end">FEED: 100% ONLINE</text>
      </g>
    </g>

    <!-- CHANNEL 02: LANGUAGES -->
    <g class="ch ch-2">
      <!-- Top Status Bar (Clean, no CH02) -->
      <text x="68" y="80" class="crt-text glow" fill="${screen.bright}" font-size="26" font-weight="bold">TOP LANGUAGES</text>
      <line x1="68" y1="94" x2="548" y2="94" stroke="${screen.dim}" stroke-width="1.5" stroke-opacity="0.5" />

      <!-- Language Bars (Top 5) -->
      ${stats.languages.slice(0, 5).map((lang, idx) => {
        const rowY = 126 + idx * 54;
        const bar = generateSegmentedBar(lang.percentage, 18);
        const nameClean = (lang.name || 'OTHER').toUpperCase().slice(0, 10).padEnd(10, ' ');
        const percentStr = `${Math.round(lang.percentage)}%`.padStart(4, ' ');

        return `
        <g transform="translate(68, ${rowY})">
          <!-- Language Name -->
          <text x="0" y="20" class="crt-text" fill="${screen.primary}" font-size="22" font-weight="bold">${escapeXml(nameClean)}</text>
          
          <!-- Segmented Phosphor Bar -->
          <g transform="translate(130, 4)">
            ${Array.from({ length: 18 }).map((_, segIdx) => {
              const segX = segIdx * 16;
              const isFilled = segIdx < bar.filled;
              const segFill = isFilled ? (segIdx > 14 ? screen.bright : screen.primary) : screen.dim;
              const segOpacity = isFilled ? (segIdx > 14 ? '1.0' : '0.90') : '0.22';
              const filterAttr = isFilled && segIdx > 14 ? 'filter="url(#glow)"' : '';
              return `<rect x="${segX}" y="0" width="12" height="20" rx="2" fill="${segFill}" opacity="${segOpacity}" ${filterAttr} />`;
            }).join('')}
          </g>

          <!-- Percentage -->
          <text x="480" y="20" class="crt-text glow" fill="${screen.bright}" font-size="24" font-weight="bold" text-anchor="end">${percentStr}</text>
        </g>
        <line x1="68" y1="${rowY + 36}" x2="548" y2="${rowY + 36}" stroke="${screen.dim}" stroke-width="1" stroke-opacity="0.25" />
        `;
      }).join('')}

      <!-- Bottom Legend -->
      <g transform="translate(68, 418)">
        <text x="0" y="16" class="crt-text" fill="${screen.dim}" font-size="17">CODE SPECTRUM ANALYZER</text>
        <text x="480" y="16" class="crt-text" fill="${screen.dim}" font-size="17" text-anchor="end">TOTAL: 100%</text>
      </g>
    </g>

    <!-- CHANNEL 03: NOW SHOWING (FEATURED REPO) -->
    <g class="ch ch-3">
      <!-- Top Status Bar (Clean, no CH03) -->
      <text x="68" y="80" class="crt-text glow" fill="${screen.bright}" font-size="26" font-weight="bold">NOW SHOWING</text>
      <text x="548" y="80" class="crt-text" fill="${screen.dim}" font-size="16" text-anchor="end">SPOTLIGHT</text>
      <line x1="68" y1="94" x2="548" y2="94" stroke="${screen.dim}" stroke-width="1.5" stroke-opacity="0.5" />

      <!-- Repository Banner Box -->
      <rect x="68" y="112" width="480" height="74" rx="6" fill="${screen.dim}" fill-opacity="0.14" stroke="${screen.dim}" stroke-width="1.5" stroke-opacity="0.4" />
      
      <!-- Repo Name Tag -->
      <text x="86" y="136" class="crt-text" fill="${screen.dim}" font-size="16" font-weight="bold">FEATURED REPOSITORY</text>
      <text x="86" y="170" class="crt-text glow" fill="${screen.bright}" font-size="32" font-weight="bold">${escapeXml(stats.featuredRepo.name.toUpperCase())}</text>

      <!-- Description Block -->
      <g transform="translate(68, 214)">
        <text x="0" y="16" class="crt-text" fill="${screen.dim}" font-size="16" font-weight="bold">SYNOPSIS / LOG:</text>
        ${(() => {
          const lines = wrapText(stats.featuredRepo.description || 'No description available for this repository.', 35, 3);
          return lines.map((line, lIdx) => {
            return `<text x="0" y="${46 + lIdx * 28}" class="crt-text" fill="${screen.primary}" font-size="22">${escapeXml(line)}</text>`;
          }).join('');
        })()}
      </g>

      <!-- Bottom Metadata Bar -->
      <g transform="translate(68, 342)">
        <rect x="0" y="0" width="480" height="52" rx="6" fill="${screen.dim}" fill-opacity="0.14" stroke="${screen.dim}" stroke-width="1.5" stroke-opacity="0.4" />
        
        <!-- Star Icon & Count -->
        <g transform="translate(20, 16)">
          <polygon points="9,0 12,6 18,7 13.5,12 15,18 9,14.5 3,18 4.5,12 0,7 6,6" fill="${screen.bright}" class="glow" />
          <text x="28" y="15" class="crt-text glow" fill="${screen.bright}" font-size="22" font-weight="bold">${formatNumber(stats.featuredRepo.stars)} STARS</text>
        </g>

        <!-- Fork Icon & Count -->
        <g transform="translate(200, 16)">
          <circle cx="4" cy="4" r="3" fill="${screen.primary}" />
          <circle cx="16" cy="4" r="3" fill="${screen.primary}" />
          <circle cx="10" cy="15" r="3" fill="${screen.primary}" />
          <path d="M 4 4 L 4 8 Q 4 11 10 11 L 10 15 M 16 4 L 16 8 Q 16 11 10 11" fill="none" stroke="${screen.primary}" stroke-width="2" />
          <text x="28" y="15" class="crt-text" fill="${screen.primary}" font-size="22" font-weight="bold">${formatNumber(stats.featuredRepo.forks)} FORKS</text>
        </g>

        <!-- Primary Language Tag -->
        ${stats.featuredRepo.primaryLanguage ? `
        <g transform="translate(370, 16)">
          <text x="94" y="15" class="crt-text glow" fill="${screen.bright}" font-size="20" font-weight="bold" text-anchor="end">${escapeXml(stats.featuredRepo.primaryLanguage.toUpperCase())}</text>
        </g>
        ` : ''}
      </g>

      <!-- Bottom Channel Footer -->
      <g transform="translate(68, 418)">
        <text x="0" y="16" class="crt-text" fill="${screen.dim}" font-size="17">STATUS: ARCHIVED</text>
        <text x="480" y="16" class="crt-text" fill="${screen.dim}" font-size="17" text-anchor="end">RATING: 5.0 / 5.0</text>
      </g>
    </g>

    <!-- CHANNEL 04: ACTIVITY (CONTRIBUTION HEATMAP) -->
    <g class="ch ch-4">
      <!-- Top Status Bar (Clean, no CH04) -->
      <text x="68" y="80" class="crt-text glow" fill="${screen.bright}" font-size="26" font-weight="bold">TRANSMISSION ACTIVITY</text>
      <line x1="68" y1="94" x2="548" y2="94" stroke="${screen.dim}" stroke-width="1.5" stroke-opacity="0.5" />

      <!-- Days of Week Indicator Column (Left) -->
      <g transform="translate(68, 126)">
        <text x="0" y="24" class="crt-text" fill="${screen.dim}" font-size="16" font-weight="bold">MON</text>
        <text x="0" y="52" class="crt-text" fill="${screen.dim}" font-size="16" font-weight="bold">WED</text>
        <text x="0" y="80" class="crt-text" fill="${screen.dim}" font-size="16" font-weight="bold">FRI</text>
      </g>

      <!-- 26-Week x 7-Day Activity Grid -->
      <g transform="translate(104, 112)">
        ${weeksToDisplay.map((week, wIdx) => {
          const colX = wIdx * 17;
          return week.contributionDays.map((day, dIdx) => {
            const rowY = dIdx * 14;
            const style = getLevelStyle(day.contributionLevel);
            const filterAttr = style.filter !== 'none' ? `filter="${style.filter}"` : '';
            return `<rect x="${colX}" y="${rowY}" width="13.5" height="10" rx="2" fill="${style.fill}" opacity="${style.opacity}" ${filterAttr}><title>${escapeXml(day.date)}: ${day.contributionCount} contributions</title></rect>`;
          }).join('');
        }).join('')}
      </g>

      <!-- Heatmap Density Legend -->
      <g transform="translate(104, 238)">
        <text x="0" y="12" class="crt-text" fill="${screen.dim}" font-size="16" font-weight="bold">LESS</text>
        <g transform="translate(44, 1)">
          <rect x="0" y="0" width="13.5" height="10" rx="2" fill="${screen.dim}" opacity="0.25" />
          <rect x="17" y="0" width="13.5" height="10" rx="2" fill="${screen.primary}" opacity="0.40" />
          <rect x="34" y="0" width="13.5" height="10" rx="2" fill="${screen.primary}" opacity="0.65" />
          <rect x="51" y="0" width="13.5" height="10" rx="2" fill="${screen.primary}" opacity="0.90" />
          <rect x="68" y="0" width="13.5" height="10" rx="2" fill="${screen.bright}" opacity="1.0" filter="url(#glow)" />
        </g>
        <text x="138" y="12" class="crt-text" fill="${screen.dim}" font-size="16" font-weight="bold">MORE</text>
      </g>

      <!-- 26 Weeks Contribution Banner -->
      <g transform="translate(68, 280)">
        <rect x="0" y="0" width="480" height="90" rx="6" fill="${screen.dim}" fill-opacity="0.14" stroke="${screen.dim}" stroke-width="1.5" stroke-opacity="0.4" />
        <text x="240" y="36" class="crt-text dim-glow" fill="${screen.primary}" font-size="20" font-weight="bold" text-anchor="middle">PAST 26 WEEKS RADAR</text>
        <text x="240" y="70" class="crt-text glow" fill="${screen.bright}" font-size="34" font-weight="bold" text-anchor="middle">${formatNumber(totalIn26Weeks)} CONTRIBUTIONS</text>
      </g>

      <!-- Bottom Channel Footer -->
      <g transform="translate(68, 418)">
        <text x="0" y="16" class="crt-text" fill="${screen.dim}" font-size="17">TEMPORAL RADAR FREQ: 6 MOS</text>
        <text x="480" y="16" class="crt-text" fill="${screen.dim}" font-size="17" text-anchor="end">STATUS: SYNCHRONIZED</text>
      </g>
    </g>

    <!-- DUAL CRT V-SYNC TRACKING BARS (Layered above stats/text, below glass glare & CRT filters) -->
    <rect class="vsync-bar-1" x="${screenX}" y="${screenY - vsyncH1 * 2}" width="${screenW}" height="${vsyncH1}" fill="rgba(0, 0, 0, 0.15)" pointer-events="none" />
    <rect class="vsync-bar-2" x="${screenX}" y="${screenY - vsyncH2 * 2}" width="${screenW}" height="${vsyncH2}" fill="rgba(0, 0, 0, 0.15)" pointer-events="none" />

    <!-- Light Static Grain Filter Overlay -->
    <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" filter="url(#crt-static)" opacity="0.6" pointer-events="none" />

    <!-- Analog Static Flash Transition Glitch Overlay -->
    <rect class="static-flash" x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" fill="url(#static-flash-grad)" pointer-events="none" />

    <!-- Light CRT Scanline Pattern Overlay -->
    <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" fill="url(#scanlines)" pointer-events="none" />

    <!-- Softened Curved Glass Vignette -->
    <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" rx="14" fill="url(#crt-vignette)" pointer-events="none" />

    <!-- Soft Glass Reflection Highlight -->
    <path d="M 52 50 L 260 50 L 52 260 Z" fill="#FFFFFF" opacity="0.025" pointer-events="none" />
  </g>

  <!-- Inner Bezel Drop Shadow Overlay -->
  <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" rx="14" fill="url(#inner-bezel-shadow)" pointer-events="none" stroke="${tv.bezelDark}" stroke-width="3" />

  <!-- CONTROL PANEL (RIGHT ~24%) -->
  <g id="control-panel">
    <line x1="592" y1="26" x2="592" y2="474" stroke="${tv.bezelDark}" stroke-width="2.5" />
    <line x1="594" y1="26" x2="594" y2="474" stroke="${tv.bezelLight}" stroke-width="1" stroke-opacity="0.3" />

    <!-- CH ROTARY KNOB -->
    <g id="knob-ch">
      <circle cx="${knobCenterX}" cy="${chKnobCenterY}" r="38" fill="url(#knob-rim)" stroke="${tv.bezelDark}" stroke-width="2" />
      
      <line x1="${knobCenterX - 34}" y1="${chKnobCenterY - 34}" x2="${knobCenterX - 28}" y2="${chKnobCenterY - 28}" stroke="${tv.labelColor}" stroke-width="2" stroke-linecap="round" opacity="0.8" />
      <line x1="${knobCenterX - 15}" y1="${chKnobCenterY - 44}" x2="${knobCenterX - 12}" y2="${chKnobCenterY - 37}" stroke="${tv.labelColor}" stroke-width="2" stroke-linecap="round" opacity="0.8" />
      <line x1="${knobCenterX + 15}" y1="${chKnobCenterY - 44}" x2="${knobCenterX + 12}" y2="${chKnobCenterY - 37}" stroke="${tv.labelColor}" stroke-width="2" stroke-linecap="round" opacity="0.8" />
      <line x1="${knobCenterX + 34}" y1="${chKnobCenterY - 34}" x2="${knobCenterX + 28}" y2="${chKnobCenterY - 28}" stroke="${tv.labelColor}" stroke-width="2" stroke-linecap="round" opacity="0.8" />

      <!-- Rotating Inner Dial with Pointer -->
      <g transform="translate(${knobCenterX}, ${chKnobCenterY})">
        <g class="knob-marker-ch">
          <!-- Inner Metallic Cap (Rotates with dial) -->
          <circle cx="0" cy="0" r="26" fill="url(#metallic-dial)" stroke="#111827" stroke-width="1.5" />
          <circle cx="0" cy="0" r="25" fill="none" stroke="${tv.bezelLight}" stroke-width="0.8" opacity="0.4" />

          ${knobType === 'dot' ? `
          <!-- Glowing Pointer Dot -->
          <circle cx="0" cy="-17" r="3.5" fill="${screen.bright}" />
          <circle cx="0" cy="-17" r="1.8" fill="#FFFFFF" />
          ` : `
          <!-- High-Contrast Pointer Line (Pure crisp stroke, matching VOLUME) -->
          <line x1="0" y1="-6" x2="0" y2="-21" stroke="${screen.bright}" stroke-width="3" stroke-linecap="round" />
          `}

          <!-- Center Rivet -->
          <circle cx="0" cy="0" r="5" fill="#1F2937" stroke="#374151" stroke-width="1" />
        </g>
      </g>
      <text x="${knobCenterX}" y="${chKnobCenterY + 54}" class="crt-text" fill="${tv.labelColor}" font-size="16" font-weight="bold" text-anchor="middle">CH SELECT</text>
    </g>

    <!-- VOL ROTARY KNOB -->
    <g id="knob-vol">
      <circle cx="${knobCenterX}" cy="${volKnobCenterY}" r="32" fill="url(#knob-rim)" stroke="${tv.bezelDark}" stroke-width="2" />
      <g transform="translate(${knobCenterX}, ${volKnobCenterY})">
        <g transform="rotate(35)">
          <circle cx="0" cy="0" r="22" fill="url(#metallic-dial)" stroke="#111827" stroke-width="1.5" />
          <circle cx="0" cy="0" r="21" fill="none" stroke="${tv.bezelLight}" stroke-width="0.8" opacity="0.4" />
          ${knobType === 'dot' ? `
          <circle cx="0" cy="-14" r="3" fill="${screen.bright}" />
          <circle cx="0" cy="-14" r="1.5" fill="#FFFFFF" />
          ` : `
          <line x1="0" y1="-5" x2="0" y2="-18" stroke="${screen.bright}" stroke-width="3" stroke-linecap="round" />
          `}
          <circle cx="0" cy="0" r="4" fill="#1F2937" stroke="#374151" stroke-width="1" />
        </g>
      </g>
      <text x="${knobCenterX}" y="${volKnobCenterY + 48}" class="crt-text" fill="${tv.labelColor}" font-size="16" font-weight="bold" text-anchor="middle">VOLUME</text>
    </g>

    <!-- SPEAKER GRILLE -->
    <g id="speaker-grille" transform="translate(624, 296)">
      ${[0, 12, 24, 36, 48, 60].map(y => `
        <rect x="0" y="${y}" width="120" height="5.5" rx="2.5" fill="${tv.bezelDark}" />
        <line x1="2" y1="${y + 5.5}" x2="118" y2="${y + 5.5}" stroke="${tv.bezelLight}" stroke-width="0.8" stroke-opacity="0.35" />
      `).join('')}
    </g>

    <!-- POWER INDICATOR LED -->
    <g id="power-led" transform="translate(684, 384)">
      <circle cx="0" cy="0" r="5" fill="#111827" stroke="${tv.bezelDark}" stroke-width="1.5" />
      <circle cx="0" cy="0" r="3" fill="${screen.bright}" class="power-led" filter="url(#glow)" />
    </g>

    <!-- USERNAME EMBOSSED BADGE -->
    <g id="badge-plate" transform="translate(684, 436)">
      <rect x="-65" y="-18" width="130" height="28" rx="4" fill="${tv.bezelDark}" stroke="${tv.bezelLight}" stroke-width="1" stroke-opacity="0.4" />
      <text x="0" y="2" class="crt-text" fill="${tv.labelColor}" font-size="16" font-weight="bold" text-anchor="middle">${escapeXml(badgeText)}</text>
    </g>
  </g>
</svg>`;
}

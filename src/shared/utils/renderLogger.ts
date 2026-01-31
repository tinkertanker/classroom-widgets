// Render logging utility for performance analysis
// Enable/disable via VITE_RENDER_LOGGING=true in .env or toggle in console

interface RenderStats {
  count: number;
  lastRenderTime: number;
  renderTimes: number[]; // Last N render timestamps for frequency analysis
}

interface RenderLoggerConfig {
  enabled: boolean;
  maxRenderTimes: number; // How many timestamps to keep per component
  logToConsole: boolean;
  groupByWidget: boolean; // Group widget-specific logs by widgetId
}

class RenderLogger {
  private stats: Map<string, RenderStats> = new Map();
  private config: RenderLoggerConfig = {
    enabled: import.meta.env.VITE_RENDER_LOGGING === 'true' || false,
    maxRenderTimes: 100,
    logToConsole: true,
    groupByWidget: true,
  };
  private sessionStart: number = Date.now();
  private dragStartTime: number | null = null;
  private dragRenderCounts: Map<string, number> = new Map();

  enable() {
    this.config.enabled = true;
    console.log('[RenderLogger] Enabled');
  }

  disable() {
    this.config.enabled = false;
    console.log('[RenderLogger] Disabled');
  }

  toggle() {
    this.config.enabled = !this.config.enabled;
    console.log(`[RenderLogger] ${this.config.enabled ? 'Enabled' : 'Disabled'}`);
  }

  isEnabled() {
    return this.config.enabled;
  }

  // Call this when drag starts
  startDragSession() {
    if (!this.config.enabled) return;
    this.dragStartTime = Date.now();
    this.dragRenderCounts.clear();
    console.log('[RenderLogger] 🎯 Drag session started');
  }

  // Call this when drag ends
  endDragSession() {
    if (!this.config.enabled || !this.dragStartTime) return;

    const duration = Date.now() - this.dragStartTime;
    const totalRenders = Array.from(this.dragRenderCounts.values()).reduce((a, b) => a + b, 0);

    console.log('[RenderLogger] 🏁 Drag session ended');
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Total renders during drag: ${totalRenders}`);
    console.log('  Renders by component:');

    const sorted = Array.from(this.dragRenderCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    sorted.forEach(([component, count]) => {
      const rate = (count / (duration / 1000)).toFixed(1);
      console.log(`    ${component}: ${count} (${rate}/sec)`);
    });

    this.dragStartTime = null;
  }

  // Log a component render
  logRender(componentName: string, props?: Record<string, any>) {
    if (!this.config.enabled) return;

    const now = Date.now();
    const key = componentName;

    // Get or create stats
    let stat = this.stats.get(key);
    if (!stat) {
      stat = { count: 0, lastRenderTime: now, renderTimes: [] };
      this.stats.set(key, stat);
    }

    // Update stats
    stat.count++;
    const timeSinceLast = now - stat.lastRenderTime;
    stat.lastRenderTime = now;
    stat.renderTimes.push(now);

    // Trim old timestamps
    if (stat.renderTimes.length > this.config.maxRenderTimes) {
      stat.renderTimes.shift();
    }

    // Track drag session renders
    if (this.dragStartTime !== null) {
      const current = this.dragRenderCounts.get(key) || 0;
      this.dragRenderCounts.set(key, current + 1);
    }

    // Console logging
    if (this.config.logToConsole) {
      const propsStr = props ? ` ${JSON.stringify(props)}` : '';
      const freqStr = timeSinceLast < 100 ? ` ⚡${timeSinceLast}ms` : '';
      console.log(`[Render] ${componentName}${propsStr}${freqStr} (#${stat.count})`);
    }
  }

  // Log a widget-specific component render
  logWidgetRender(componentName: string, widgetId: string, extra?: Record<string, any>) {
    const key = this.config.groupByWidget
      ? `${componentName}[${widgetId.slice(-4)}]`
      : componentName;
    this.logRender(key, extra);
  }

  // Get summary statistics
  getSummary() {
    const duration = (Date.now() - this.sessionStart) / 1000;
    const summary: Record<string, { count: number; rate: string; recentRate: string }> = {};

    this.stats.forEach((stat, key) => {
      // Calculate recent rate (last 5 seconds)
      const fiveSecondsAgo = Date.now() - 5000;
      const recentRenders = stat.renderTimes.filter(t => t > fiveSecondsAgo).length;
      const recentRate = (recentRenders / 5).toFixed(1);

      summary[key] = {
        count: stat.count,
        rate: (stat.count / duration).toFixed(2),
        recentRate: `${recentRate}/sec`,
      };
    });

    return {
      sessionDuration: `${duration.toFixed(1)}s`,
      components: summary,
    };
  }

  // Print summary to console
  printSummary() {
    const summary = this.getSummary();
    console.log('\n[RenderLogger] 📊 Render Summary');
    console.log(`Session duration: ${summary.sessionDuration}`);
    console.log('Components (sorted by count):');

    const sorted = Object.entries(summary.components)
      .sort((a, b) => b[1].count - a[1].count);

    sorted.forEach(([name, stats]) => {
      console.log(`  ${name}: ${stats.count} total (${stats.rate}/sec avg, ${stats.recentRate} recent)`);
    });
  }

  // Reset all statistics
  reset() {
    this.stats.clear();
    this.sessionStart = Date.now();
    this.dragStartTime = null;
    this.dragRenderCounts.clear();
    console.log('[RenderLogger] Stats reset');
  }
}

// Global singleton
export const renderLogger = new RenderLogger();

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).renderLogger = renderLogger;
}

// React hook for easy use in components
import { useRef, useEffect } from 'react';

export function useRenderLogger(componentName: string, props?: Record<string, any>) {
  const renderCount = useRef(0);
  renderCount.current++;

  useEffect(() => {
    renderLogger.logRender(componentName, props);
  });

  return renderCount.current;
}

export function useWidgetRenderLogger(componentName: string, widgetId: string, extra?: Record<string, any>) {
  const renderCount = useRef(0);
  renderCount.current++;

  useEffect(() => {
    renderLogger.logWidgetRender(componentName, widgetId, extra);
  });

  return renderCount.current;
}

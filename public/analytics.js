import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

// Initialize Vercel Web Analytics
inject({
  mode: 'production'
});

// Initialize Vercel Speed Insights
injectSpeedInsights({
  mode: 'production'
});

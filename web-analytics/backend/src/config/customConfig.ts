export const ANALYTICS_CONFIG = {
  github: {
    perPage: 100,
    maxPages: {
      commits: 10,
      pulls: 10,
      events: 3,
      branches: 2
    },
    branchCommitLookupsLimit: 50,
    timelineMaxItems: 600
  },
  extension: {
    recentTimelineLimit: 150
  }
};

// 🔧 CUSTOM CONFIG START
// (I will add things like filters, AI insights, extra metrics here)
export const CUSTOM_METRIC_FLAGS = {
  enableAiInsights: false,
  includeRawEventMetadata: true
};
// 🔧 CUSTOM CONFIG END


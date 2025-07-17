type MetricsStore = {
  user: string;
  viewed_hashtags: string[];
  viewed_profiles: string[];
  posts_liked: string[];
  posts_bookmarked: string[];
  commented_on_post: string[];
  followed_after_post_view: string[];
};

export function ProcessUserMetrics(data: MetricsStore) {
  // Process user metrics data
}


export function ProcessGeneralMetrics(data: MetricsStore) {
  // Process general metrics data
}
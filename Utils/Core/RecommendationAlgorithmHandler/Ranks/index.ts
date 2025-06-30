/**
 * @file Ranks.ts
 * @description Enumeration for ranking scores in the recommendation algorithm. Used to boost or penalize the score of a post.
 * @module Ranks
 */

/**
 * Enumeration for ranking scores.
 *
 * This enum provides various constants that are used to adjust the recommendation score of a post based on different criteria.
 * Positive values represent boosts to the score, while negative values represent penalties.
 */
export enum Ranks {
    // Score boundaries (optional, use for clamping if desired)
    minScore = -100, // Adjusted to a larger range for more granular scores
    maxScore = 100,  // Adjusted to a larger range

    // Penalties (now all negative for consistent addition)
    oldPostPenalty = -0.5,
    isNSFWPenalty = -100, // Very strong penalty, effectively hides the post
    authorMutesPenalty = -0.001, // Adjusted to be very small per mute, as it's per 100 followers
    authorBlocksPenalty = -0.002, // Adjusted similarly
    outOfGroupPenalty = -0.5,
    offTopicPenalty = -0.5,
    spamLinksPenalty = -10, // Strong penalty for spam
    misInformativePenalty = -0.5,
    grammarMistakesPenalty = -0.01,

    // Boosts (all positive for consistent addition)
    multipleHashtagsBoost = 0.05,
    likesBoost = 0.08, // per like
    crucialGovernmentAnnouncementBoost = 0.8,
    repostsBoost = 0.04, // per repost
    followedAfterViewBoost = 0.05, // per follower
    langEnglishBoost = 0.05,
    authorFollowersBoost = 0.001, // per follower (adjusted for 100s)
    hasMediaBoost = 0.1,
    hasLinkBoost = 0.1,
    hasTrendingHashtagBoost = 0.1,
    is7daysOldBoost = 0.5,
    is7daysOld, // Renamed for clarity, it's a boost for new posts
}

export default Ranks;
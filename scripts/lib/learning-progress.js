/**
 * Core logic for tracking learning progress, spaced repetition reviews, and private exercise responses.
 */

const exercises = new Map();
const reviews = new Map();

/**
 * Records an exercise response privately.
 * 
 * @param {string} topicId The curriculum topic ID.
 * @param {string} type The exercise type (prediction, tracing, modification).
 * @param {string} answer The learner's answer.
 * @param {boolean} isSessionOnly If true, response is not stored durably (simulated here by a weak or volatile store).
 */
export function recordExercise(topicId, type, answer, isSessionOnly = false) {
  if (isSessionOnly) {
    // In session-only mode, we might just validate it and throw it away
    return { ok: true, stored: false };
  }
  
  if (!exercises.has(topicId)) {
    exercises.set(topicId, []);
  }
  
  exercises.get(topicId).push({
    type,
    answer,
    timestamp: new Date().toISOString()
  });
  
  return { ok: true, stored: true };
}

/**
 * Retrieves recorded exercises for a topic.
 */
export function getExercises(topicId) {
  return exercises.get(topicId) || [];
}

/**
 * Deletes all private answers for a specific topic, leaving the lesson intact.
 */
export function deleteExercises(topicId) {
  exercises.delete(topicId);
}

/**
 * Schedules an optional review prompt for a completed lesson.
 */
export function scheduleReview(topicId, daysFromNow = 3) {
  const reviewDate = new Date();
  reviewDate.setDate(reviewDate.getDate() + daysFromNow);
  
  reviews.set(topicId, {
    scheduledFor: reviewDate.toISOString(),
    notified: false
  });
}

/**
 * Gets pending reviews that are due.
 */
export function getPendingReviews() {
  const now = new Date();
  const due = [];
  
  for (const [topicId, review] of reviews.entries()) {
    if (new Date(review.scheduledFor) <= now) {
      due.push({ topicId, ...review });
    }
  }
  
  return due;
}

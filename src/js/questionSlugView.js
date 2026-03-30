import { Quiz } from './Quiz.js';

/**
 * Returns the slug segment for /question/:slug routes, or null if the path is not that route.
 * @param {string} pathname - e.g. window.location.pathname
 * @returns {string|null}
 */
export function parseQuestionSlugFromPathname(pathname) {
    const m = pathname.match(/\/question\/([^/]+)\/?$/);
    if (!m) return null;
    try {
        return decodeURIComponent(m[1]);
    } catch {
        return null;
    }
}

/**
 * Loads synced questions and answers, resolves by slug for the standalone question page (no main Quiz.init).
 * @param {string} slug
 * @returns {Promise<{ slugQuiz: Quiz, question: import('./Question.js').Question, latestUserAnswer: import('./UserAnswer.js').UserAnswer|null }|{ notFound: true }>}
 */
export async function loadQuestionBySlug(slug) {
    const slugQuiz = new Quiz();
    await slugQuiz.loadQuestions({ skipProgressionIndex: true });
    const question = slugQuiz.questions.find((q) => q.slug === slug);
    if (!question) {
        return { notFound: true };
    }
    const latestUserAnswer = slugQuiz.getLatestUserAnswer(question.id);
    return { slugQuiz, question, latestUserAnswer };
}

/** Renders inline Markdown (bold, code, etc.) using the same marked instance as the question body. */
function renderInline(marked, text) {
    if (!text) return '';
    if (typeof marked.parseInline === 'function') {
        return marked.parseInline(text);
    }
    return marked.parse(text);
}

/** Escapes a string for use in a double-quoted HTML attribute. */
function escapeAttr(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

/**
 * Builds HTML for a single question card (shared by main quiz and /question/:slug view).
 * @param {Object} question - Question model instance
 * @param {Object|null} userAnswer - Latest UserAnswer or null
 * @param {import('marked').Marked} marked - configured marked
 * @param {{ isCurrent: boolean, slugView?: boolean, quiz?: import('./Quiz.js').Quiz }} options
 */
export function buildQuestionCardHTML(question, userAnswer, marked, options) {
    const { isCurrent, slugView = false, quiz } = options;
    const showSubmit =
        isCurrent && (slugView ? true : quiz && !quiz.isQuizCompleted());
    const showNext =
        userAnswer &&
        isCurrent &&
        userAnswer.isCorrect &&
        (slugView ? false : quiz && quiz.hasNextQuestion());

    const hintFn = slugView ? 'showHintSlug' : 'showHint';
    const submitFn = slugView ? 'handleSubmitSlug' : 'handleSubmit';
    const toggleFn = slugView ? 'toggleSubmitButtonSlug' : 'toggleSubmitButton';
    const keydownFn = slugView ? 'handleTextareaKeydownSlug' : 'handleTextareaKeydown';

    const hint0 = question.hints?.[0] ?? '';
    const hint1 = question.hints?.[1] ?? '';

    let questionHtml = `
                <div class="question-container card mb-3 ${isCurrent ? 'current' : userAnswer ? 'answered' : ''}" id="question-container-${question.id}">
                    <div class="card-header question-summary" data-bs-toggle="collapse" data-bs-target="#question-content-${question.id}">
                        <h3 class="mb-0">Question ${question.id}</h3>
                    </div>
                    <div id="question-content-${question.id}" class="collapse ${isCurrent ? 'show' : ''} question-content card-body">
                        <p class="card-text">${marked.parse(question.question)}</p>
                        <div class="answer-container mb-3">
            `;

    if (question.type === 'objective') {
        questionHtml += question.options
            .map(
                (option, index) => {
                    const letter = String.fromCharCode(65 + index);
                    return `
                    <div class="form-check">
                        <input class="form-check-input" type="radio" id="option-${question.id}-${index}" 
                            name="answer-${question.id}" value="${escapeAttr(option)}"
                            ${userAnswer && userAnswer.answer === option ? 'checked' : ''}
                            ${!isCurrent ? 'disabled' : ''}
                            onchange="${toggleFn}(${question.id})">
                        <label class="form-check-label" for="option-${question.id}-${index}">${letter}. ${renderInline(marked, option)}</label>
                    </div>
                `;
                }
            )
            .join('');
    } else {
        questionHtml += `<textarea class="form-control ${isCurrent && userAnswer && !userAnswer.isCorrect ? 'is-invalid' : ''}" id="subjective-answer-${question.id}" rows="6" 
                    ${!isCurrent ? 'disabled' : ''}
                    oninput="${toggleFn}(${question.id})"
                    onkeydown="${keydownFn}(event, ${question.id})">${userAnswer ? userAnswer.answer : ''}</textarea>`;
    }

    questionHtml += `
                        </div>
            `;

    if (showSubmit) {
        questionHtml += `
                    <div class="d-flex justify-content-between align-items-center">
                        <button class="btn btn-dark submit-btn" onclick="${submitFn}(${question.id})" id="submit-btn-${question.id}" disabled>Submit</button>
                        <div>
                            <button class="btn btn-sm btn-outline-dark hint-btn" onclick="${hintFn}(${question.id}, 0)">Hint 1</button>
                            <button class="btn btn-sm btn-outline-dark hint-btn" onclick="${hintFn}(${question.id}, 1)">Hint 2</button>
                        </div>
                    </div>
                `;
    }

    questionHtml += `
                        <div class="hint d-none mt-2" id="hint-${question.id}-0"><span class="emoji-icon">💡</span> ${renderInline(marked, hint0)}</div>
                        <div class="hint d-none mt-2" id="hint-${question.id}-1"><span class="emoji-icon">💡</span> ${renderInline(marked, hint1)}</div>
            `;

    if (userAnswer) {
        questionHtml += `
                    <div class="feedback mt-3">
                        ${userAnswer.isCorrect
                            ? `<p class="text-dark"><strong><span class="emoji-icon">✓</span> Correct!</strong>${userAnswer.grade !== undefined ? ` Grade: ${userAnswer.grade}/10` : ''}</p>`
                            : '<p class="text-dark"><strong><span class="emoji-icon">✗</span> Incorrect</strong></p>'}
                        ${(!isCurrent || userAnswer.isCorrect) && userAnswer.fullEvaluation
                            ? `
                            <div class="full-evaluation mt-2">
                                <strong>Evaluation:</strong><br>
                                ${marked.parse(userAnswer.fullEvaluation)}
                            </div>
                        `
                            : ''}
                        ${isCurrent && !userAnswer.isCorrect && userAnswer.nextHint ? `<strong>AI Suggestion:</strong> ${userAnswer.nextHint}` : ''}
                    </div>
                `;
        if (showNext) {
            questionHtml += `
                        <button class="btn btn-dark mt-3" onclick="moveToNextQuestion()">Next Question</button>
                    `;
        }
    }

    questionHtml += `
                        </div>
                    </div>
                </div>
            `;

    return questionHtml;
}

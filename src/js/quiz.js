import questionStore from './questionStore.js';

const DEFAULT_API_EVALUATE_ANSWER = 'http://localhost:3000/evaluate';

/**
 * Represents a Quiz with questions, user answers, and evaluation functionality.
 * @class
 * @example
 * const quiz = new Quiz();
 * await quiz.init();
 * const currentQuestion = quiz.getCurrentQuestion();
 * const isCorrect = await quiz.submitAnswer('User's answer');
 * if (isCorrect) {
 *     quiz.moveToNextQuestion();
 * }
 */
export class Quiz {
    /**
     * Creates a new Quiz instance.
     * @param {string} [apiEvaluateAnswer=DEFAULT_API_EVALUATE_ANSWER] - The API endpoint for evaluating subjective answers.
     */
    constructor(apiEvaluateAnswer = DEFAULT_API_EVALUATE_ANSWER) {
        this.questions = [];
        this.userAnswers = new Map();
        this.currentQuestionIndex = 0;
        this.hintCount = parseInt(localStorage.getItem('hintCount')) || 0;
        this.apiEvaluateAnswer = apiEvaluateAnswer;
    }

    /**
     * Loads questions from the server and syncs with local storage.
     * @async
     * @returns {Promise<void>}
     */
    async loadQuestions() {
        try {
            const response = await fetch('data/questions.json');
            if (!response.ok) throw new Error('Network response was not ok');
            const remoteQuestions = await response.json();
            await questionStore.init();
            this.questions = await questionStore.sync(remoteQuestions);
            console.log('Questions synced successfully');
        } catch (error) {
            console.error('Error syncing questions:', error);
            this.questions = await questionStore.getAll();
        }
        
        // Load user answers
        const savedAnswers = await questionStore.getUserAnswers();
        savedAnswers.forEach(answer => {
            this.userAnswers.set(answer.questionId, { answer: answer.answer, isCorrect: answer.isCorrect });
        });

        // Set current question index to the first unanswered question
        this.currentQuestionIndex = this.questions.findIndex(q => !this.userAnswers.has(q.id));
        if (this.currentQuestionIndex === -1) {
            this.currentQuestionIndex = this.questions.length; // All questions answered
        }
    }

    /**
     * Initializes the quiz by loading questions.
     * @async
     * @returns {Array<Object>} An array of answered question objects.
     */
    async init() {
        await this.loadQuestions();
        const answeredQuestions = this.getAnsweredQuestions();
        if(answeredQuestions.length > 0) {
            this.currentQuestionIndex = answeredQuestions.length-1;
            if(answeredQuestions[this.currentQuestionIndex]?.isCorrect) {
                this.moveToNextQuestion();
            }
        }
        console.log('Quiz ready to start');
        return answeredQuestions;
    }

    /**
     * Restarts the quiz, clearing user answers and resetting counters.
     * @async
     * @returns {Promise<void>}
     */
    async restart() {
        await questionStore.clearUserAnswers();
        this.userAnswers.clear();
        this.currentQuestionIndex = 0;
        this.hintCount = 0;
        localStorage.setItem('hintCount', this.hintCount);
    }

    /**
     * Gets the current question.
     * @returns {Object} The current question object.
     */
    getCurrentQuestion() {
        return this.questions[this.currentQuestionIndex];
    }

    /**
     * Gets the index of the current question.
     * @returns {number} The current question index.
     */
    getCurrentQuestionIndex() {
        return this.currentQuestionIndex;
    }

    /**
     * Submits an answer for the current question or a specific question if questionId is provided.
     * @async
     * @param {string} userAnswer - The user's answer to the question.
     * @param {number} [questionId] - Optional. The ID of the specific question to answer.
     * @returns {Promise<boolean>} Whether the answer is correct.
     */
    async submitAnswer(userAnswer, questionId) {
        const question = questionId ? this.questions.find(q => q.id === questionId) : this.getCurrentQuestion();
        if (!question) {
            throw new Error('Question not found');
        }
        const isCorrect = await this.checkAnswer(question, userAnswer);
        
        this.userAnswers.set(question.id, {
            answer: userAnswer,
            isCorrect: isCorrect
        });

        // Save user answer to IndexedDB
        await questionStore.updateUserAnswer(question.id, userAnswer, isCorrect);

        return isCorrect;
    }

    /**
     * Checks if the given answer is correct for the given question.
     * @async
     * @param {Object} question - The question object.
     * @param {string} userAnswer - The user's answer.
     * @returns {Promise<boolean>} Whether the answer is correct.
     */
    async checkAnswer(question, userAnswer) {
        if (question.type === 'objective') {
            const correctAnswer = question.answer.toLowerCase();
            return userAnswer.trim().toLowerCase() === correctAnswer;
        } else if (question.type === 'subjective') {
            return await this.evaluateSubjectiveAnswer(question, userAnswer);
        }
        return false;
    }

    /**
     * Evaluates a subjective answer using the API or falls back to local evaluation.
     * @async
     * @param {Object} question - The question object.
     * @param {string} userAnswer - The user's answer.
     * @returns {Promise<boolean>} Whether the answer is correct.
     */
    async evaluateSubjectiveAnswer(question, userAnswer) {
        try {
            const response = await fetch(this.apiEvaluateAnswer, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    questionId: question.id,
                    answer: userAnswer,
                }),
            });

            if (!response.ok) {
                throw new Error('API response was not ok');
            }

            const result = await response.json();
            return result.isCorrect;
        } catch (error) {
            console.error('Error evaluating subjective answer:', error);
            // Fallback to local evaluation if API call fails
            return this.localEvaluateSubjectiveAnswer(question, userAnswer);
        }
    }

    /**
     * Locally evaluates a subjective answer based on keywords and length.
     * @param {Object} question - The question object.
     * @param {string} userAnswer - The user's answer.
     * @returns {boolean} Whether the answer is considered correct.
     */
    localEvaluateSubjectiveAnswer(question, userAnswer) {
        const keywords = question.keywords || [];
        const minKeywords = question.minKeywords || 1;
        const maxLength = question.maxLength || Infinity;

        if (userAnswer.length > maxLength) {
            return false;
        }

        const matchedKeywords = keywords.filter(keyword => 
            userAnswer.toLowerCase().includes(keyword.toLowerCase())
        );

        return matchedKeywords.length >= minKeywords;
    }

    /**
     * Moves to the next question if available.
     * @returns {boolean} Whether there was a next question to move to.
     */
    moveToNextQuestion() {
        if (this.hasNextQuestion()) {
            this.currentQuestionIndex++;
            return true;
        }
        return false;
    }

    /**
     * Increments the hint count and updates local storage.
     * @returns {number} The new hint count.
     */
    incrementHintCount() {
        this.hintCount++;
        localStorage.setItem('hintCount', this.hintCount);
        return this.hintCount;
    }

    /**
     * Gets the current hint count.
     * @returns {number} The current hint count.
     */
    getHintCount() {
        return this.hintCount;
    }

    /**
     * Checks if there is a next question available.
     * @returns {boolean} Whether there is a next question.
     */
    hasNextQuestion() {
        return this.currentQuestionIndex < this.questions.length - 1;
    }

    /**
     * Updates a question with new data.
     * @async
     * @param {number} questionId - The ID of the question to update.
     * @param {Object} updates - The updates to apply to the question.
     * @returns {Promise<void>}
     */
    async updateQuestion(questionId, updates) {
        const question = this.questions.find(q => q.id === questionId);
        if (question) {
            Object.assign(question, updates);
            question.version++; // Increment local version
            await questionStore.update(question);
            console.log('Question updated locally');
        }
    }

    /**
     * Gets the current quiz progress.
     * @returns {Object} An object containing progress information.
     * @example
     * const progress = quiz.getQuizProgress();
     * console.log(progress);
     * // Output:
     * // {
     * //     currentQuestionIndex: 2,
     * //     totalQuestions: 5,
     * //     answeredQuestions: 3,
     * //     correctAnswers: 2
     * // }
     */
    getQuizProgress() {
        return {
            currentQuestionIndex: this.currentQuestionIndex,
            totalQuestions: this.questions.length,
            answeredQuestions: this.userAnswers.size,
            correctAnswers: Array.from(this.userAnswers.values()).filter(answer => answer && answer.isCorrect).length
        };
    }

    /**
     * Gets the user's answer for a specific question.
     * @async
     * @param {number} questionId - The ID of the question.
     * @returns {Promise<Object|undefined>} The user's answer object or undefined if not answered.
     * @example
     * const userAnswer = await quiz.getUserAnswer(1);
     * console.log(userAnswer);
     * // Output:
     * // {
     * //     answer: 'Paris',
     * //     isCorrect: true
     * // }
     */
    async getUserAnswer(questionId) {
        return this.userAnswers.get(questionId);
    }

    /**
     * Gets all answered questions with their user answers and correctness.
     * Sorted by question ID.
     * @returns {Array<Object>} An array of answered question objects.
     * @example
     * const answeredQuestions = quiz.getAnsweredQuestions();
     * console.log(answeredQuestions);
     * // Output:
     * // [
     * //     {
     * //         id: 1,
     * //         text: 'What is the capital of France?',
     * //         type: 'objective',
     * //         answer: 'Paris',
     * //         userAnswer: 'Paris',
     * //         isCorrect: true
     * //     }
     * // ]
     */
    getAnsweredQuestions() {
        return this.questions
            .filter(question => this.userAnswers.has(question.id))
            .map(question => {
                const userAnswer = this.userAnswers.get(question.id);
                return {
                    ...question,
                    userAnswer: userAnswer.answer,
                    isCorrect: userAnswer.isCorrect
                };
            })
            .sort((a, b) => a.id - b.id);
    }
}
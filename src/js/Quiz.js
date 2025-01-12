import { Question } from './Question.js';
import { UserAnswer } from './UserAnswer.js';

export const DEFAULT_ANSWER_EVALUATION_API = 'http://localhost:8000/evaluate';
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
 * const userAnswer = await quiz.getUserAnswer(currentQuestion.id);
 * console.log(userAnswer);
 * const answerHistory = quiz.getAnswerHistory(currentQuestion.id);
 * console.log(answerHistory);
 * const progress = quiz.getQuizProgress();
 * console.log(progress);
 * quiz.restart();
 */
export class Quiz {
    /**
     * Creates a new Quiz instance.
     * @param {Object} options - The options for the quiz.
     * @param {string} [options.answerEvaluationApi=DEFAULT_ANSWER_EVALUATION_API] - The API endpoint for evaluating subjective answers.
     */
    constructor(options = {}) {
        this.answerEvaluationApi = options.answerEvaluationApi || DEFAULT_ANSWER_EVALUATION_API;
        this.questions = [];
        this.userAnswers = new Map();
        this.currentQuestionIndex = 0;
        this.hintCount = parseInt(localStorage.getItem('hintCount')) || 0;
        this.isCompleted = false;
    }

    /**
     * Initializes the quiz by loading questions.
     * @async
     * @returns {Array<Object>} An array of answered question objects.
     */
    async init() {
        await this.loadQuestions();
        const answeredQuestions = this.getAnsweredQuestions();
        if (answeredQuestions.length > 0) {
            this.currentQuestionIndex = answeredQuestions.length - 1;
            if (answeredQuestions[this.currentQuestionIndex]?.isCorrect) {
                this.moveToNextQuestion();
            }
        }
        this.isCompleted = this.checkQuizCompletion();
        console.log('Quiz ready to start');
        return answeredQuestions;
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
            this.questions = await Question.sync(remoteQuestions);
            console.log('Questions synced successfully');
        } catch (error) {
            console.error('Error syncing questions:', error);
            this.questions = await Question.getAll();
        }
        
        // Load user answers
        const savedAnswers = await UserAnswer.getAll();
        savedAnswers.forEach(answer => {
            if (!this.userAnswers.has(answer.questionId)) {
                this.userAnswers.set(answer.questionId, []);
            }
            this.userAnswers.get(answer.questionId).push(answer);
        });

        // Set current question index to the first unanswered question
        this.currentQuestionIndex = this.questions.findIndex(q => !this.userAnswers.has(q.id));
        if (this.currentQuestionIndex === -1) {
            this.currentQuestionIndex = this.questions.length; // All questions answered
        }
    }

    /**
     * Restarts the quiz, clearing user answers and resetting counters.
     * @async
     * @returns {Promise<void>}
     */
    async restart() {
        console.log('Restarting quiz...');
        console.log('Clearing all answers...');
        await UserAnswer.clearAll();
        this.userAnswers.clear();
        this.currentQuestionIndex = 0;
        this.hintCount = 0;
        this.isCompleted = false;
        localStorage.setItem('hintCount', this.hintCount);
        console.log('Quiz state after restart:', {
            currentQuestionIndex: this.currentQuestionIndex,
            hintCount: this.hintCount,
            isCompleted: this.isCompleted,
            userAnswersSize: this.userAnswers.size
        });
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
     * @param {string} userAnswerText - The user's answer to the question.
     * @param {number} [questionId] - Optional. The ID of the specific question to answer.
     * @returns {Promise<Object>} The evaluation result.
     * @example
     * const evaluation = await quiz.submitAnswer('User's answer');
     * console.log(evaluation);
     * // Output:
     * // {
     * //     isCorrect: true,
     * //     grade: 10,
     * //     nextHint: 'Next hint',
     * //     fullEvaluation: 'Full evaluation',
     * //     confidenceScore: 0.5  
     * // }
     */
    async submitAnswer(userAnswerText, questionId) {
        const question = questionId ? this.questions.find(q => q.id === questionId) : this.getCurrentQuestion();
        if (!question) {
            throw new Error('Question not found');
        }
        const { isCorrect, grade, nextHint, fullEvaluation, confidenceScore } = await this.checkAnswer(question, userAnswerText);
        
        console.log(`Submitting answer for question ${question.id}:`, { userAnswerText, isCorrect, grade });

        const newAnswer = new UserAnswer({
            questionId: question.id,
            answer: userAnswerText,
            isCorrect,
            grade,
            nextHint,
            fullEvaluation,
            confidenceScore
        });

        if (!this.userAnswers.has(question.id)) {
            this.userAnswers.set(question.id, []);
        }
        this.userAnswers.get(question.id).push(newAnswer);

        try {
            // Save user answer to IndexedDB
            await newAnswer.save();
        } catch (error) {
            console.error('Error saving user answer:', error);
        }

        // this.isCompleted = this.checkQuizCompletion();
        console.log('Quiz completion status:', this.isCompleted);
        return { isCorrect, grade, nextHint, fullEvaluation, confidenceScore };
    }

    /**
     * Checks if the given answer is correct for the given question.
     * @async
     * @param {Object} question - The question object.
     * @param {string} userAnswerText - The user's answer.
     * @returns {Promise<Object>} The evaluation result.
     * @example
     * const evaluation = await quiz.checkAnswer(question, userAnswerText);
     * console.log(evaluation);
     * // Output:
     * // {
     * //     isCorrect: boolean,
     * //     confidenceScore: number <0,1>,
     * //     grade?: number <0,10> ,
     * //     nextHint?: string,
     * //     fullEvaluation?: string,
     * // }
     */
    async checkAnswer(question, userAnswerText) {
        if (question.type === 'objective') {
            const expectedAnswer = question.expectedAnswer?.toLowerCase();
            return { isCorrect: userAnswerText.trim().toLowerCase() === expectedAnswer, confidenceScore: 1 };
        } else if (question.type === 'subjective') {
            return await this.evaluateSubjectiveAnswer(question, userAnswerText);
        }
        return { isCorrect: false, confidenceScore: 0 };
    }

    /**
     * Evaluates a subjective answer using the API or falls back to local evaluation.
     * @async
     * @param {Object} question - The question object.
     * @param {string} userAnswer - The user's answer.
     * @returns {Promise<Object>} The evaluation result.
     * @example
     * const evaluation = await quiz.evaluateSubjectiveAnswer(question, userAnswer);
     * console.log(evaluation);
     * // Output:
     * // {
     * //     isCorrect: true,
     * //     grade: 10,
     * //     nextHint: 'Next hint',
     * //     fullEvaluation: 'Full evaluation',
     * //     confidenceScore: 0.5
     * // }
     */
    async evaluateSubjectiveAnswer(question, userAnswer) {
        try {
            const response = await fetch(this.answerEvaluationApi, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: question.question,
                    answer: userAnswer,
                }),
            });

            if (!response.ok) {
                throw new Error('API response was not ok');
            }

            const result = await response.json();
            return { isCorrect: result.isCorrect, grade: result.grade, nextHint: result.nextHint, fullEvaluation: result.fullEvaluation };
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

        return { isCorrect: matchedKeywords.length >= minKeywords, confidenceScore: (matchedKeywords.length / (2*keywords.length)) };
    }

    /**
     * Moves to the next question if available.
     * @returns {boolean} Whether there was a next question to move to.
     */
    moveToNextQuestion() {
        if (this.hasNextQuestion()) {
            this.currentQuestionIndex++;
            console.log(`Moved to next question. Current index: ${this.currentQuestionIndex}`);
            return true;
        }
        // this.isCompleted = this.checkQuizCompletion();
        console.log(`No more questions. Quiz completed: ${this.isCompleted}`);
        return false;
    }

    /**
     * Increments the hint count and updates local storage.
     * @returns {number} The new hint count.
     */
    incrementHintCount() {
        this.hintCount++;
        localStorage.setItem('hintCount', this.hintCount);
        //TODO: Increment hint count for the current question
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
            await question.save();
            console.log('Question updated locally');
        }
    }

    /**
     * Checks if the quiz is completed.
     * @returns {boolean} Whether the quiz is completed.
     */
    checkQuizCompletion() {
        return this.currentQuestionIndex >= this.questions.length - 1 && 
               this.userAnswers.has(this.questions[this.questions.length - 1].id);
    }

    /**
     * Checks if the quiz is completed.
     * @returns {boolean} Whether the quiz is completed.
     */
    isQuizCompleted() {
        return this.isCompleted;
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
        const answeredQuestions = this.userAnswers.size;
        const totalQuestions = this.questions.length;
        let totalScore = 0;
        let maxPossibleScore = 0;
        let correctAnswers = 0;

        this.questions.forEach(question => {
            const latestUserAnswer = this.getLatestUserAnswer(question.id);
            if (latestUserAnswer) {
                // Calculate score based on grade and hints used
                const grade = typeof latestUserAnswer.grade === 'number' ? latestUserAnswer.grade : (latestUserAnswer.isCorrect ? 10 : 0);
                // const hintPenalty = 0.1 * (latestUserAnswer.hintsUsed || 0); // 10% penalty per hint
                const questionScore = Math.max(0, (grade / 10));
                totalScore += questionScore;
                if (latestUserAnswer.isCorrect) {
                    correctAnswers++;
                }
            }
            maxPossibleScore += 1; // Each question is worth 1 point max
        });
        const hintPenalty = Math.min(correctAnswers*0.2, 0.1 * (this.hintCount || 0));
        const overallScore = maxPossibleScore > 0 ? Math.round(((totalScore - hintPenalty) / maxPossibleScore) * 100) : 0;

        return {
            currentQuestionIndex: this.currentQuestionIndex,
            totalQuestions: totalQuestions,
            answeredQuestions: answeredQuestions,
            correctAnswers: correctAnswers,
            totalScore: totalScore,
            maxPossibleScore: maxPossibleScore,
            overallScore: overallScore,
            hintCount: this.hintCount
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
    getLatestUserAnswer(questionId) {
        // const answers = await UserAnswer.getAllAnswersByQuestionId(questionId);
        const answers = this.userAnswers?.get(questionId);
        if (answers && answers.length > 0) {
            const mostRecentAnswer = answers[answers.length - 1];
            console.log(`Getting most recent user answer for question ${questionId}:`, mostRecentAnswer);
            return mostRecentAnswer;
        }
        console.log(`No answer found for question ${questionId}`);
        return null;
    }

    getAnswerHistory(questionId) {
        return UserAnswer.getAllAnswersByQuestionId(questionId);
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
                const userAnswer = this.userAnswers.get(question.id)[this.userAnswers.get(question.id).length - 1];
                return {
                    ...question,
                    userAnswer: userAnswer.answer,
                    isCorrect: userAnswer.isCorrect
                };
            })
            .sort((a, b) => a.id - b.id);
    }

    /**
     * Marks the quiz as completed.
     * @returns {void}
     */
    completeQuiz() {
        this.isCompleted = true;
    }

    /**
     * 
     */
    getNewQuestions(){
        
    }
}
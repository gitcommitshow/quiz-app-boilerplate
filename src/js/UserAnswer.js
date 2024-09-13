import Storage from './Storage.js';

export class UserAnswer {
    static storeName = 'userAnswers';

    constructor(questionId, answer, isCorrect, grade = undefined, nextHint = undefined, fullEvaluation = undefined, confidenceScore = undefined, hintsUsed = 0, submittedAt = new Date().toISOString()) {
        this.questionId = questionId;
        this.answer = answer;
        this.isCorrect = isCorrect;
        this.grade = grade;
        this.nextHint = nextHint;
        this.fullEvaluation = fullEvaluation;
        this.confidenceScore = confidenceScore;
        this.hintsUsed = hintsUsed;
        this.submittedAt = submittedAt;
    }

    toJSON() {
        return {
            questionId: this.questionId,
            answer: this.answer,
            isCorrect: this.isCorrect,
            grade: this.grade,
            nextHint: this.nextHint,
            fullEvaluation: this.fullEvaluation,
            confidenceScore: this.confidenceScore,
            hintsUsed: this.hintsUsed,
            submittedAt: this.submittedAt
        };
    }

    static fromJSON(json) {
        return new UserAnswer(
            json.questionId,
            json.answer,
            json.isCorrect,
            json.grade,
            json.nextHint,
            json.fullEvaluation,
            json.confidenceScore,
            json.hintsUsed,
            json.submittedAt
        );
    }

    /**
     * Save the user answer
     * @returns {Promise<void>}
     * @example
     * const userAnswer = new UserAnswer(1, '42', true, 10, null, null, null, 0, new Date().toISOString());
     * await userAnswer.save();
     * console.log('User answer saved');
     * // Output:
     * // User answer saved
     * // {
     * //     questionId: '1',
     * //     answers: [
     * //         {
     * //             questionId: '1',
     * //             answer: '42',
     * //             isCorrect: true,
     * //             grade: 10,
     * //             nextHint: null,
     * //             fullEvaluation: null,
     * //             confidenceScore: null,
     * //             hintsUsed: 0,
     * //             submittedAt: '2024-02-14T12:00:00Z'
     * //         }
     * //     ]
     * // }
     **/
    async save() {
        const existingAnswers = await Storage.getById(UserAnswer.storeName, this.questionId) || { questionId: this.questionId, answers: [] };
        existingAnswers.answers.push(this.toJSON());
        return Storage.save(UserAnswer.storeName, existingAnswers);
    }

    /**
     * Get all user answers
     * @returns {Promise<Array>} - The user answers
     * @example
     * const userAnswers = await UserAnswer.getAll();
     * console.log(userAnswers);
     * // Output:
     * // [
     * //     {
     * //         questionId: '1',
     * //         answers: [
     * //             {
     * //                 questionId: '1',
     * //                 answer: '42',
     * //                 isCorrect: true,
     * //                 grade: 10,
     * //                 nextHint: null,
     * //                 fullEvaluation: null,
     * //                 confidenceScore: null,
     * //                 hintsUsed: 0,
     * //                 submittedAt: '2024-02-14T12:00:00Z'
     * //             },
     * //             ...
     * //         ]
     * //     },
     * //     ...
     * // ]
     */
    static async getAll() {
        const userAnswers = await Storage.getAll(UserAnswer.storeName);
        return userAnswers.flatMap(ua => ua.answers.map(a => UserAnswer.fromJSON(a)));
    }

    // static async getAllAnswersByQuestionId(questionId) {
    //     const userAnswer = await Storage.getById(UserAnswer.storeName, questionId);
    //     return userAnswer ? userAnswer.answers.map(a => UserAnswer.fromJSON(a)) : [];
    // }

    static async clearAll() {
        return Storage.clearStore(UserAnswer.storeName);
    }
}
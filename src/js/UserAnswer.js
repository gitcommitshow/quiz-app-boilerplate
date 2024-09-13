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

    async save() {
        const existingAnswers = await Storage.getById(UserAnswer.storeName, this.questionId) || { questionId: this.questionId, answers: [] };
        existingAnswers.answers.push(this.toJSON());
        return Storage.save(UserAnswer.storeName, existingAnswers);
    }

    static async getAll() {
        const userAnswers = await Storage.getAll(UserAnswer.storeName);
        return userAnswers.flatMap(ua => ua.answers.map(a => UserAnswer.fromJSON(a)));
    }

    static async getAllAnswersByQuestionId(questionId) {
        const userAnswer = await Storage.getById(UserAnswer.storeName, questionId);
        return userAnswer ? userAnswer.answers.map(a => UserAnswer.fromJSON(a)) : [];
    }

    static async clearAll() {
        return Storage.clearStore(UserAnswer.storeName);
    }
}
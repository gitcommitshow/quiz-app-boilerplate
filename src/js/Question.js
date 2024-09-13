import Storage from './Storage.js';
import { UserAnswer } from './UserAnswer.js';

export class Question {
    static storeName = 'questions';

    constructor(data) {
        this.id = data.id;
        this.question = data.question;
        this.type = data.type; // 'objective' or 'subjective'
        this.hints = data.hints || [];
        this.version = data.version || 1;
        this.expectedAnswer = data.expectedAnswer || '';
        this.labels = data.labels || [];

        if (this.type === 'objective') {
            this.options = data.options || [];
        } else if (this.type === 'subjective') {
            this.keywords = data.keywords || [];
            this.minKeywords = data.minKeywords || 0;
            this.maxLength = data.maxLength || 0;
        }
    }

    toJSON() {
        const json = {
            id: this.id,
            question: this.question,
            type: this.type,
            hints: this.hints,
            version: this.version,
            expectedAnswer: this.expectedAnswer,
            labels: this.labels
        };

        if (this.type === 'objective') {
            json.options = this.options;
        } else if (this.type === 'subjective') {
            json.keywords = this.keywords;
            json.minKeywords = this.minKeywords;
            json.maxLength = this.maxLength;
        }

        return json;
    }

    // async getLatestUserAnswer() {
    //     const userAnswers = await UserAnswer.getAllAnswersByQuestionId(this.id);
    //     return userAnswers.length > 0 ? userAnswers[userAnswers.length - 1] : null;
    // }

    static fromJSON(json) {
        return new Question(json);
    }

    async save() {
        return Storage.save(Question.storeName, this.toJSON());
    }

    static async getAll() {
        const questions = await Storage.getAll(Question.storeName);
        return questions.map(q => Question.fromJSON(q));
    }

    static async getById(id) {
        const question = await Storage.getById(Question.storeName, id);
        return question ? Question.fromJSON(question) : null;
    }

    static async deleteById(id) {
        return Storage.deleteById(Question.storeName, id);
    }

    /**
     * Syncs the local questions with the remote questions
     * @param {Array} remoteQuestions - The remote questions to sync with
     * @returns {Promise<Array>} - The synced questions
     */
    static async sync(remoteQuestions) {
        const localQuestions = await this.getAll();
        const localQuestionsMap = new Map(localQuestions.map(q => [q.id, q]));
        
        for (const remoteQuestion of remoteQuestions) {
            const localQuestion = localQuestionsMap.get(remoteQuestion.id);
            if (!localQuestion || remoteQuestion.version > localQuestion.version) {
                await Question.fromJSON(remoteQuestion).save();
            }
        }
        
        return this.getAll();
    }

    static async forceRefresh(remoteQuestions) {
        await Storage.clearStore(Question.storeName);
        for (const question of remoteQuestions) {
            await Question.fromJSON(question).save();
        }
        return this.getAll();
    }
}
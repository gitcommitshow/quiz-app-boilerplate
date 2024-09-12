/**
 * Manages the storage and retrieval of quiz questions and user answers using IndexedDB.
 * @class
 */
class QuestionStore {
    /**
     * Creates an instance of QuestionStore.
     */
    constructor() {
        this.dbName = 'QuizDB';
        this.questionStoreName = 'questions';
        this.userAnswersStoreName = 'userAnswers';
        this.dbVersion = 1;
        this.db = null;
    }

    /**
     * Initializes the IndexedDB database and creates object stores if needed.
     * @returns {Promise<void>} A promise that resolves when the database is initialized.
     * @throws {Error} If there's an error opening the database.
     * @example
     * const questionStore = new QuestionStore();
     * await questionStore.init();
     */
    async init() {
        return new Promise((resolve, reject) => {
            const indexedDB =
                window.indexedDB ||
                window.mozIndexedDB ||
                window.webkitIndexedDB ||
                window.msIndexedDB ||
                window.shimIndexedDB;
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onerror = () => reject('IndexedDB open error');
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.questionStoreName)) {
                    db.createObjectStore(this.questionStoreName, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(this.userAnswersStoreName)) {
                    db.createObjectStore(this.userAnswersStoreName, { keyPath: 'questionId' });
                }
            };
        });
    }

    /**
     * Retrieves all questions from the database.
     * @returns {Promise<Array<Object>>} A promise that resolves with an array of all questions.
     * @example
     * const questions = await questionStore.getAll();
     * console.log(questions);
     * // [
     * //   { id: 1, question: "What is SQL?", ... },
     * //   { id: 2, question: "Explain JOIN in SQL", ... }
     * // ]
     */
    async getAll() {
        return this._performTransaction(this.questionStoreName, 'readonly', store => store.getAll());
    }

    /**
     * Updates a question in the database or adds it if it doesn't exist.
     * @param {Object} question - The question object to update or add.
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     * @example
     * const newQuestion = {
     *   id: 3,
     *   question: "What is a primary key?",
     *   type: "objective",
     *   options: ["Unique identifier", "Foreign key", "Index", "Constraint"],
     *   answer: "Unique identifier",
     *   version: 1
     * };
     * await questionStore.update(newQuestion);
     */
    async update(question) {
        return this._performTransaction(this.questionStoreName, 'readwrite', store => store.put(question));
    }

    /**
     * Synchronizes local questions with remote questions, updating or adding as necessary.
     * @param {Array<Object>} remoteQuestions - An array of question objects from the remote source.
     * @returns {Promise<Array<Object>>} A promise that resolves with an array of all questions after syncing.
     * @example
     * const remoteQuestions = [
     *   { id: 1, question: "What is SQL?", version: 2, ... },
     *   { id: 4, question: "Explain ACID properties", version: 1, ... }
     * ];
     * const updatedQuestions = await questionStore.sync(remoteQuestions);
     */
    async sync(remoteQuestions) {
        const localQuestions = await this.getAll();
        const localQuestionsMap = new Map(localQuestions.map(q => [q.id, q]));
        
        for (const remoteQuestion of remoteQuestions) {
            const localQuestion = localQuestionsMap.get(remoteQuestion.id);
            if (!localQuestion || remoteQuestion.version > localQuestion.version) {
                await this.update(remoteQuestion);
            }
        }
        
        return this.getAll();
    }

    /**
     * Clears all existing questions and replaces them with the provided remote questions.
     * @param {Array<Object>} remoteQuestions - An array of question objects to replace the existing ones.
     * @returns {Promise<Array<Object>>} A promise that resolves with an array of all questions after the refresh.
     * @example
     * const newQuestions = [
     *   { id: 1, question: "What is a database?", ... },
     *   { id: 2, question: "Explain normalization", ... }
     * ];
     * const refreshedQuestions = await questionStore.forceRefresh(newQuestions);
     */
    async forceRefresh(remoteQuestions) {
        await this._performTransaction(this.questionStoreName, 'readwrite', store => store.clear());
        for (const question of remoteQuestions) {
            await this.update(question);
        }
        return this.getAll();
    }

    /**
     * Retrieves all user answers from the database.
     * @returns {Promise<Array<Object>>} A promise that resolves with an array of all user answers.
     * @example
     * const userAnswers = await questionStore.getUserAnswers();
     * console.log(userAnswers);
     * // [
     * //   { questionId: 1, answer: "Structured Query Language", isCorrect: true },
     * //   { questionId: 2, answer: "To combine rows from two or more tables", isCorrect: true }
     * // ]
     */
    async getUserAnswers() {
        return this._performTransaction(this.userAnswersStoreName, 'readonly', store => store.getAll());
    }

    /**
     * Updates or adds a user answer in the database.
     * @param {number} questionId - The ID of the question being answered.
     * @param {string} answer - The user's answer to the question.
     * @param {boolean} isCorrect - Whether the answer is correct or not.
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     * @example
     * await questionStore.updateUserAnswer(3, "A unique identifier for a record", true);
     */
    async updateUserAnswer(questionId, answer, isCorrect, grade, nextHint, fullEvaluation) {
        return this._performTransaction(this.userAnswersStoreName, 'readwrite', store => 
            store.put({ questionId, answer, isCorrect, grade, nextHint, fullEvaluation })
        );
    }

    /**
     * Clears all user answers from the database.
     * @returns {Promise<void>} A promise that resolves when all user answers are cleared.
     * @example
     * await questionStore.clearUserAnswers();
     */
    async clearUserAnswers() {
        return this._performTransaction(this.userAnswersStoreName, 'readwrite', store => store.clear());
    }

    /**
     * Performs a transaction on the specified object store.
     * @private
     * @param {string} storeName - The name of the object store to perform the transaction on.
     * @param {IDBTransactionMode} mode - The mode of the transaction ('readonly' or 'readwrite').
     * @param {function} operation - The operation to perform on the object store.
     * @returns {Promise<any>} A promise that resolves with the result of the operation.
     * @throws {Error} If the database is not initialized or if there's an error during the transaction.
     */
    async _performTransaction(storeName, mode, operation) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }
            const transaction = this.db.transaction([storeName], mode);
            const store = transaction.objectStore(storeName);
            const request = operation(store);
            request.onerror = () => reject(`Error performing operation on ${storeName}`);
            request.onsuccess = () => resolve(request.result);
        });
    }
}

export default new QuestionStore();

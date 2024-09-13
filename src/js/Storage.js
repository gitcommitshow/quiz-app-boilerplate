/**
 * Manages the storage and retrieval of quiz questions and user answers using IndexedDB.
 * @class
 */
class Storage {
    static storesConfig = [{ name: 'questions', mandatoryIdKey: 'id' }, { name: 'userAnswers', mandatoryIdKey: 'questionId' }];
    /**
     * Creates an instance of Storage.
     */
    constructor() {
        this.dbName = 'QuizDB';
        this.dbVersion = 1;
        this.db = null;
    }

    /**
     * Initializes the IndexedDB database and creates object stores if needed.
     * @returns {Promise<void>} A promise that resolves when the database is initialized.
     * @throws {Error} If there's an error opening the database.
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
                Storage.storesConfig.forEach(storeConfig => {
                    if (!db.objectStoreNames.contains(storeConfig.name)) {
                        db.createObjectStore(storeConfig.name, { keyPath: storeConfig.mandatoryIdKey });
                    }
                });
            };
        });
    }

    /**
     * Gets the IndexedDB database.
     * @returns {Promise<IDBDatabase>} The IndexedDB database.
     * @throws {Error} If the database is not initialized.
     */
    async getDB() {
        if (!this.db) {
            await this.init();
        }
        return this.db;
    }

    async performTransaction(storeName, mode, operation) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], mode);
            const store = transaction.objectStore(storeName);
            const request = operation(store);
            request.onerror = () => reject(`Error performing operation on ${storeName}`);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async save(storeName, item) {
        return this.performTransaction(storeName, 'readwrite', store => store.put(item));
    }

    async getAll(storeName) {
        return this.performTransaction(storeName, 'readonly', store => store.getAll());
    }

    async getById(storeName, id) {
        return this.performTransaction(storeName, 'readonly', store => store.get(id));
    }

    async deleteById(storeName, id) {
        return this.performTransaction(storeName, 'readwrite', store => store.delete(id));
    }

    async clearStore(storeName) {
        return this.performTransaction(storeName, 'readwrite', store => store.clear());
    }
}

export default new Storage();

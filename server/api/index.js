import express from 'express';
import { ResilientLLM } from 'resilient-llm';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildContributorMarkdown,
  isValidSlug,
  markdownFilename,
} from '../lib/questionToMarkdown.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EVALUATION_MODEL = process.env.EVALUATION_MODEL || 'gpt-4o-mini';
const ANSWER_MODEL = process.env.ANSWER_MODEL || 'gpt-4o-mini';
const API_SERVER_PORT = process.env.API_SERVER_PORT || 8000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',') 
        : [];
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// Initialize ResilientLLM instances for evaluation and answer generation
const evaluationLLM = new ResilientLLM({
  aiService: 'openai',
  apiKey: OPENAI_API_KEY,
  model: EVALUATION_MODEL,
});

const answerLLM = new ResilientLLM({
  aiService: 'openai',
  apiKey: OPENAI_API_KEY,
  model: ANSWER_MODEL,
});

const app = express();        
app.use(express.json());

const corsOptions = {
  origin: function (origin, callback) {
    console.log('Request Origin:', origin);
    if (IS_DEVELOPMENT) {
      // Allow all origins in development
      callback(null, true);
    } else {
      if (origin && ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS. Only browser requests from these origins are allowed: '+ALLOWED_ORIGINS?.join(', ')));
      }
    }
  },
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));

async function evaluateAnswer(question, answer) {
  const conversationHistory = [
    { 
      role: 'system', 
      content: 'You are an expert in data engineering tasked with evaluating answers to technical questions.' 
    },
    { 
      role: 'user', 
      content: `As an expert in data engineering, please evaluate the following answer to the given question:

Question: ${question}

Answer: ${answer}

Please provide:
1. A grade from 1 to 10 (where 10 is the best).
2. An objective evaluation of whether the answer is correct or not.
3. A brief one-line hint to improve the answer.

Format your response as follows:
Grade: [Your grade]
Correct: [Yes/No]
Hint: [Your one-line hint]

Evaluation:` 
    }
  ];

  const response = await evaluationLLM.chat(conversationHistory);
  return response;
}

async function generateAnswer(question) {
    const conversationHistory = [
      { 
        role: 'system', 
        content: 'You are an expert in data engineering, covering topics such as databases, SQL, statistics, probability, analytics, and data processing.' 
      },
      { 
        role: 'user', 
        content: `As an expert in data engineering, please provide a subjective answer to the following question:\n\nQuestion: ${question}\n\nAnswer:` 
      }
    ];
    
    const response = await answerLLM.chat(conversationHistory);
    return response;
  }

app.get("/", (req, res) => res.send("✅ Quiz API Server is running"));

/**
 * POST /evaluate
 * Evaluate an answer to a question
 * @param {string} question - The question to evaluate
 * @param {string} answer - The answer to evaluate
 * @returns {object} - The evaluation of the answer
 * @example
 * curl -X POST http://localhost:8000/evaluate -H "Content-Type: application/json" -d '{"question": "Name 5 sql databases", "answer": "MySQL, PostgreSQL, SQLite"}'
 * // Response
 * {
 *   "grade": 6,
 *   "isCorrect": false,
 *   "nextHint": "You missed 2 databases. Try again.",
 *   "fullEvaluation": "Grade: 6\nCorrect: No\nHint: You missed 2 databases. Try again." 
 *   "question": "Name 5 sql databases",
 *   "answer": "MySQL, PostgreSQL, SQLite"
 * }
 */
app.post('/evaluate', async (req, res) => {
  console.log('Evaluating answer:', req.body);
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: "Both question and answer must be provided" });
  }

  try {
    const evaluation = await evaluateAnswer(question, answer);
    
    // Parse the evaluation response
    const gradeMatch = evaluation.match(/Grade: (\d+)/);
    const correctMatch = evaluation.match(/Correct: (Yes|No)/);
    const hintMatch = evaluation.match(/Hint: (.+)/);

    const parsedEvaluation = {
      grade: gradeMatch ? parseInt(gradeMatch[1]) : null,
      isCorrect: correctMatch ? correctMatch[1] === 'Yes' : null,
      nextHint: hintMatch ? hintMatch[1] : null,
      fullEvaluation: evaluation
    };

    res.json({ ...parsedEvaluation, question, answer });
  } catch (error) {
    console.error('Error evaluating answer:', error);
    res.status(500).json({ error: "An error occurred while evaluating the answer" });
  }
});

app.post('/ask', async (req, res) => {
    const { question } = req.body;
  
    if (!question) {
      return res.status(400).json({ error: "No question provided" });
    }
  
    try {
      const answer = await generateAnswer(question);
      res.json({ question, answer });
    } catch (error) {
      console.error('Error generating answer:', error);
      res.status(500).json({ error: "An error occurred while processing the question" });
    }
  });

/**
 * POST /submit-question
 * Submit a new question for review
 * @param {object} questionData - The question data to submit
 * @returns {object} - Success message and submitted question
 * @example
 * curl -X POST http://localhost:8000/submit-question -H "Content-Type: application/json" -d '{"type": "objective", "question": "What is SQL?", "options": ["A", "B", "C"], "expectedAnswer": "A", "hints": ["Hint 1", "Hint 2"]}'
 */
app.post('/submit-question', async (req, res) => {
  console.log('Received question submission:', req.body);
  const questionData = req.body;

  // Validate required fields
  if (!questionData.type || !questionData.question) {
    return res.status(400).json({ error: "Question type and question text are required" });
  }

  if (questionData.type !== 'objective' && questionData.type !== 'subjective') {
    return res.status(400).json({ error: "Question type must be 'objective' or 'subjective'" });
  }

  // Validate objective question structure
  if (questionData.type === 'objective') {
    if (!questionData.options || !Array.isArray(questionData.options) || questionData.options.length < 2) {
      return res.status(400).json({ error: "Objective questions must have at least 2 options" });
    }
    if (!questionData.expectedAnswer) {
      return res.status(400).json({ error: "Objective questions must have an expectedAnswer" });
    }
  }

  // Validate subjective question structure
  if (questionData.type === 'subjective') {
    if (!questionData.expectedAnswer) {
      return res.status(400).json({ error: "Subjective questions must have an expectedAnswer" });
    }
  }

  // Validate hints
  if (!questionData.hints || !Array.isArray(questionData.hints) || questionData.hints.length < 2) {
    return res.status(400).json({ error: "Questions must have at least 2 hints" });
  }

  const slug = typeof questionData.slug === 'string' ? questionData.slug.trim() : '';
  if (!slug || !isValidSlug(slug)) {
    return res.status(400).json({
      error:
        "A URL slug is required: use lowercase letters, digits, and hyphens only (e.g. my-question-title)",
    });
  }

  let requestedId = questionData.questionId ?? questionData.id;
  if (requestedId !== undefined && requestedId !== null && requestedId !== '') {
    const n = typeof requestedId === 'string' ? parseInt(requestedId, 10) : requestedId;
    if (!Number.isInteger(n) || n < 1) {
      return res.status(400).json({ error: "Optional question id must be a positive integer" });
    }
    requestedId = n;
  } else {
    requestedId = undefined;
  }

  try {
    // Read existing submitted questions
    const submittedQuestionsPath = path.join(__dirname, '..', 'submitted-questions.json');
    let submittedQuestions = [];
    
    try {
      const fileContent = await fs.readFile(submittedQuestionsPath, 'utf-8');
      submittedQuestions = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist yet, start with empty array
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Generate new question ID (highest existing ID + 1, or start from 1000 to avoid conflicts)
    const maxId = submittedQuestions.length > 0 
      ? Math.max(...submittedQuestions.map(q => q.id || 0))
      : 999;
    const autoId = maxId >= 1000 ? maxId + 1 : 1000;
    const newId = requestedId !== undefined ? requestedId : autoId;

    // Create question object
    const newQuestion = {
      id: newId,
      slug,
      version: 1,
      type: questionData.type,
      question: questionData.question,
      hints: questionData.hints,
      expectedAnswer: questionData.expectedAnswer,
      labels: questionData.labels || [],
      submittedAt: new Date().toISOString(),
      ...(questionData.type === 'objective' 
        ? { options: questionData.options }
        : {
            keywords: questionData.keywords || [],
            minKeywords: questionData.minKeywords || 0,
            maxLength: questionData.maxLength || 0
          })
    };

    let contributorMarkdown;
    try {
      contributorMarkdown = buildContributorMarkdown({
        id: newId,
        slug,
        type: questionData.type,
        version: 1,
        labels: questionData.labels || [],
        question: questionData.question,
        hints: questionData.hints,
        options: questionData.type === 'objective' ? questionData.options : undefined,
        expectedAnswer: questionData.expectedAnswer,
        keywords: questionData.type === 'subjective' ? questionData.keywords || [] : undefined,
        minKeywords: questionData.type === 'subjective' ? questionData.minKeywords ?? 0 : undefined,
        maxLength: questionData.type === 'subjective' ? questionData.maxLength ?? 0 : undefined,
      });
    } catch (e) {
      console.error('Markdown generation failed:', e);
      return res.status(400).json({ error: e.message || 'Could not build contributor Markdown' });
    }

    // Add to submitted questions
    submittedQuestions.push(newQuestion);

    // Write back to file
    await fs.writeFile(
      submittedQuestionsPath,
      JSON.stringify(submittedQuestions, null, 2),
      'utf-8'
    );

    console.log(`Question ${newId} submitted successfully`);
    res.json({
      success: true,
      message: "Question submitted successfully. Use the Markdown below to open a pull request.",
      question: newQuestion,
      markdown: contributorMarkdown,
      markdownFilename: markdownFilename(slug),
    });
  } catch (error) {
    console.error('Error submitting question:', error);
    res.status(500).json({ error: "An error occurred while submitting the question" });
  }
});

app.listen(API_SERVER_PORT, () => {
  console.log(`Quiz API Server running at http://localhost:${API_SERVER_PORT}`);
});

export default app;
import express from 'express';
import OpenAI from 'openai';
import cors from 'cors';


const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EVALUATION_MODEL = process.env.EVALUATION_MODEL || 'gpt-4o-mini';
const ANSWER_MODEL = process.env.ANSWER_MODEL || 'gpt-4o-mini';
const API_SERVER_PORT = process.env.API_SERVER_PORT || 8000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',') 
        : [];
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

const client = new OpenAI({
  apiKey: OPENAI_API_KEY
});

const app = express();        
app.use(express.json());

const corsOptions = {
  origin: function (origin, callback) {
    if (IS_DEVELOPMENT) {
      // Allow all origins in development
      callback(null, true);
    } else {
      if (origin && ALLOWED_ORIGINS.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS. Only browser requests from allowed origins are allowed: '+ALLOWED_ORIGINS?.join(', ')));
      }
    }
  },
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));

async function evaluateAnswer(question, answer) {
  const prompt = `As an expert in data engineering, please evaluate the following answer to the given question:

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

Evaluation:`;

const response = await client.chat.completions.create({
    model: EVALUATION_MODEL,
    messages: [
      { role: "system", content: "You are an expert in data engineering tasked with evaluating answers to technical questions." },
      { role: "user", content: prompt }
    ],
  });

  return response.choices[0].message.content;
}

async function generateAnswer(question) {
    const prompt = `As an expert in data engineering, please provide a subjective answer to the following question:\n\nQuestion: ${question}\n\nAnswer:`;
    
    const response = await client.chat.completions.create({
      model: ANSWER_MODEL,
      messages: [
        { role: "system", content: "You are an expert in data engineering, covering topics such as databases, SQL, statistics, probability, analytics, and data processing." },
        { role: "user", content: prompt }
      ],
    });
    return response.choices[0].message.content;
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

app.listen(API_SERVER_PORT, () => {
  console.log(`Quiz API Server running at http://localhost:${API_SERVER_PORT}`);
});

export default app;
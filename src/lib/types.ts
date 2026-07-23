export type User = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type ModelConfig = {
  id: string;
  name: string;
  base_url: string;
  model_name: string;
  embedding_model: string;
  is_active: boolean;
  created_at: string;
};

export type Document = {
  id: string;
  filename: string;
  file_path: string;
  status: "pending" | "indexed" | "failed";
  error_message: string | null;
  created_at: string;
};

export type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
};

export type Quiz = {
  id: string;
  document_id: string;
  topic: string;
  questions_data: QuizQuestion[];
  created_at: string;
};

export type ChatSession = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  role: string;
  content: string;
  sources_json: string | null;
  created_at: string;
};

export type TopicMastery = {
  topic: string;
  mastery_score: number;
  level: string;
  total_attempts: number;
};

export type ProgressStats = {
  average_score: number;
  mastery_score_percentage: number;
  mastery_level: string;
  topic_mastery: TopicMastery[];
  total_documents: number;
  total_sessions: number;
  total_quizzes: number;
  recent_attempts: Array<{
    id: string;
    quiz_id: string;
    topic: string;
    score_percentage: number;
    created_at: string;
  }>;
};


export type Agent = {
  id: string;
  name: string;
  role: string;
  system_prompt: string;
  avatar_icon: string;
  created_at: string;
  updated_at: string;
};

export type Notebook = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

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

/** Kemampuan yang bisa dimiliki sebuah endpoint model AI. */
export type ModelCapability =
  | "text"
  | "vision"
  | "code"
  | "audio"
  | "reasoning"
  | "tools"
  | "embedding";

export type ModelConfig = {
  id: string;
  name: string;
  base_url: string;
  model_name: string;
  embedding_model: string;
  is_active: boolean;
  capabilities: ModelCapability[];
  provider_type: string;
  context_window: number;
  created_at: string;
};

/** Hasil satu langkah pemeriksaan endpoint AI. */
export type ProbeResult = {
  name: string;
  label: string;
  status: "ok" | "warn" | "fail" | "skip";
  message: string;
  latency_ms: number | null;
};

/** Ringkasan diagnosa endpoint AI dari `POST /settings/model/detect`. */
export type DetectResult = {
  reachable: boolean;
  capabilities: ModelCapability[];
  provider_type: string;
  context_window: number;
  available_models: string[];
  probes: ProbeResult[];
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
  /** Null jika kuis dibuat dari topik bebas tanpa dokumen rujukan. */
  document_id: string | null;
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
  images_json?: string | null;
  usage_json: string | null;
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

/** Satu permintaan Riset Mendalam beserta progres penulisannya. */
export type ResearchReport = {
  id: string;
  topic: string;
  depth: "ringkas" | "standar" | "mendalam";
  status: "pending" | "running" | "completed" | "failed";
  progress_step: string;
  progress_percent: number;
  word_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  // Field berikut hanya terisi pada endpoint detail.
  instructions?: string | null;
  outline?: Array<{ judul: string; fokus?: string }> | null;
  sources?: Array<{ title: string; url: string; snippet?: string }> | null;
  content_markdown?: string;
};

export type UserPreference = {
  id: string;
  user_id: string;
  // Percakapan
  chat_temperature: number;
  chat_max_tokens: number;
  history_limit: number;
  enable_web_tools: boolean;
  enable_document_tools: boolean;
  enable_suggestions: boolean;
  // Pusat Pengetahuan
  chunk_size: number;
  chunk_overlap: number;
  retrieval_top_k: number;
  // Jaringan
  request_timeout: number;
  proxy_url: string | null;
  bypass_proxy_local: boolean;
  // Riset & Latihan Soal
  research_default_depth: string;
  default_quiz_questions: number;
  custom_instructions: string | null;
  created_at: string;
  updated_at: string;
};

export type UserPreferenceUpdate = Partial<
  Omit<UserPreference, "id" | "user_id" | "created_at" | "updated_at">
>;

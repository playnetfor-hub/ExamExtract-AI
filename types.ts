export interface McqData {
  id: string;
  question: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  choiceE?: string;
  correctAnswer: string; // "A", "B", "C", "D", or "E"
  passage?: string;
}

export interface ProcessingStatus {
  total: number;
  current: number;
  status: 'idle' | 'analyzing' | 'extracting' | 'complete' | 'error';
  message?: string;
}

export enum DocType {
  PDF = 'pdf',
  DOCX = 'docx',
  UNKNOWN = 'unknown'
}

export enum AppLanguage {
  AUTO = 'Auto',
  ENGLISH = 'English',
  ARABIC = 'Arabic'
}
